require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const SystemConfig = require('../config/SystemConfig');
const log = require('../utils/legalAiLogger');
const { timed, timedSync } = require('../utils/latencyTracker');

const DECOMPOSITION_MODEL = process.env.DECOMPOSITION_MODEL || 'gemini-3.1-flash-lite';
const { recordCostUsage } = require('../utils/costUsageTelemetry');
const DECOMPOSITION_TIMEOUT_MS = Number(process.env.DECOMPOSITION_TIMEOUT_MS) || 15000;
const MAX_ISSUES = 6;
const MIN_COMPLEX_ISSUES = 2;

const QUERY_DECOMPOSITION_SCHEMA = {
    type: 'OBJECT',
    properties: {
        isComplex: { type: 'BOOLEAN', description: 'True only when there are at least two independently answerable legal retrieval units.' },
        issueCount: { type: 'INTEGER', description: 'Number of clustered legal retrieval units, from 2 to 6 when complex.' },
        issues: {
            type: 'ARRAY',
            maxItems: MAX_ISSUES,
            items: {
                type: 'OBJECT',
                properties: {
                    id: { type: 'STRING' },
                    query: { type: 'STRING', description: 'One self-contained legal retrieval query naming the subject, legal act or relationship, and requested legal output.' },
                    legalMechanismQuery: { type: 'STRING', description: 'A compact legal-mechanism query. Never include guessed article numbers, law numbers, IDs, or URLs.' },
                    factualAnchors: { type: 'ARRAY', maxItems: 10, items: { type: 'STRING' }, description: 'Distinctive supplied facts: actors, conduct, objects, quantities, percentages, and requested outcome.' }
                },
                required: ['id', 'query', 'legalMechanismQuery', 'factualAnchors']
            }
        }
    },
    required: ['isComplex', 'issueCount', 'issues']
};

const DECOMPOSITION_INSTRUCTION = `
Bạn là hệ thống phân tích truy vấn pháp lý phục vụ truy xuất dữ liệu.

Nhiệm vụ duy nhất:
- Xác định yêu cầu của người dùng có chứa nhiều vấn đề pháp lý độc lập hay không.
- Nếu có, tách thành từ 2 đến 6 truy vấn truy xuất ngắn, độc lập và tự đầy đủ bằng tiếng Việt.

Quy tắc:
- Không trả lời câu hỏi pháp lý.
- Không đưa ra kết luận, lời khuyên hoặc giải thích lập luận.
- Không trích dẫn hay tự tạo Điều, Khoản hoặc văn bản pháp luật.
- Không thực hiện tìm kiếm.
- Không sao chép toàn bộ tình huống khi một truy vấn ngắn hơn vẫn giữ đủ sự kiện pháp lý quan trọng.
- Gộp các vấn đề trùng lặp hoặc chỉ khác cách diễn đạt.
- Mỗi vấn đề phải là MỘT đơn vị pháp lý có thể được truy xuất và trả lời độc lập; không gộp nhiều đầu ra như quyền, nghĩa vụ, điều kiện, thời hạn và hậu quả vào cùng một vấn đề.
- Không tách thành các từ khóa rời rạc, chủ thể đơn lẻ hoặc chi tiết sự kiện riêng lẻ. Ví dụ không được trả riêng "người lao động", "hợp đồng", "báo trước".
- Với tình huống dài, gom các sự kiện liên quan vào 2 đến 6 cụm pháp lý chính; không tạo một vấn đề cho mỗi câu hay mỗi chi tiết.
- Mỗi truy vấn phải hữu ích cho tìm kiếm ngữ nghĩa trong kho văn bản pháp luật.
- Với mỗi vấn đề, query giữ sát cách diễn đạt và sự kiện của người dùng; legalMechanismQuery là cách diễn đạt ngắn gọn bằng các khái niệm/cơ chế pháp lý tương ứng.
- legalMechanismQuery tuyệt đối không đoán số Điều, số luật, mã tài liệu hoặc URL.
- factualAnchors chỉ ghi lại các sự kiện phân biệt đã có trong yêu cầu: chủ thể, hành vi, đối tượng, số lượng, tỷ lệ phần trăm và kết quả pháp lý được hỏi; không suy diễn thêm.
- Mỗi truy vấn phải nêu rõ chủ thể, hành vi và sự kiện quan trọng; không dùng các cụm mơ hồ như "trường hợp này", "vấn đề trên", "như đã nói".
- Nếu yêu cầu chỉ có một vấn đề pháp lý, trả isComplex=false, issueCount=0 và issues=[].
- Ví dụ tách đúng: yêu cầu "mức phạt và hình thức xử phạt bổ sung" phải thành một truy vấn về mức phạt chính và một truy vấn về hình thức xử phạt bổ sung, có giữ đủ hành vi/chủ thể nếu câu hỏi cung cấp.
- Ví dụ tách đúng: yêu cầu so sánh hai phiên bản hoặc hai văn bản phải có truy vấn tự đầy đủ cho từng văn bản; phần so sánh được giữ trong câu hỏi gốc cho mô hình trả lời cuối cùng.
- Ví dụ không tách: "Mức phạt cho hành vi X là bao nhiêu?" chỉ có một đầu ra pháp lý nên trả isComplex=false.
- Chỉ trả JSON đúng schema được cung cấp.
`;

