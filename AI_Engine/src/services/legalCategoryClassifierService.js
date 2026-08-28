const { GoogleGenerativeAI } = require('@google/generative-ai');
const { CANONICAL_CATEGORIES, isValidLegalCategory } = require('../constants/legalCategories');
const { computeLegalContentHash } = require('./legalDocumentChangeService');

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const CONTENT_PREVIEW_LENGTH = 800;

const parseDurationMs = value => {
    const match = String(value || '').match(/([0-9.]+)s/i);
    return match ? Math.ceil(Number(match[1]) * 1000) : null;
};

const extractErrorDetails = error => {
    const message = String(error?.message || error || 'Unknown error');
    const httpMatch = message.match(/\[(\d{3})\s+([^\]]+)\]/);
    const detailsStart = message.indexOf('[{"@type"');
    let errorDetails = [];
    if (detailsStart >= 0) {
        try { errorDetails = JSON.parse(message.slice(detailsStart)); } catch (_) { }
    }
    const quotaFailure = errorDetails.find(detail => String(detail['@type'] || '').endsWith('QuotaFailure'));
    const retryInfo = errorDetails.find(detail => String(detail['@type'] || '').endsWith('RetryInfo'));
    const violation = quotaFailure?.violations?.[0] || {};
    const retryDelay = retryInfo?.retryDelay || message.match(/Please retry in ([0-9.]+s)/i)?.[1] || null;
    const status = Number(error?.status || httpMatch?.[1]) || null;
    const errorType = error instanceof SyntaxError
        ? 'INVALID_JSON'
        : /Non-canonical category|Invalid confidence|Missing classification reason/.test(message)
            ? 'SCHEMA_VALIDATION'
            : status === 429 ? 'HTTP_429' : status ? 'API_ERROR'
                : /timeout/i.test(message) ? 'TIMEOUT' : 'OTHER';
    return {
        errorType, status, statusText: error?.statusText || httpMatch?.[2] || null,
        code: error?.code || (status === 429 ? 'RESOURCE_EXHAUSTED' : null), message, errorDetails,
        quotaMetric: violation.quotaMetric || null, quotaId: violation.quotaId || null,
        quotaValue: violation.quotaValue || null, quotaDimensions: violation.quotaDimensions || null,
        retryDelay, retryDelayMs: parseDurationMs(retryDelay)
    };
};

const buildPrompt = document => `Bạn là hệ thống phân loại văn bản pháp luật Việt Nam.

Nhiệm vụ:
Xác định lĩnh vực pháp lý chính của văn bản.

Chỉ được chọn MỘT nhóm trong danh sách sau:
${CANONICAL_CATEGORIES.join('\n')}

Quy tắc:
1. Ưu tiên lĩnh vực pháp lý chính, không dựa vào từ khóa phụ.
2. Dựa trên tiêu đề, số hiệu, cơ quan ban hành và trích đoạn nội dung.
3. Văn bản xử phạt phải phân loại theo lĩnh vực chuyên ngành nếu xác định được.
4. Không chọn "Bộ máy hành chính" chỉ vì có từ "xử phạt".
5. Nếu thuộc hoạt động tư pháp như công chứng, đấu giá tài sản, luật sư, trợ giúp pháp lý, hộ tịch hoặc giám định tư pháp thì ưu tiên "Tư pháp".
6. Nếu không đủ căn cứ, giữ "Lĩnh vực khác".
7. Không giải thích dài. Không dùng Markdown hoặc trích dẫn.

Id: ${document.Id}
Tiêu đề: ${document.Title || ''}
Số hiệu: ${document.DocumentNumber || ''}
Cơ quan ban hành: ${document.IssuingAgency || ''}
Trích đoạn nội dung: ${document.ContentPreview || ''}`;

