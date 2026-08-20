const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { sql, pool, poolConnect } = require('../src/config/db');
const { CANONICAL_CATEGORIES, isValidLegalCategory } = require('../src/constants/legalCategories');

const ENV_PATH = path.resolve(__dirname, '../.env');
const inheritedApiKey = process.env.GEMINI_API_KEY;
const dotenvResult = dotenv.config({ path: ENV_PATH });
const apiKeySource = inheritedApiKey
    ? 'process.env (inherited before dotenv; overrides .env)'
    : dotenvResult.parsed?.GEMINI_API_KEY
        ? ENV_PATH
        : 'missing';

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const OUTPUT_PATH = path.resolve(__dirname, 'output/legal_category_reclassification_audit.json');
const CONCURRENCY = 2;
const CONTENT_PREVIEW_LENGTH = 800;
const EXCLUDED_HIGH_IDS = Object.freeze([
    '126-2025-qh15',
    '49-2010-qh12',
    '26-2023-qh15',
    '68-2020-qh14',
    '79-2006-qh11',
    '47-2014-qh13',
    '36-2013-qh13',
    '51-2019-qh14',
    '132-2025-qh15',
    '01-2007-qh12',
    '94-2015-qh13',
    '25-2018-qh14',
    '102-2016-qh13'
]);
const excludedHighIdSet = new Set(EXCLUDED_HIGH_IDS);

const getKeyFingerprint = value => value ? {
    sha256Prefix: crypto.createHash('sha256').update(value).digest('hex').slice(0, 12),
    last4: value.slice(-4),
    length: value.length
} : null;

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
            : status === 429
                ? 'HTTP_429'
                : status
                    ? 'API_ERROR'
                    : /timeout/i.test(message)
                        ? 'TIMEOUT'
                        : 'OTHER';

    return {
        errorType,
        status,
        statusText: error?.statusText || httpMatch?.[2] || null,
        code: error?.code || (status === 429 ? 'RESOURCE_EXHAUSTED' : null),
        message,
        errorDetails,
        quotaMetric: violation.quotaMetric || null,
        quotaId: violation.quotaId || null,
        quotaValue: violation.quotaValue || null,
        quotaDimensions: violation.quotaDimensions || null,
        retryDelay,
        retryDelayMs: parseDurationMs(retryDelay)
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

const createClassifier = ({ apiKey, modelName, maxAttempts = 2, requestStats = null }) => {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
            temperature: 0,
            maxOutputTokens: 160,
            responseMimeType: 'application/json',
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
                    requestStats.peakActiveRequests = Math.max(
                        requestStats.peakActiveRequests,
                        requestStats.currentActiveRequests
                    );
                }
                let result;
                try {
                    result = await model.generateContent(buildPrompt(document));
                } finally {
                    if (requestStats) requestStats.currentActiveRequests -= 1;
                }
                const usage = result.response.usageMetadata || {};
                return {
                    ...parseClassification(result.response.text()),
                    modelCalls,
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
                const delayMs = metadata.retryDelayMs || Math.min(2000 * (2 ** attempt), 10000);
                await new Promise(resolve => setTimeout(resolve, delayMs));
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
            id: document.Id,
            documentNumber: document.DocumentNumber,
            title: document.Title,
            currentCategory: document.Category,
            suggestedCategory: result.suggestedCategory,
            confidence: result.confidence,
            reason: result.reason,
            status: 'OK',
            modelCalls: result.modelCalls || 1,
            usage: result.usage || { promptTokens: 0, outputTokens: 0, totalTokens: 0 }
        };
    } catch (error) {
        return {
            id: document.Id,
            documentNumber: document.DocumentNumber,
            title: document.Title,
            currentCategory: document.Category,
            suggestedCategory: null,
            confidence: null,
            reason: null,
            status: 'ERROR',
            error: error.message,
            errorMetadata: error.safeMetadata || extractErrorDetails(error),
            modelCalls: error.modelCalls || 1,
            usage: { promptTokens: 0, outputTokens: 0, totalTokens: 0 }
        };
    }
};