const CONNECTOR_TOKENS = new Set(['và', 'nhưng', 'còn', 'đồng thời', 'ngoài ra']);
const VAGUE_REFERENCES = ['trường hợp này', 'vấn đề trên', 'như đã nói'];
const REQUESTED_OUTPUT_PATTERNS = [
    /quyền(?:\s+lợi)?/iu,
    /(?:nghĩa vụ|trách nhiệm)/iu,
    /điều kiện/iu,
    /(?:hồ sơ|giấy tờ cần)/iu,
    /(?:lệ phí|chi phí)/iu,
    /(?:thời hạn|báo trước)/iu,
    /(?:mức phạt|phạt bao nhiêu|phạt tiền)/iu,
    /hình thức xử phạt(?:\s+bổ sung)?/iu,
    /biện pháp(?:\s+(?:hỗ trợ|khắc phục|bảo vệ))?/iu,
    /(?:bồi thường|khắc phục hậu quả)/iu,
    /thẩm quyền/iu,
    /(?:hiệu lực|thời điểm áp dụng)/iu
];

function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeForComparison(value) {
    return normalizeWhitespace(value)
        .normalize('NFC')
        .toLocaleLowerCase('vi-VN')
        .replace(/[\p{P}\p{S}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function countConnectors(query) {
    const normalized = normalizeForComparison(query);
    let count = 0;
    for (const connector of CONNECTOR_TOKENS) {
        const escaped = connector.replace(/\s+/g, '\\s+');
        const matches = normalized.match(new RegExp(`(?:^|\\s)${escaped}(?=\\s|$)`, 'gu'));
        count += matches ? matches.length : 0;
    }
    return count;
}

function detectComplexityCandidate(userQuery) {
    const query = normalizeWhitespace(userQuery);
    const sentenceCount = query.split(/[.!?]+/u).map(part => part.trim()).filter(Boolean).length;
    const explicitQuestionCount = (query.match(/\?/g) || []).length;
    const clauseSeparatorCount = (query.match(/[,;:\n]/g) || []).length;
    const connectorCount = countConnectors(query);
    const requestedOutputCount = REQUESTED_OUTPUT_PATTERNS.filter(pattern => pattern.test(query)).length;
    const interrogativePhraseCount = (query.match(/(?:được không|có phải|thế nào|làm sao|ở đâu|bao nhiêu|gì)(?=\s*[,;?.]|\s*$)/giu) || []).length;
    const explicitDocumentNumbers = query.match(/\b\d{1,3}\s*\/\s*\d{4}\s*\/\s*[A-ZĐ0-9-]+\b/giu) || [];
    const comparisonRequest = /\b(?:so sánh|khác nhau|đối chiếu)\b/iu.test(query) &&
        (explicitDocumentNumbers.length >= 2 || /\b(?:luật|văn bản).+\b(?:với|và).+\b(?:luật|văn bản)\b/iu.test(query));
    const signals = [];

    if (explicitQuestionCount >= 2) signals.push('multiple_explicit_questions');
    if (sentenceCount >= 3) signals.push('multiple_sentences');
    if (clauseSeparatorCount >= 2 && connectorCount >= 2 && (requestedOutputCount >= 2 || interrogativePhraseCount >= 2)) {
        signals.push('multiple_connected_clauses');
    }
    if (connectorCount >= 3) signals.push('high_connector_density');
    if (requestedOutputCount >= 2 && (connectorCount >= 1 || clauseSeparatorCount >= 1)) {
        signals.push('multiple_requested_outputs');
    }
    if (comparisonRequest) signals.push('explicit_legal_comparison');
    if (query.length >= 350 && (sentenceCount >= 2 || clauseSeparatorCount >= 2)) {
        signals.push('long_multi_part_scenario');
    }

    return {
        candidateComplex: signals.length > 0,
        signals
    };
}

function containsVagueReference(query) {
    const normalized = normalizeForComparison(query);
    return VAGUE_REFERENCES.some(reference => normalized.includes(reference));
}

function validateDecomposition(rawResult) {
    if (!rawResult || rawResult.isComplex !== true || !Array.isArray(rawResult.issues)) {
        return { isComplex: false, issueCount: 0, issues: [] };
    }

    const uniqueQueries = new Set();
    const issues = [];
    for (const rawIssue of rawResult.issues) {
        if (issues.length >= MAX_ISSUES) break;
        const query = normalizeWhitespace(rawIssue && rawIssue.query);
        const comparisonKey = normalizeForComparison(query);
        const meaningfulTokenCount = comparisonKey.split(' ').filter(Boolean).length;
        if (!query || !comparisonKey || meaningfulTokenCount < 4 || containsVagueReference(query) || uniqueQueries.has(comparisonKey)) {
            continue;
        }
        uniqueQueries.add(comparisonKey);
        const legalMechanismQuery = normalizeWhitespace(rawIssue && rawIssue.legalMechanismQuery);
        const factualAnchors = Array.isArray(rawIssue?.factualAnchors)
            ? [...new Set(rawIssue.factualAnchors.map(normalizeWhitespace).filter(Boolean))].slice(0, 10)
            : [];
        issues.push({
            id: `Q${issues.length + 1}`,
            issueId: `Q${issues.length + 1}`,
            query,
            issueText: query,
            legalMechanismQuery: normalizeForComparison(legalMechanismQuery) === comparisonKey ? '' : legalMechanismQuery,
            factualAnchors
        });
    }

    if (issues.length < MIN_COMPLEX_ISSUES) {
        return { isComplex: false, issueCount: 0, issues: [] };
    }

    return { isComplex: true, issueCount: issues.length, issues };
}

function parseJsonResponse(responseText) {
    const cleaned = normalizeWhitespace(responseText)
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '');
    return JSON.parse(cleaned);
}

function getUsageMetadata(response) {
    const usage = response && response.usageMetadata ? response.usageMetadata : {};
    return {
        promptTokenCount: usage.promptTokenCount || 0,
        candidatesTokenCount: usage.candidatesTokenCount || 0,
        thoughtsTokenCount: usage.thoughtsTokenCount || 0,
        totalTokenCount: usage.totalTokenCount || 0
    };
}

function getSimpleResult(candidateComplex, signals, usedModel = false, usage = null) {
    return {
        candidateComplex,
        signals,
        isComplex: false,
        issueCount: 0,
        issues: [],
        usedModel,
        model: usedModel ? DECOMPOSITION_MODEL : null,
        usage
    };
}

async function callDecompositionModel(userQuery) {
    const apiKey = process.env.GEMINI_API_KEY || SystemConfig?.geminiApiKey;
    if (!apiKey) throw new Error('Gemini API key is not configured for query decomposition');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: DECOMPOSITION_MODEL,
        systemInstruction: DECOMPOSITION_INSTRUCTION
    });
    const request = model.generateContent({
        contents: [{ role: 'user', parts: [{ text: normalizeWhitespace(userQuery) }] }],
        generationConfig: {
            temperature: 0,
            topP: 0.1,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
            responseSchema: QUERY_DECOMPOSITION_SCHEMA
        }
    });
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(
            () => reject(new Error('Query decomposition timed out')),
            DECOMPOSITION_TIMEOUT_MS
        );
    });
    try {
        return await Promise.race([request, timeout]);
    } finally {
        clearTimeout(timeoutId);
    }
}