const parseClassification = text => {
    const parsed = JSON.parse(String(text || '').trim());
    const category = String(parsed.category || '').trim();
    const confidence = String(parsed.confidence || '').trim().toUpperCase();
    const reason = String(parsed.reason || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    if (!isValidLegalCategory(category)) throw new Error(`Non-canonical category: ${category}`);
    if (!['HIGH', 'MEDIUM', 'LOW'].includes(confidence)) throw new Error(`Invalid confidence: ${confidence}`);
    if (!reason) throw new Error('Missing classification reason');
    return { suggestedCategory: category, confidence, reason };
};

const isTransientError = error => {
    const status = extractErrorDetails(error).status || Number(error?.response?.status);
    return status === 429 || status >= 500 || /timeout|network|fetch failed|ECONNRESET/i.test(error?.message || '');
};

const createClassifier = ({ apiKey, modelName = DEFAULT_MODEL, maxAttempts = 2, requestStats = null }) => {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
            temperature: 0, maxOutputTokens: 160, responseMimeType: 'application/json',
            responseSchema: {
                type: 'OBJECT',
                properties: {
                    category: { type: 'STRING', enum: CANONICAL_CATEGORIES },
                    confidence: { type: 'STRING', enum: ['HIGH', 'MEDIUM', 'LOW'] },
                    reason: { type: 'STRING' }
                },
                required: ['category', 'confidence', 'reason']
            }
        }
    });
    return async document => {
        let lastError;
        let modelCalls = 0;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            try {
                modelCalls += 1;
                if (requestStats) {
                    requestStats.currentActiveRequests += 1;
                    requestStats.peakActiveRequests = Math.max(requestStats.peakActiveRequests, requestStats.currentActiveRequests);
                }
                let result;
                try { result = await model.generateContent(buildPrompt(document)); }
                finally { if (requestStats) requestStats.currentActiveRequests -= 1; }
                const usage = result.response.usageMetadata || {};
                return {
                    ...parseClassification(result.response.text()), modelCalls,
                    usage: {
                        promptTokens: usage.promptTokenCount || 0,
                        outputTokens: usage.candidatesTokenCount || 0,
                        totalTokens: usage.totalTokenCount || 0
                    }
                };
            } catch (error) {
                lastError = error;
                if (attempt >= maxAttempts - 1 || !isTransientError(error)) break;
                const metadata = extractErrorDetails(error);
                await new Promise(resolve => setTimeout(resolve, metadata.retryDelayMs || Math.min(2000 * (2 ** attempt), 10000)));
            }
        }
        lastError.modelCalls = modelCalls;
        lastError.safeMetadata = extractErrorDetails(lastError);
        throw lastError;
    };
};

const classifyDocument = async (document, classifier) => {
    try {
        const result = await classifier(document);
        return {
            id: document.Id, documentNumber: document.DocumentNumber, title: document.Title,
            currentCategory: document.Category, suggestedCategory: result.suggestedCategory,
            confidence: result.confidence, reason: result.reason, status: 'OK',
            modelCalls: result.modelCalls || 1,
            usage: result.usage || { promptTokens: 0, outputTokens: 0, totalTokens: 0 }
        };
    } catch (error) {
        return {
            id: document.Id, documentNumber: document.DocumentNumber, title: document.Title,
            currentCategory: document.Category, suggestedCategory: null, confidence: null, reason: null,
            status: 'ERROR', error: error.message, modelCalls: error.modelCalls || 0,
            errorMetadata: error.safeMetadata || extractErrorDetails(error)
        };
    }
};

const isAcceptedCategory = category => isValidLegalCategory(category) && String(category).trim() !== 'Lĩnh vực khác';

async function resolveDocumentCategory({ sourceCategory, existing, document, classifier }) {
    if (isAcceptedCategory(sourceCategory)) return String(sourceCategory).trim();
    const incomingHash = computeLegalContentHash(document.ContentPreviewSource || '');
    const storedHash = existing?.ContentHash || (existing ? computeLegalContentHash(existing.Content) : null);
    if (storedHash === incomingHash && isAcceptedCategory(existing?.Category)) return existing.Category;
    try {
        const result = await classifier({
            Id: document.Id,
            Title: document.Title,
            DocumentNumber: document.DocumentNumber,
            IssuingAgency: document.IssuingAgency,
            ContentPreview: String(document.ContentPreviewSource || '').slice(0, CONTENT_PREVIEW_LENGTH),
            Category: sourceCategory
        });
        return isValidLegalCategory(result.suggestedCategory) ? result.suggestedCategory : 'Lĩnh vực khác';
    } catch (error) {
        console.warn(`[LEGAL CATEGORY] classification failed documentId=${document.Id}: ${String(error?.message || error).slice(0, 180)}`);
        return 'Lĩnh vực khác';
    }
}

module.exports = {
    DEFAULT_MODEL, CONTENT_PREVIEW_LENGTH, buildPrompt, parseClassification, extractErrorDetails,
    createClassifier, classifyDocument, isAcceptedCategory, resolveDocumentCategory
};
