const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLatencyTracker, snapshot } = require('../src/utils/latencyTracker');
const {
    PRIMARY_MODEL, FALLBACK_MODEL, SAFE_REPLY, sanitizeHistory,
    classifyFailure, resolveChatSemantics
} = require('../src/services/chatSemanticResolver');
const { classifyChatIntent, getBypassResponse } = require('../src/services/chatIntentRouter');

function response(value) {
    return { response: { text: () => JSON.stringify(value) } };
}

test('resolver model chain is dedicated, bounded, non-streaming, and tool-free', () => {
    assert.equal(PRIMARY_MODEL, 'gemini-3.5-flash-lite');
    assert.equal(FALLBACK_MODEL, 'gemini-3.1-flash-lite');
    const source = fs.readFileSync(path.join(__dirname, '../src/services/chatSemanticResolver.js'), 'utf8');
    assert.match(source, /\.generateContent\(/u);
    assert.doesNotMatch(source, /generateContentStream|Grounding|Pinecone|ragService|embedContent|tools\s*:/u);
    assert.match(source, /maxOutputTokens:\s*180/u);
});

test('history accepts only six recent role/content pairs and caps content', () => {
    const input = Array.from({ length: 9 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `${index}-${'x'.repeat(800)}`, metadata: { ignored: true } }));
    input.push({ role: 'tool', content: 'must disappear' });
    const history = sanitizeHistory(input);
    assert.equal(history.length, 6);
    assert.equal(history[0].content.startsWith('3-'), true);
    assert.equal(history.every(item => Object.keys(item).sort().join(',') === 'content,role'), true);
    assert.equal(history.every(item => item.content.length <= 600), true);
});

test('gray-zone conversation resolves contextually without legal retrieval', async () => {
    const turns = [
        ['thật không', 'SOCIAL', 'Thật chứ, mình đang lắng nghe bạn đây.'],
        ['bạn nói thật hay láo chứ', 'SOCIAL', 'Mình nói thật và sẽ cố gắng hỗ trợ rõ ràng.'],
        ['tôi miêu tả bao nhiêu dòng là được', 'CAPABILITY', 'Không cần cố định số dòng; bạn chỉ cần nêu đủ tình huống và điều muốn hỏi.'],
        ['không được', 'CLARIFICATION', 'Bạn đang vướng ở phần mô tả hay chỗ hướng dẫn nào chưa đúng?']
    ];
    const history = [{ role: 'user', content: 'tui buồn quá' }, { role: 'assistant', content: 'Mình rất tiếc khi nghe vậy.' }];
    for (const [message, intent, reply] of turns) {
        const result = await resolveChatSemantics(message, history, { generate: async () => response({ intent, requiresLegalRetrieval: false, reply, confidence: 'HIGH' }) });
        assert.equal(result.intent, intent);
        assert.equal(result.requiresLegalRetrieval, false);
        assert.equal(result.reply, reply);
    }
});

test('obvious sadness stays on the zero-cost local path with a natural reply', () => {
    const route = classifyChatIntent('tui buồn quá');
    assert.equal(route.requiresLegalRetrieval, false);
    assert.equal(route.confidence, 'HIGH');
    assert.match(getBypassResponse(route.intent, 'tui buồn quá'), /tiếc|chia sẻ/u);
});

test('legal semantic result is a handoff and never contains a resolver answer', async () => {
    const result = await resolveChatSemantics('cty đuổi t r mà ko tr luog', [], {
        generate: async () => response({ intent: 'LEGAL', requiresLegalRetrieval: true, reply: 'must be removed', confidence: 'HIGH' })
    });
    assert.equal(result.intent, 'LEGAL');
    assert.equal(result.requiresLegalRetrieval, true);
    assert.equal(result.reply, '');
});

for (const [status, expected] of [[429, 'RATE_LIMIT'], [503, 'SERVICE_UNAVAILABLE']]) {
    test(`${status} primary failure falls back once and remains outside RAG when non-legal`, async () => {
        const calls = [];
        const result = await resolveChatSemantics('thật không', [], {
            generate: async model => {
                calls.push(model);
                if (model === PRIMARY_MODEL) throw Object.assign(new Error(String(status)), { status });
                return response({ intent: 'SOCIAL', requiresLegalRetrieval: false, reply: 'Ừ, thật đó.', confidence: 'HIGH' });
            }
        });
        assert.deepEqual(calls, [PRIMARY_MODEL, FALLBACK_MODEL]);
        assert.equal(result.primaryFailure, expected);
        assert.equal(result.usedFallback, true);
        assert.equal(result.requiresLegalRetrieval, false);
    });
}

test('both model failures return safe clarification and never infer legal intent', async () => {
    const calls = [];
    const latency = createLatencyTracker();
    const result = await resolveChatSemantics('không được', [], { latency, generate: async model => { calls.push(model); throw new Error('timed out'); } });
    const metrics = snapshot(latency, 5);
    assert.deepEqual(calls, [PRIMARY_MODEL, FALLBACK_MODEL]);
    assert.equal(result.intent, 'CLARIFICATION');
    assert.equal(result.requiresLegalRetrieval, false);
    assert.equal(result.reply, SAFE_REPLY);
    assert.equal(result.failedSafe, true);
    assert.equal(classifyFailure(new Error('timed out')), 'TIMEOUT');
    assert.equal(metrics.semanticResolverCalls, 1);
    assert.equal(metrics.semanticResolverFallbackCalls, 1);
});

test('controller resolves only low-confidence ambiguity before the legal allowlist gate', () => {
    const controller = fs.readFileSync(path.join(__dirname, '../src/controllers/aiController.js'), 'utf8');
    const resolver = controller.indexOf('await resolveChatSemantics(userQuery, chatHistory');
    const gate = controller.indexOf('chatIntent.requiresLegalRetrieval !== true', resolver);
    const decomposition = controller.indexOf('queryDecompositionService.analyzeQuery(userQuery', gate);
    assert.ok(resolver >= 0 && gate > resolver && decomposition > gate);
    assert.match(controller.slice(resolver, gate), /failedSafe[\s\S]*semantic_resolver_failed_safe/u);
});
