const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { classifyChatIntent, getBypassResponse, INTENTS } = require('../src/services/chatIntentRouter');

const BYPASS_CASES = [
    ['chào', INTENTS.SOCIAL],
    ['hello', INTENTS.SOCIAL],
    ['cảm ơn', INTENTS.SOCIAL],
    ['bye', INTENTS.SOCIAL],
    ['haha', INTENTS.SOCIAL],
    ['oke', INTENTS.SOCIAL],
    ['hiểu rồi', INTENTS.SOCIAL],
    ['bạn là ai', INTENTS.CAPABILITY],
    ['bạn làm được gì', INTENTS.CAPABILITY],
    ['bạn trả lời được các câu hỏi vấn đề gì vậy', INTENTS.CAPABILITY],
    ['bạn trả lời được những gì', INTENTS.CAPABILITY],
    ['bạn hỗ trợ những gì', INTENTS.CAPABILITY],
    ['bạn giúp được gì', INTENTS.CAPABILITY],
    ['bạn có thể làm gì', INTENTS.CAPABILITY],
    ['bạn có thể trả lời về những lĩnh vực nào', INTENTS.CAPABILITY],
    ['bạn tư vấn được gì', INTENTS.CAPABILITY],
    ['LegAI hỗ trợ những vấn đề gì', INTENTS.CAPABILITY],
    ['LegAI có thể tư vấn gì', INTENTS.CAPABILITY],
    ['chức năng của bạn là gì', INTENTS.CAPABILITY],
    ['bạn chuyên về gì', INTENTS.CAPABILITY],
    ['bạn có hỗ trợ pháp lý không', INTENTS.CAPABILITY],
    ['kể chuyện cười đi', INTENTS.NON_LEGAL],
    ['1+1 bằng mấy', INTENTS.NON_LEGAL],
    ['thời tiết hôm nay thế nào', INTENTS.NON_LEGAL],
    ['viết code hello world', INTENTS.NON_LEGAL],
    ['??', INTENTS.NON_LEGAL],
    ['abcxyz', INTENTS.NON_LEGAL]
];

const LEGAL_CASES = [
    'Viên chức là ai?',
    'Mức phạt vi phạm hợp đồng là bao nhiêu?',
    'Điều 35 Bộ luật Lao động quy định gì?',
    'Luật Viên chức 129/2025/QH15'
];

const MIXED_CASES = [
    'chào, cho tôi hỏi Điều 35 Bộ luật Lao động',
    'haha luật này phạt bao nhiêu vậy',
    'cảm ơn, tiện cho hỏi viên chức là gì',
    'bạn là ai và bạn có thể tư vấn luật đất đai không?',
    'hello, thủ tục ly hôn thế nào?',
    'bạn có thể tư vấn Điều 35 Bộ luật Lao động không?',
    'bạn hỗ trợ luật đất đai thế nào?',
    'chào, cho tôi hỏi mức phạt vi phạm hợp đồng',
    'LegAI có thể giải thích Điều 1 Luật Viên chức không?',
    'bạn trả lời được câu này không: viên chức là ai?'
];

const CONTEXT_CASES = [
    'luật này thì sao?',
    'điều đó áp dụng thế nào?',
    'trường hợp trên có bị phạt không?',
    'cái đó có bị phạt không?',
    'https://vbpl.vn/van-ban/chi-tiet/example',
    'quy định năm 2025 có gì mới?'
];

test('high-confidence standalone fixtures bypass every legal external stage', () => {
    for (const [input, expectedIntent] of BYPASS_CASES) {
        const route = classifyChatIntent(input);
        assert.equal(route.intent, expectedIntent, input);
        assert.equal(route.bypassLegalRetrieval, true, input);
        assert.equal(route.confidence, 'HIGH', input);
        assert.ok(getBypassResponse(route.intent), input);

        const calls = route.bypassLegalRetrieval
            ? { decompositionCalls: 0, embeddingCalls: 0, pineconeCalls: 0, groundingCalls: 0, finalGeminiCalls: 0 }
            : { decompositionCalls: 1, embeddingCalls: 1, pineconeCalls: 1, groundingCalls: 1, finalGeminiCalls: 1 };
        assert.deepEqual(calls, {
            decompositionCalls: 0,
            embeddingCalls: 0,
            pineconeCalls: 0,
            groundingCalls: 0,
            finalGeminiCalls: 0
        }, input);
    }
});

test('legal fixtures always preserve the existing legal pipeline', () => {
    for (const input of LEGAL_CASES) {
        const route = classifyChatIntent(input);
        assert.equal(route.intent, INTENTS.LEGAL_OR_UNCERTAIN, input);
        assert.equal(route.bypassLegalRetrieval, false, input);
    }
});

test('social prefixes cannot override mixed legal content', () => {
    for (const input of MIXED_CASES) {
        const route = classifyChatIntent(input);
        assert.equal(route.intent, INTENTS.LEGAL_OR_UNCERTAIN, input);
        assert.equal(route.bypassLegalRetrieval, false, input);
        assert.notEqual(route.reason, 'standalone_social', input);
    }
});

test('legal history references, document identities, URLs, and years veto bypass', () => {
    for (const input of CONTEXT_CASES) {
        const route = classifyChatIntent(input);
        assert.equal(route.bypassLegalRetrieval, false, input);
        assert.equal(route.confidence, 'DEFAULT_LEGAL', input);
    }
});

test('ambiguous text defaults legal while only explicit nonsense uses the fast path', () => {
    assert.equal(classifyChatIntent('abc').bypassLegalRetrieval, false);
    assert.equal(classifyChatIntent('cái này sao').bypassLegalRetrieval, false);
    assert.equal(classifyChatIntent('').bypassLegalRetrieval, false);
    assert.equal(classifyChatIntent('abcxyz').bypassLegalRetrieval, true);
    assert.equal(classifyChatIntent('??').bypassLegalRetrieval, true);
});

test('controller returns from the intent fork before complexity, RAG, and final Gemini', () => {
    const controller = fs.readFileSync(path.join(__dirname, '../src/controllers/aiController.js'), 'utf8');
    const intentIndex = controller.indexOf('const chatIntent = classifyChatIntent(userQuery)');
    const returnIndex = controller.indexOf('return res.json({ success: true, answer, citations, sources, retrievalBypassed: true });', intentIndex);
    const complexityIndex = controller.indexOf('queryDecompositionService.analyzeQuery(userQuery', intentIndex);
    const ragIndex = controller.indexOf('ragService.query(userQuery', intentIndex);
    const finalGeminiIndex = controller.indexOf('geminiService.generateAnswerWithGemini(', intentIndex);

    assert.ok(intentIndex >= 0);
    assert.ok(returnIndex > intentIndex);
    assert.ok(complexityIndex > returnIndex);
    assert.ok(ragIndex > returnIndex);
    assert.ok(finalGeminiIndex > returnIndex);
    assert.doesNotMatch(controller.slice(intentIndex, returnIndex), /RAG_SEARCH|RAG_SELECT|COVERAGE_CHECK|GROUNDING|SYNTHESIZING/);
    assert.doesNotMatch(controller.slice(intentIndex, returnIndex), /streamStart|streamChunk|streamComplete/);
    assert.match(controller.slice(intentIndex, complexityIndex), /retrievalBypassed:\s*true/);
});
