const test = require('node:test');
const assert = require('node:assert/strict');
const { IncrementalAnswerParser, createDeltaBatcher, generateContentStreaming } = require('../src/utils/geminiStreamUtils');

test('incremental JSON parser emits only answer across split key and value boundaries', () => {
    const parser = new IncrementalAnswerParser();
    const output = ['{"ans', 'wer":"Theo', ' Điều 1...","citations":[]}'].map(chunk => parser.push(chunk)).join('');
    assert.equal(output, 'Theo Điều 1...');
    assert.doesNotMatch(output, /answer|citations|[{}]/u);
});

test('incremental JSON parser handles escaped quotes, newlines, unicode escapes, and split backslashes', () => {
    const parser = new IncrementalAnswerParser();
    const chunks = ['{"answer":"Dòng 1\\', 'nNói: \\"Luật\\" ', '\\u0110', 'iều 2","citations":[]}'];
    assert.equal(chunks.map(chunk => parser.push(chunk)).join(''), 'Dòng 1\nNói: "Luật" Điều 2');
});

test('plain grounded stream emits text while final metadata remains on aggregated response', async () => {
    const deltas = [];
    const finalResponse = { text: () => 'Theo Điều 1', candidates: [{ groundingMetadata: { groundingChunks: [{ web: { uri: 'https://vbpl.vn/law' } }] } }] };
    const model = {
        generateContentStream: async () => ({
            stream: (async function* () { yield { text: () => 'Theo ' }; yield { text: () => 'Điều 1' }; })(),
            response: Promise.resolve(finalResponse)
        })
    };
    const result = await generateContentStreaming(model, {}, { grounded: true, onDelta: delta => deltas.push(delta), intervalMs: 1000 });
    assert.equal(deltas.join(''), 'Theo Điều 1');
    assert.equal(result.response.candidates[0].groundingMetadata.groundingChunks.length, 1);
});

test('non-grounded stream never emits raw structured JSON', async () => {
    const deltas = [];
    const model = {
        generateContentStream: async () => ({
            stream: (async function* () {
                yield { text: () => '{"ans' };
                yield { text: () => 'wer":"Kết luận' };
                yield { text: () => ' cuối","citations":[{"lawName":"X"}]}' };
            })(),
            response: Promise.resolve({ text: () => '{"answer":"Kết luận cuối","citations":[]}' })
        })
    };
    await generateContentStreaming(model, {}, { grounded: false, onDelta: delta => deltas.push(delta), intervalMs: 1000 });
    assert.equal(deltas.join(''), 'Kết luận cuối');
});

test('delta batcher preserves order and reduces hundreds of tiny updates', () => {
    const emitted = [];
    const scheduled = [];
    const batcher = createDeltaBatcher({ emit: delta => emitted.push(delta), setTimer: callback => { scheduled.push(callback); return scheduled.length; }, clearTimer: () => {} });
    for (let index = 0; index < 500; index += 1) batcher.push(String(index % 10));
    assert.equal(scheduled.length, 1);
    scheduled[0]();
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].length, 500);
    assert.equal(batcher.metrics().averageBatchSize, 500);
});

test('stream consumer performs exactly one model call', async () => {
    let calls = 0;
    const model = {
        generateContentStream: async () => {
            calls += 1;
            return { stream: (async function* () {})(), response: Promise.resolve({ text: () => '' }) };
        }
    };
    await generateContentStreaming(model, {}, { grounded: true });
    assert.equal(calls, 1);
});
