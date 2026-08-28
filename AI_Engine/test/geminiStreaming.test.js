const test = require('node:test');
const assert = require('node:assert/strict');
const { IncrementalAnswerParser, createDeltaBatcher, isStreamTransportUnsupported, generateContentStreaming } = require('../src/utils/geminiStreamUtils');
const { classifyGenerationFailure } = require('../src/services/geminiService');
const { createLatencyTracker, snapshot } = require('../src/utils/latencyTracker');

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
    assert.equal(result.transportFallback, undefined);
    assert.equal(result.transportMetrics.nonStreamFallbackUsed, false);
    assert.equal(result.transportMetrics.meaningfulChunkCount, 2);
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

test('pipeThrough incompatibility retries the same model non-stream and returns its answer', async () => {
    const calls = [];
    const request = { contents: [{ role: 'user', parts: [{ text: 'same prompt' }] }], generationConfig: { temperature: 0.2 } };
    const requestOptions = { signal: {} };
    const latency = createLatencyTracker();
    const model = {
        generateContentStream: async (actualRequest, actualOptions) => {
            calls.push(['stream', actualRequest, actualOptions]);
            throw new TypeError('response.body.pipeThrough is not a function');
        },
        generateContent: async (actualRequest, actualOptions) => {
            calls.push(['non-stream', actualRequest, actualOptions]);
            return { response: { text: () => 'Câu trả lời pháp lý' } };
        }
    };
    const result = await generateContentStreaming(model, request, { grounded: false, requestOptions, latency });
    assert.deepEqual(calls.map(call => call[0]), ['stream', 'non-stream']);
    assert.equal(calls[1][1], request);
    assert.equal(calls[1][2], requestOptions);
    assert.equal(result.response.text(), 'Câu trả lời pháp lý');
    assert.equal(result.transportFallback, true);
    assert.equal(snapshot(latency, 1).streamTransportFallbackCalls, 1);
    assert.equal(result.transportMetrics.streamFailureType, 'STREAM_TRANSPORT_UNSUPPORTED');
    assert.equal(result.transportMetrics.nonStreamFallbackUsed, true);
});

test('same-model non-stream API failure is propagated for ordinary model fallback', async () => {
    const calls = [];
    const error429 = Object.assign(new Error('429 quota exceeded'), { status: 429 });
    const model = {
        generateContentStream: async () => { calls.push('stream'); throw new TypeError('response.body.pipeThrough is not a function'); },
        generateContent: async () => { calls.push('non-stream'); throw error429; }
    };
    await assert.rejects(() => generateContentStreaming(model, {}, { grounded: false }), error429);
    assert.deepEqual(calls, ['stream', 'non-stream']);
});

test('shared attempt deadline preserves TIMEOUT through inner transport fallback diagnostics', async () => {
    let deadlineExceeded = false;
    let innerFailureType;
    const model = {
        generateContentStream: async () => { throw new TypeError('response.body.pipeThrough is not a function'); },
        generateContent: async () => {
            deadlineExceeded = true;
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            throw error;
        }
    };
    await assert.rejects(() => generateContentStreaming(model, {}, {
        grounded: false,
        isAttemptTimedOut: () => deadlineExceeded,
        onTransportFallbackFailure: error => { innerFailureType = classifyGenerationFailure(error); }
    }), error => {
        assert.equal(error.code, 'CLIENT_TIMEOUT');
        assert.equal(classifyGenerationFailure(error), 'TIMEOUT');
        return true;
    });
    assert.equal(innerFailureType, 'TIMEOUT');
});

test('transport failure after meaningful emitted text never restarts generation', async () => {
    const deltas = [];
    let nonStreamCalls = 0;
    const model = {
        generateContentStream: async () => ({
            stream: (async function* () {
                yield { text: () => 'Nội dung đã gửi' };
                await new Promise(resolve => setTimeout(resolve, 10));
                throw new TypeError('response.body.pipeThrough is not a function');
            })(),
            response: Promise.resolve({ text: () => 'unused' })
        }),
        generateContent: async () => { nonStreamCalls += 1; return { response: { text: () => 'duplicate' } }; }
    };
    await assert.rejects(() => generateContentStreaming(model, {}, { grounded: true, intervalMs: 1, onDelta: delta => deltas.push(delta) }), /pipeThrough/u);
    assert.equal(deltas.join(''), 'Nội dung đã gửi');
    assert.equal(nonStreamCalls, 0);
});

test('grounded transport fallback preserves the exact grounded model and request', async () => {
    const groundedRequest = { contents: [{ role: 'user', parts: [{ text: 'grounded prompt' }] }], generationConfig: { temperature: 0.1 } };
    let receivedRequest;
    const groundedModel = {
        configuredTools: [{ googleSearch: {} }],
        generateContentStream: async () => { throw new TypeError('response.body.pipeThrough is not a function'); },
        generateContent: async request => { receivedRequest = request; return { response: { text: () => 'grounded answer', candidates: [{ groundingMetadata: {} }] } }; }
    };
    const result = await generateContentStreaming(groundedModel, groundedRequest, { grounded: true });
    assert.equal(receivedRequest, groundedRequest);
    assert.deepEqual(groundedModel.configuredTools, [{ googleSearch: {} }]);
    assert.equal(result.response.text(), 'grounded answer');
});

test('stream transport errors have a distinct classifier', () => {
    assert.equal(isStreamTransportUnsupported(new TypeError('response.body.pipeThrough is not a function')), true);
    assert.equal(isStreamTransportUnsupported(new Error('429 quota')), false);
});

test('late aggregate response rejection after AbortController cancellation is consumed', async () => {
    const controller = new AbortController();
    const diagnostics = [];
    const unhandled = [];
    const onUnhandled = reason => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
        let rejectResponse;
        const response = new Promise((_, reject) => { rejectResponse = reject; });
        const model = {
            generateContentStream: async () => ({
                stream: (async function* () {
                    await new Promise(resolve => controller.signal.addEventListener('abort', resolve, { once: true }));
                    const error = new Error('The operation was aborted');
                    error.name = 'AbortError';
                    throw error;
                })(),
                response
            })
        };
        const pending = generateContentStreaming(model, {}, {
            requestOptions: { signal: controller.signal },
            isAttemptTimedOut: () => controller.signal.aborted,
            onLateStreamError: (error, detail) => diagnostics.push({ error, detail })
        });
        await Promise.resolve();
        controller.abort();
        setImmediate(() => rejectResponse(new Error('Error reading from the stream')));
        await assert.rejects(pending, error => error.code === 'CLIENT_TIMEOUT');
        await new Promise(resolve => setImmediate(resolve));
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(unhandled.length, 0);
        assert.equal(diagnostics.length, 1);
        assert.match(diagnostics[0].error.message, /Error reading from the stream/u);
        assert.equal(diagnostics[0].detail.attemptTimedOut, true);
    } finally {
        process.off('unhandledRejection', onUnhandled);
    }
});
