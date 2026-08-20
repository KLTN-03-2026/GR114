require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const SystemConfig = require('../config/SystemConfig');

const DECOMPOSITION_MODEL = process.env.DECOMPOSITION_MODEL || 'gemini-3.1-flash-lite';
const DECOMPOSITION_TIMEOUT_MS = Number(process.env.DECOMPOSITION_TIMEOUT_MS) || 15000;
const MAX_ISSUES = 6;
const MIN_COMPLEX_ISSUES = 2;

const QUERY_DECOMPOSITION_SCHEMA = {
    type: 'OBJECT',
    properties: {
        isComplex: { type: 'BOOLEAN' },
        issueCount: { type: 'INTEGER' },
        issues: {
            type: 'ARRAY',
            maxItems: MAX_ISSUES,
            items: {
                type: 'OBJECT',
                properties: {
                    id: { type: 'STRING' },
                    query: { type: 'STRING' }
                },
                required: ['id', 'query']
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
- Mỗi truy vấn phải hữu ích cho tìm kiếm ngữ nghĩa trong kho văn bản pháp luật.
- Mỗi truy vấn phải nêu rõ chủ thể, hành vi và sự kiện quan trọng; không dùng các cụm mơ hồ như "trường hợp này", "vấn đề trên", "như đã nói".
- Nếu yêu cầu chỉ có một vấn đề pháp lý, trả isComplex=false, issueCount=0 và issues=[].
- Chỉ trả JSON đúng schema được cung cấp.
`;

const CONNECTOR_TOKENS = new Set(['và', 'nhưng', 'còn', 'đồng thời', 'ngoài ra']);
const VAGUE_REFERENCES = ['trường hợp này', 'vấn đề trên', 'như đã nói'];

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
    const signals = [];

    if (explicitQuestionCount >= 2) signals.push('multiple_explicit_questions');
    if (sentenceCount >= 3) signals.push('multiple_sentences');
    if (clauseSeparatorCount >= 2 && connectorCount >= 2) signals.push('multiple_connected_clauses');
    if (connectorCount >= 3) signals.push('high_connector_density');
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
        if (!query || !comparisonKey || containsVagueReference(query) || uniqueQueries.has(comparisonKey)) {
            continue;
        }
        uniqueQueries.add(comparisonKey);
        issues.push({ id: `Q${issues.length + 1}`, query });
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
    const gate = detectComplexityCandidate(userQuery);
    console.log('[COMPLEXITY GATE]');
    console.log(gate);

    if (!gate.candidateComplex) {
        const result = getSimpleResult(false, gate.signals);
        console.log('[QUERY DECOMPOSITION]');
        console.log({
            usedModel: false,
            model: null,
            isComplex: false,
            issueCount: 0,
            issues: []
        });
        return result;
    }

    try {
        const generate = options.generate || callDecompositionModel;
        const modelResult = await generate(userQuery);
        const response = modelResult && modelResult.response ? modelResult.response : modelResult;
        const rawResult = response && typeof response.text === 'function'
            ? parseJsonResponse(response.text())
            : response;
        const validated = validateDecomposition(rawResult);
        const usage = getUsageMetadata(response);
        const result = {
            candidateComplex: true,
            signals: gate.signals,
            ...validated,
            usedModel: true,
            model: DECOMPOSITION_MODEL,
            usage
        };

        console.log('[QUERY DECOMPOSITION]');
        console.log({
            usedModel: true,
            model: DECOMPOSITION_MODEL,
            isComplex: result.isComplex,
            issueCount: result.issueCount,
            issues: result.issues
        });
        console.log('[DECOMPOSITION USAGE]');
        console.log(usage);
        return result;
    } catch (error) {
        console.error('[QUERY DECOMPOSITION ERROR]', error.message);
        const result = getSimpleResult(true, gate.signals, true);
        console.log('[QUERY DECOMPOSITION]');
        console.log({
            usedModel: true,
            model: DECOMPOSITION_MODEL,
            isComplex: false,
            issueCount: 0,
            issues: []
        });
        console.log('[DECOMPOSITION USAGE]');
        console.log(getUsageMetadata(null));
        return result;
    }
}

module.exports = {
    analyzeQuery,
    detectComplexityCandidate,
    validateDecomposition,
    QUERY_DECOMPOSITION_SCHEMA
};
