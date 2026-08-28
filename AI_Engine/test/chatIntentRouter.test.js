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
    ['hehe', INTENTS.SOCIAL],
    ['oke', INTENTS.SOCIAL],
    ['hiểu rồi', INTENTS.SOCIAL],
    ['cảm ơn nha', INTENTS.SOCIAL],
    ['chào bạn nha', INTENTS.SOCIAL],
    ['huhu', INTENTS.SOCIAL],
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
    ['bạn là ai nhỉ', INTENTS.CAPABILITY],
    ['bạn là ai vậy huhu', INTENTS.CAPABILITY],
    ['bạn làm được gì thế', INTENTS.CAPABILITY],
    ['LegAI hỗ trợ gì', INTENTS.CAPABILITY],
    ['bạn chuyên về gì vậy', INTENTS.CAPABILITY],
    ['tôi buồn quá', INTENTS.NON_LEGAL],
    ['chán ghê', INTENTS.NON_LEGAL],
    ['nay mệt quá', INTENTS.NON_LEGAL],
    ['nói chuyện với tôi đi', INTENTS.NON_LEGAL],
    ['bạn khỏe không', INTENTS.NON_LEGAL],
    ['hôm nay vui không', INTENTS.NON_LEGAL],
    ['hehe buồn ghê', INTENTS.NON_LEGAL],
    ['kể chuyện cười đi', INTENTS.NON_LEGAL],
    ['1+1 bằng mấy', INTENTS.NON_LEGAL],
    ['thời tiết hôm nay thế nào', INTENTS.NON_LEGAL],
    ['viết code hello world', INTENTS.NON_LEGAL],
    ['giải bài toán này', INTENTS.NON_LEGAL],
    ['viết code React cho tôi', INTENTS.NON_LEGAL],
    ['viết hello world', INTENTS.NON_LEGAL],
    ['hôm nay thời tiết thế nào', INTENTS.NON_LEGAL],
    ['Messi ghi bao nhiêu bàn', INTENTS.NON_LEGAL],
    ['kể chuyện cười', INTENTS.NON_LEGAL],
    ['dịch câu này sang tiếng Anh', INTENTS.NON_LEGAL],
    ['gợi ý món ăn', INTENTS.NON_LEGAL],
    ['giải bài vật lý', INTENTS.NON_LEGAL],
    ['??', INTENTS.NON_LEGAL],
    ['abcxyz', INTENTS.NON_LEGAL],
    [':))', INTENTS.NON_LEGAL],
    ['hehehehehe', INTENTS.NON_LEGAL]
];

const LEGAL_CASES = [
    'Viên chức là ai?',
    'Mức phạt vi phạm hợp đồng là bao nhiêu?',
    'Điều 35 Bộ luật Lao động quy định gì?',
    'Luật Viên chức 129/2025/QH15',
    'ê buồn quá huhu hôm nay mới bị đuổi việc mà không được trả lương',
    'tui cần bạn giúp cái ni, công ty chưa trả lương',
    'ê cho tui hỏi cái ni có bi phat ko',
    'công ty nợ lương tôi 2 tháng thì làm sao',
    'ông chủ đuổi tui rồi không trả tháng cuối',
    'chủ nhà không trả cọc cho tôi',
    'người vay tiền không trả thì làm sao',
    'thủ tục ly hôn cần giấy tờ gì?',
    'cty ko tra luong tui 2 thang',
    'bi duoi viec ma ko dc tra luong',
    'co bi phat ko'
];

const CLARIFICATION_CASES = [
    'tui cần bạn giúp cái ni',
    'tôi cần bạn giúp cái này',
    'cho hỏi cái này',
    'tôi có chuyện muốn hỏi',
    'giúp tui với',
    'có chuyện này nè',
    'ê hỏi cái được không',
    'này bạn',
    'cho tui hoi cai ni',
    'ê tui cần giúp',
    'abc'
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
    'bạn trả lời được câu này không: viên chức là ai?',
    'tôi buồn vì công ty sa thải tôi trái luật',
    'bạn là ai và Điều 35 quy định gì',
    'kể chuyện này giúp tôi: công ty không trả lương có vi phạm không',
    '1+1 không quan trọng, cho tôi hỏi mức phạt hành vi này'
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
        assert.equal(route.requiresLegalRetrieval, true, input);
        assert.equal(route.confidence, 'HIGH', input);
    }
});

