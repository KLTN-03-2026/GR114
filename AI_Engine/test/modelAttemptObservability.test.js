const test = require('node:test');
const assert = require('node:assert/strict');

const { getActiveModel } = require('../src/services/geminiService');
const { createLatencyTracker, snapshot } = require('../src/utils/latencyTracker');

test('model A timeout falls through to model B success with a bounded attempt waterfall', async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'offline-test-key';
    const modelCalls = [];
    const genAI = {
        getGenerativeModel(config) {
            modelCalls.push(config);
            if (config.model === 'gemini-3.5-flash') {
                return { generateContentStream: async () => new Promise(() => {}) };
            }
            return {
                generateContentStream: async () => ({
                    stream: (async function* () { yield { text: () => 'answer' }; })(),
                    response: Promise.resolve({ text: () => 'model B answer', candidates: [{}] })
                })
            };
        }
    };
    let scheduled = 0;
    const latency = createLatencyTracker();
    try {
        const result = await getActiveModel(
            'offline prompt', false, [], false, false, '', null, true,
            false, {}, latency, null,
            {
                genAI,
                setTimeout(callback) {
                    scheduled += 1;
                    if (scheduled === 1) queueMicrotask(callback);
                    return { scheduled };
                },
                clearTimeout() {}
            }
        );

        assert.equal(result.text, 'model B answer');
        assert.equal(result.model, 'gemini-2.5-flash');
        assert.deepEqual(modelCalls.map(call => call.model), ['gemini-3.5-flash', 'gemini-2.5-flash']);
        const metrics = snapshot(latency, latency.values.finalModelMs);
        assert.equal(metrics.modelAttempts.length, 2);
        assert.deepEqual(metrics.modelAttempts.map(item => ({ model: item.model, failure: item.finalFailureType, success: item.success })), [
            { model: 'gemini-3.5-flash', failure: 'TIMEOUT', success: false },
            { model: 'gemini-2.5-flash', failure: null, success: true }
        ]);
        for (const attempt of metrics.modelAttempts) {
            assert.equal(typeof attempt.attemptStart, 'string');
            assert.equal(typeof attempt.attemptEnd, 'string');
            assert.equal(typeof attempt.attemptMs, 'number');
            assert.equal(typeof attempt.streamAttempted, 'boolean');
        }
        assert.ok(metrics.finalModelMs >= 0);
    } finally {
        if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = previousKey;
    }
});

test('Model A timeout consumes late SDK response rejection and Model B succeeds', async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'offline-test-key';
    const modelCalls = [];
    const unhandled = [];
    const onUnhandled = reason => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
        const genAI = {
            getGenerativeModel(config) {
                modelCalls.push(config.model);
                if (config.model === 'gemini-3.5-flash') {
                    return {
                        generateContentStream: async (_request, requestOptions) => {
                            let rejectResponse;
                            const response = new Promise((_, reject) => { rejectResponse = reject; });
                            requestOptions.signal.addEventListener('abort', () => {
                                setImmediate(() => rejectResponse(new Error('Error reading from the stream')));
                            }, { once: true });
                            return {
                                stream: (async function* () {
                                    await new Promise(resolve => requestOptions.signal.addEventListener('abort', resolve, { once: true }));
                                    const error = new Error('The operation was aborted');
                                    error.name = 'AbortError';
                                    throw error;
                                })(),
                                response
                            };
                        }
                    };
                }
                return {
                    generateContentStream: async () => ({
                        stream: (async function* () { yield { text: () => 'answer' }; })(),
                        response: Promise.resolve({ text: () => 'Model B succeeded', candidates: [{}] })
                    })
                };
            }
        };
        let timers = 0;
        const result = await getActiveModel('offline prompt', false, [], false, false, '', null, true, false, {}, createLatencyTracker(), null, {
            genAI,
            setTimeout(callback) { timers += 1; if (timers === 1) queueMicrotask(callback); return { timers }; },
            clearTimeout() {}
        });
        await new Promise(resolve => setImmediate(resolve));
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(result.text, 'Model B succeeded');
        assert.equal(result.model, 'gemini-2.5-flash');
        assert.deepEqual(modelCalls, ['gemini-3.5-flash', 'gemini-2.5-flash']);
        assert.equal(unhandled.length, 0);
    } finally {
        process.off('unhandledRejection', onUnhandled);
        if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = previousKey;
    }
});

test('grounded native stream preserves Google Search configuration without transport fallback', async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'offline-test-key';
    let modelConfig;
    const latency = createLatencyTracker();
    try {
        const result = await getActiveModel(
            'offline grounded prompt', false, [], true, false, 'offline question', null, true,
            false, {}, latency, null,
            {
                genAI: {
                    getGenerativeModel(config) {
                        modelConfig = config;
                        return {
                            generateContentStream: async () => ({
                                stream: (async function* () { yield { text: () => 'grounded answer' }; })(),
                                response: Promise.resolve({ text: () => 'grounded answer', candidates: [{}] })
                            })
                        };
                    }
                },
                setTimeout() { return {}; },
                clearTimeout() {}
            }
        );
        assert.equal(result.grounded, true);
        assert.deepEqual(modelConfig.tools, [{ googleSearch: {} }]);
        assert.equal(snapshot(latency, latency.values.finalModelMs).streamTransportFallbackCalls, 0);
        assert.equal(latency.modelAttempts[0].nonStreamFallbackUsed, false);
    } finally {
        if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = previousKey;
    }
});

test('grounded pipeThrough safety fallback reuses the same grounded model and request', async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'offline-test-key';
    let modelConfig;
    let streamRequest;
    let fallbackRequest;
    let streamOptions;
    let fallbackOptions;
    const latency = createLatencyTracker();
    try {
        const result = await getActiveModel(
            'offline grounded prompt', false, [], true, false, 'offline question', null, true,
            false, {}, latency, null,
            {
                genAI: {
                    getGenerativeModel(config) {
                        modelConfig = config;
                        return {
                            generateContentStream: async (request, options) => {
                                streamRequest = request;
                                streamOptions = options;
                                throw new TypeError('response.body.pipeThrough is not a function');
                            },
                            generateContent: async (request, options) => {
                                fallbackRequest = request;
                                fallbackOptions = options;
                                return { response: { text: () => 'grounded fallback answer', candidates: [{}] } };
                            }
                        };
                    }
                },
                setTimeout() { return {}; },
                clearTimeout() {}
            }
        );
        assert.equal(result.grounded, true);
        assert.deepEqual(modelConfig.tools, [{ googleSearch: {} }]);
        assert.equal(fallbackRequest, streamRequest);
        assert.equal(fallbackOptions, streamOptions);
        assert.equal(latency.modelAttempts[0].nonStreamFallbackUsed, true);
        assert.equal(latency.modelAttempts[0].streamFailureType, 'STREAM_TRANSPORT_UNSUPPORTED');
    } finally {
        if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = previousKey;
    }
});
