require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const SystemConfig = require('../config/SystemConfig');
const log = require('../utils/legalAiLogger');

const PRIMARY_MODEL = process.env.CHAT_SEMANTIC_MODEL || 'gemini-3.5-flash-lite';
const FALLBACK_MODEL = process.env.CHAT_SEMANTIC_FALLBACK_MODEL || 'gemini-3.1-flash-lite';
const TIMEOUT_MS = Number(process.env.CHAT_SEMANTIC_TIMEOUT_MS) || 8000;
const MAX_HISTORY_MESSAGES = 6;
const MAX_CONTENT_CHARS = 600;
const SAFE_REPLY = 'Mình chưa hiểu rõ ý bạn ở câu này. Bạn nói thêm một chút nhé.';
const ALLOWED_INTENTS = new Set(['SOCIAL', 'CAPABILITY', 'NON_LEGAL', 'CLARIFICATION', 'LEGAL']);

const OUTPUT_SCHEMA = {
    type: 'OBJECT',
    properties: {
        intent: { type: 'STRING', enum: [...ALLOWED_INTENTS] },
        requiresLegalRetrieval: { type: 'BOOLEAN' },
        reply: { type: 'STRING' },
        confidence: { type: 'STRING', enum: ['HIGH', 'MEDIUM'] }
    },
    required: ['intent', 'requiresLegalRetrieval', 'reply', 'confidence']
};

const SYSTEM_INSTRUCTION = `Bạn là bộ phân giải hội thoại ngắn của LegAI. Chỉ phân loại ý định hiện tại dựa trên tin nhắn và ngữ cảnh gần đây.
- LEGAL khi người dùng đang hỏi nội dung/tình huống pháp lý; đặt requiresLegalRetrieval=true và reply="".
- SOCIAL, CAPABILITY, NON_LEGAL hoặc CLARIFICATION: requiresLegalRetrieval=false và reply tiếng Việt tự nhiên, ngắn, phù hợp ngữ cảnh.
- Không tư vấn luật, không viện dẫn quy định, không suy diễn căn cứ pháp lý.
- LegAI chủ yếu hỗ trợ pháp luật; yêu cầu rõ ràng ngoài phạm vi thì chuyển hướng ngắn gọn.
- Chỉ xuất JSON đúng schema, không giải thích reasoning.`;

function sanitizeHistory(history) {
    if (!Array.isArray(history)) return [];
    return history
        .filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
        .map(item => ({ role: item.role, content: item.content.trim().slice(0, MAX_CONTENT_CHARS) }))
        .filter(item => item.content)
        .slice(-MAX_HISTORY_MESSAGES);
}

function parseResponse(modelResult) {
    const response = modelResult?.response || modelResult;
    const text = typeof response?.text === 'function' ? response.text() : response?.text;
    const value = typeof text === 'string' ? JSON.parse(text.replace(/^```json\s*|\s*```$/gu, '')) : text;
    if (!value || !ALLOWED_INTENTS.has(value.intent) || !['HIGH', 'MEDIUM'].includes(value.confidence)) throw new Error('INVALID_RESOLVER_OUTPUT');
    const isLegal = value.intent === 'LEGAL';
    if (Boolean(value.requiresLegalRetrieval) !== isLegal) throw new Error('INVALID_RESOLVER_BOUNDARY');
    return {
        intent: value.intent,
        requiresLegalRetrieval: isLegal,
        reply: isLegal ? '' : String(value.reply || SAFE_REPLY).trim().slice(0, MAX_CONTENT_CHARS),
        confidence: value.confidence
    };
}

function classifyFailure(error) {
    const status = error?.status || error?.response?.status;
    const message = String(error?.message || '');
    if (status === 429 || /429|quota|rate.?limit/iu.test(message)) return 'RATE_LIMIT';
    if (status === 503 || /503|unavailable|high demand/iu.test(message)) return 'SERVICE_UNAVAILABLE';
    if (/timeout|timed out/iu.test(message)) return 'TIMEOUT';
    return 'API_ERROR';
}

async function generateWithModel(modelName, currentMessage, history, options = {}) {
    if (options.generate) return options.generate(modelName, currentMessage, history);
    const apiKey = process.env.GEMINI_API_KEY || SystemConfig?.geminiApiKey;
    if (!apiKey) throw new Error('Gemini API key is not configured for chat semantic resolution');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: SYSTEM_INSTRUCTION });
    const context = history.length
        ? history.map(item => `${item.role === 'user' ? 'USER' : 'ASSISTANT'}: ${item.content}`).join('\n')
        : '(không có lịch sử gần đây)';
    const request = model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `RECENT HISTORY:\n${context}\n\nCURRENT USER MESSAGE:\n${String(currentMessage).slice(0, MAX_CONTENT_CHARS)}` }] }],
        generationConfig: { temperature: 0.2, topP: 0.4, maxOutputTokens: 180, responseMimeType: 'application/json', responseSchema: OUTPUT_SCHEMA }
    });
    let timeoutId;
    const timeout = new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new Error('Chat semantic resolver timed out')), TIMEOUT_MS); });
    try { return await Promise.race([request, timeout]); }
    finally { clearTimeout(timeoutId); }
}

async function resolveChatSemantics(currentMessage, chatHistory = [], options = {}) {
    const history = sanitizeHistory(chatHistory);
    const latency = options.latency;
    const started = latency?.now?.() ?? Date.now();
    latency?.increment('semanticResolverCalls');
    let primaryFailure;
    try {
        const result = parseResponse(await generateWithModel(PRIMARY_MODEL, currentMessage, history, options));
        const elapsed = (latency?.now?.() ?? Date.now()) - started;
        latency?.add('semanticResolverMs', elapsed);
        log.line('CHAT SEMANTIC RESOLVER', { triggered: true, primaryModel: PRIMARY_MODEL, result: result.intent, requiresLegalRetrieval: result.requiresLegalRetrieval, historyMessages: history.length, latencyMs: Math.round(elapsed) });
        return { ...result, model: PRIMARY_MODEL, usedFallback: false };
    } catch (error) {
        primaryFailure = classifyFailure(error);
    }

    latency?.increment('semanticResolverFallbackCalls');
    try {
        const result = parseResponse(await generateWithModel(FALLBACK_MODEL, currentMessage, history, options));
        const elapsed = (latency?.now?.() ?? Date.now()) - started;
        latency?.add('semanticResolverMs', elapsed);
        log.line('CHAT SEMANTIC RESOLVER', { primaryFailure, fallbackModel: FALLBACK_MODEL, fallbackSuccess: true, result: result.intent, requiresLegalRetrieval: result.requiresLegalRetrieval, historyMessages: history.length, latencyMs: Math.round(elapsed) });
        return { ...result, model: FALLBACK_MODEL, usedFallback: true, primaryFailure };
    } catch (error) {
        const elapsed = (latency?.now?.() ?? Date.now()) - started;
        latency?.add('semanticResolverMs', elapsed);
        log.error('CHAT SEMANTIC RESOLVER', { primaryFailure, fallbackFailure: classifyFailure(error), fallbackSuccess: false, historyMessages: history.length, latencyMs: Math.round(elapsed) });
        return { intent: 'CLARIFICATION', requiresLegalRetrieval: false, reply: SAFE_REPLY, confidence: 'MEDIUM', failedSafe: true, primaryFailure, fallbackFailure: classifyFailure(error) };
    }
}

module.exports = { PRIMARY_MODEL, FALLBACK_MODEL, MAX_HISTORY_MESSAGES, SAFE_REPLY, sanitizeHistory, parseResponse, classifyFailure, resolveChatSemantics };