test('domain-unclear requests deterministically ask for clarification without retrieval', () => {
    for (const input of CLARIFICATION_CASES) {
        const route = classifyChatIntent(input);
        assert.equal(route.intent, INTENTS.CLARIFICATION, input);
        assert.equal(route.bypassLegalRetrieval, true, input);
        assert.equal(route.requiresLegalRetrieval, false, input);
        assert.equal(route.confidence, 'LOW', input);
        assert.equal(getBypassResponse(route.intent), 'Được, bạn mô tả cụ thể tình huống hoặc vấn đề cần hỗ trợ nhé.', input);
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
        assert.equal(route.confidence, 'HIGH', input);
    }
});

test('ambiguous text defaults to clarification while explicit nonsense remains non-legal', () => {
    assert.equal(classifyChatIntent('abc').intent, INTENTS.CLARIFICATION);
    assert.equal(classifyChatIntent('cái này sao').intent, INTENTS.CLARIFICATION);
    assert.equal(classifyChatIntent('').intent, INTENTS.CLARIFICATION);
    assert.equal(classifyChatIntent('abcxyz').bypassLegalRetrieval, true);
    assert.equal(classifyChatIntent('??').bypassLegalRetrieval, true);
});

test('every bypass intent is outside the Grounding admission boundary', () => {
    const examples = new Map([
        [INTENTS.SOCIAL, 'chào'],
        [INTENTS.CAPABILITY, 'bạn là ai vậy huhu'],
        [INTENTS.NON_LEGAL, '1+1 bằng mấy'],
        [INTENTS.CLARIFICATION, 'tui cần bạn giúp cái ni']
    ]);
    for (const [intent, input] of examples) {
        const route = classifyChatIntent(input);
        assert.equal(route.intent, intent);
        assert.equal(route.requiresLegalRetrieval, false);
        assert.equal(route.bypassLegalRetrieval, true);
    }
    assert.equal(classifyChatIntent('công ty không trả lương').requiresLegalRetrieval, true);
});

test('controller returns from the intent fork before complexity, RAG, and final Gemini', () => {
    const controller = fs.readFileSync(path.join(__dirname, '../src/controllers/aiController.js'), 'utf8');
    const intentIndex = controller.indexOf('let chatIntent = classifyChatIntent(userQuery)');
    const returnIndex = controller.indexOf('return res.json({ success: true, answer, citations, sources, retrievalBypassed: true });', intentIndex);
    const complexityIndex = controller.indexOf('queryDecompositionService.analyzeQuery(userQuery', intentIndex);
    const ragIndex = controller.indexOf('ragService.query(userQuery', intentIndex);
    const finalGeminiIndex = controller.indexOf('geminiService.generateAnswerWithGemini(', intentIndex);

    assert.ok(intentIndex >= 0);
    assert.match(controller.slice(intentIndex, returnIndex), /chatIntent\.requiresLegalRetrieval\s*!==\s*true/);
    assert.ok(returnIndex > intentIndex);
    assert.ok(complexityIndex > returnIndex);
    assert.ok(ragIndex > returnIndex);
    assert.ok(finalGeminiIndex > returnIndex);
    assert.doesNotMatch(controller.slice(intentIndex, returnIndex), /RAG_SEARCH|RAG_SELECT|COVERAGE_CHECK|GROUNDING|SYNTHESIZING/);
    assert.doesNotMatch(controller.slice(intentIndex, returnIndex), /streamStart|streamChunk|streamComplete/);
    assert.match(controller.slice(intentIndex, complexityIndex), /retrievalBypassed:\s*true/);
});