const mapWithConcurrency = async (items, concurrency, worker) => {
    const results = new Array(items.length);
    let nextIndex = 0;
    const runWorker = async () => {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            results[index] = await worker(items[index], index);
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
    return results;
};

const summarizeReport = report => {
    const summary = {
        total: report.length,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        errors: 0,
        eligibleForApplyHigh: 0,
        groupedBySuggestedCategory: {},
        usage: { documentsProcessed: report.length, modelCalls: 0, promptTokens: 0, outputTokens: 0, totalTokens: 0 }
    };
    for (const item of report) {
        if (item.status === 'ERROR') summary.errors += 1;
        else {
            summary[item.confidence] += 1;
            summary.groupedBySuggestedCategory[item.suggestedCategory] =
                (summary.groupedBySuggestedCategory[item.suggestedCategory] || 0) + 1;
            if (item.confidence === 'HIGH' && item.suggestedCategory !== 'Lĩnh vực khác') summary.eligibleForApplyHigh += 1;
        }
        summary.usage.modelCalls += item.modelCalls || 1;
        summary.usage.promptTokens += item.usage?.promptTokens || 0;
        summary.usage.outputTokens += item.usage?.outputTokens || 0;
        summary.usage.totalTokens += item.usage?.totalTokens || 0;
    }
    return summary;
};

const selectApplyHighCandidates = report => report.filter(item =>
        item.status === 'OK' && item.confidence === 'HIGH' &&
        item.suggestedCategory !== 'Lĩnh vực khác' && isValidLegalCategory(item.suggestedCategory) &&
        !excludedHighIdSet.has(item.id)
    );

const buildApplyHighPreview = report => {
    const automaticHighUpdates = selectApplyHighCandidates(report);
    const excludedHigh = report.filter(item =>
        item.status === 'OK' && item.confidence === 'HIGH' && excludedHighIdSet.has(item.id)
    );
    const mediumLowUntouched = report.filter(item =>
        item.status === 'OK' && ['MEDIUM', 'LOW'].includes(item.confidence)
    );
    return {
        totalAuditRecords: report.length,
        automaticHighUpdateCount: automaticHighUpdates.length,
        automaticHighUpdates: automaticHighUpdates.map(item => ({
            id: item.id,
            documentNumber: item.documentNumber,
            suggestedCategory: item.suggestedCategory
        })),
        excludedHighCount: excludedHigh.length,
        excludedHighIds: excludedHigh.map(item => item.id),
        mediumLowUntouchedCount: mediumLowUntouched.length,
        mediumLowUntouched: mediumLowUntouched.map(item => ({
            id: item.id,
            documentNumber: item.documentNumber,
            confidence: item.confidence,
            suggestedCategory: item.suggestedCategory
        })),
        expectedRemainingOther: report.length - automaticHighUpdates.length,
        sqlGuard: "Category = N'Lĩnh vực khác'"
    };
};

const applyHighConfidence = async (report, updateCategory) => {
    const eligible = selectApplyHighCandidates(report);
    let updated = 0;
    for (const item of eligible) updated += await updateCategory(item);
    return { attempted: eligible.length, updated, skipped: eligible.length - updated };
};

const loadAuditReport = () => {
    if (!fs.existsSync(OUTPUT_PATH)) throw new Error(`Audit report not found: ${OUTPUT_PATH}`);
    const report = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
    if (!Array.isArray(report)) throw new Error('Audit report must be a JSON array');
    return report;
};

const runApplyHighPreview = () => {
    const report = loadAuditReport();
    console.log(JSON.stringify({ mode: 'APPLY_HIGH_PREVIEW', ...buildApplyHighPreview(report) }, null, 2));
};

const loadDocuments = async () => {
    const result = await pool.request().query(`
        SELECT Id, DocumentNumber, Title, Category, Agency AS IssuingAgency,
               LEFT(Content, ${CONTENT_PREVIEW_LENGTH}) AS ContentPreview
        FROM dbo.LegalDocuments
        WHERE Category = N'Lĩnh vực khác'
        ORDER BY Title
    `);
    return result.recordset;
};

const loadLimitedDocuments = async limit => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 1, 5));
    const result = await pool.request().query(`
        SELECT TOP (${safeLimit}) Id, DocumentNumber, Title, Category,
               Agency AS IssuingAgency, LEFT(Content, ${CONTENT_PREVIEW_LENGTH}) AS ContentPreview
        FROM dbo.LegalDocuments
        WHERE Category = N'Lĩnh vực khác'
        ORDER BY Title
    `);
    return result.recordset;
};