async function analyzeQuery(userQuery, options = {}) {
    const latency = options.latency;
    const gate = timedSync(latency, 'complexityMs', () => detectComplexityCandidate(userQuery));
    log.debug('COMPLEXITY GATE', { candidate: gate.candidateComplex, signals: gate.signals.join(',') || 'none' });

    if (!gate.candidateComplex) {
        const result = getSimpleResult(false, gate.signals);
        log.line('QUERY', { complex: false, issues: 0 });
        return result;
    }

    try {
        const generate = options.generate || callDecompositionModel;
        options.progress?.started('DECOMPOSING', 'Đang xác định các vấn đề pháp lý…');
        const callStarted = latency?.now?.() ?? Date.now();
        const modelResult = await timed(latency, 'decompositionMs', () => generate(userQuery));
        const response = modelResult && modelResult.response ? modelResult.response : modelResult;
        const rawResult = response && typeof response.text === 'function'
            ? parseJsonResponse(response.text())
            : response;
        const validated = validateDecomposition(rawResult);
        const usage = getUsageMetadata(response);
        recordCostUsage(latency, { stage: 'decomposer', model: DECOMPOSITION_MODEL, response, latencyMs: (latency?.now?.() ?? Date.now()) - callStarted, success: true, grounded: false });
        const result = {
            candidateComplex: true,
            signals: gate.signals,
            ...validated,
            usedModel: true,
            model: DECOMPOSITION_MODEL,
            usage
        };

        log.line('QUERY', { complex: result.isComplex, issues: result.issueCount });
        log.line('DECOMPOSITION', { model: DECOMPOSITION_MODEL, issues: result.issueCount, tokens: usage.totalTokenCount });
        log.debug('DECOMPOSITION ISSUES', { queries: result.issues.map(issue => `${issue.id}:${issue.query}`).join(' | ') || 'none' });
        options.progress?.completed('DECOMPOSING', 'Đã xác định các vấn đề pháp lý');
        return result;
    } catch (error) {
        recordCostUsage(latency, { stage: 'decomposer', model: DECOMPOSITION_MODEL, latencyMs: latency?.values?.decompositionMs || 0, success: false, grounded: false, failureType: error?.code || 'API_ERROR' });
        console.error('[QUERY DECOMPOSITION ERROR]', error.message);
        const result = getSimpleResult(true, gate.signals, true);
        log.line('QUERY', { complex: false, issues: 0 });
        log.line('DECOMPOSITION', { model: DECOMPOSITION_MODEL, issues: 0, tokens: 0 });
        options.progress?.degraded('DECOMPOSING', 'Không thể tách vấn đề tự động, đang tiếp tục xử lý yêu cầu');
        return result;
    }
}

module.exports = {
    analyzeQuery,
    detectComplexityCandidate,
    validateDecomposition,
    QUERY_DECOMPOSITION_SCHEMA
};