const runDryAudit = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is required');
    await poolConnect;
    const documents = await loadDocuments();
    const modelName = process.env.CLASSIFICATION_MODEL || DEFAULT_MODEL;
    const classifier = createClassifier({ apiKey, modelName });
    const report = await mapWithConcurrency(documents, CONCURRENCY, document => classifyDocument(document, classifier));
    const summary = summarizeReport(report);
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ mode: 'DRY_RUN', model: modelName, outputPath: OUTPUT_PATH, summary }, null, 2));
    await pool.close();
};

const runApplyHigh = async () => {
    const report = loadAuditReport();
    await poolConnect;
    const result = await applyHighConfidence(report, async item => {
        const updateResult = await pool.request()
            .input('id', sql.NVarChar(100), item.id)
            .input('category', sql.NVarChar(100), item.suggestedCategory)
            .query(`UPDATE dbo.LegalDocuments
                    SET Category = @category
                    WHERE Id = @id AND Category = N'Lĩnh vực khác'`);
        return updateResult.rowsAffected[0] || 0;
    });
    const remainingResult = await pool.request().query(
        "SELECT COUNT(*) AS Total FROM dbo.LegalDocuments WHERE Category = N'Lĩnh vực khác'"
    );
    console.log(JSON.stringify({ mode: 'APPLY_HIGH', ...result, remainingOther: remainingResult.recordset[0].Total }, null, 2));
    await pool.close();
};

const runDiagnostic = async () => {
    const limitArgument = process.argv.find(argument => argument.startsWith('--limit='));
    const limit = Math.max(1, Math.min(Number(limitArgument?.split('=')[1]) || 1, 5));
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is required');
    await poolConnect;
    const documents = await loadLimitedDocuments(limit);
    const modelName = process.env.CLASSIFICATION_MODEL || DEFAULT_MODEL;
    const requestStats = { currentActiveRequests: 0, peakActiveRequests: 0 };
    const classifier = createClassifier({ apiKey, modelName, maxAttempts: 1, requestStats });
    const report = await mapWithConcurrency(documents, CONCURRENCY, document => classifyDocument(document, classifier));
    console.log(JSON.stringify({
        mode: 'DIAGNOSTIC',
        sdk: { package: '@google/generative-ai', version: require('@google/generative-ai/package.json').version },
        endpointVersion: 'v1beta',
        model: modelName,
        keyConfiguration: { source: apiKeySource, fingerprint: getKeyFingerprint(apiKey), shellOverride: Boolean(inheritedApiKey) },
        requestStats,
        summary: summarizeReport(report),
        results: report.map(item => ({
            id: item.id,
            title: item.title,
            status: item.status,
            suggestedCategory: item.suggestedCategory,
            confidence: item.confidence,
            usage: item.usage,
            errorMetadata: item.errorMetadata || null
        }))
    }, null, 2));
    await pool.close();
};

if (require.main === module) {
    const command = process.argv.includes('--diagnose')
        ? runDiagnostic
        : process.argv.includes('--preview-apply-high')
            ? runApplyHighPreview
        : process.argv.includes('--apply-high')
            ? runApplyHigh
            : runDryAudit;
    Promise.resolve(command()).catch(async error => {
        console.error(error.message);
        try { await pool.close(); } catch (_) { }
        process.exitCode = 1;
    });
}

module.exports = {
    buildPrompt,
    parseClassification,
    extractErrorDetails,
    classifyDocument,
    summarizeReport,
    selectApplyHighCandidates,
    buildApplyHighPreview,
    EXCLUDED_HIGH_IDS,
    applyHighConfidence
};
