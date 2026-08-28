class IncrementalAnswerParser {
    constructor() {
        this.mode = 'search';
        this.searchBuffer = '';
        this.escape = false;
        this.unicodeBuffer = null;
        this.done = false;
    }

    push(fragment) {
        if (this.done || !fragment) return '';
        let input = String(fragment);
        let output = '';

        if (this.mode === 'search') {
            this.searchBuffer += input;
            const match = /"answer"\s*:\s*"/u.exec(this.searchBuffer);
            if (!match) {
                this.searchBuffer = this.searchBuffer.slice(-32);
                return '';
            }
            input = this.searchBuffer.slice(match.index + match[0].length);
            this.searchBuffer = '';
            this.mode = 'string';
        }

        for (const character of input) {
            if (this.unicodeBuffer !== null) {
                this.unicodeBuffer += character;
                if (this.unicodeBuffer.length === 4) {
                    if (/^[0-9a-f]{4}$/iu.test(this.unicodeBuffer)) {
                        output += String.fromCharCode(Number.parseInt(this.unicodeBuffer, 16));
                    }
                    this.unicodeBuffer = null;
                    this.escape = false;
                }
                continue;
            }
            if (this.escape) {
                if (character === 'u') this.unicodeBuffer = '';
                else {
                    const escapes = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
                    output += escapes[character] ?? character;
                    this.escape = false;
                }
                continue;
            }
            if (character === '\\') {
                this.escape = true;
                continue;
            }
            if (character === '"') {
                this.done = true;
                this.mode = 'done';
                break;
            }
            output += character;
        }
        return output;
    }
}

function createDeltaBatcher({ emit, intervalMs = 40, setTimer = setTimeout, clearTimer = clearTimeout }) {
    let buffer = '';
    let timer = null;
    let emittedCharacters = 0;
    let emittedBatches = 0;

    const flush = () => {
        if (timer) clearTimer(timer);
        timer = null;
        if (!buffer) return;
        const delta = buffer;
        buffer = '';
        emittedCharacters += delta.length;
        emittedBatches += 1;
        emit(delta);
    };
    const push = delta => {
        if (!delta) return;
        buffer += delta;
        if (!timer) timer = setTimer(flush, intervalMs);
    };
    const cancel = () => {
        if (timer) clearTimer(timer);
        timer = null;
        buffer = '';
    };
    const metrics = () => ({
        emittedBatches,
        emittedCharacters,
        averageBatchSize: emittedBatches ? emittedCharacters / emittedBatches : 0
    });
    return { push, flush, cancel, metrics };
}

function isStreamTransportUnsupported(error) {
    const message = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
    return message.includes('pipethrough is not a function') ||
        message.includes('stream transport unsupported') ||
        message.includes('web stream') && message.includes('unsupported');
}

function classifyStreamFailure(error) {
    const message = `${error?.code || ''} ${error?.message || ''}`.toUpperCase();
    if (isStreamTransportUnsupported(error)) return 'STREAM_TRANSPORT_UNSUPPORTED';
    if (message.includes('TIMEOUT') || message.includes('ABORT')) return 'TIMEOUT';
    if (message.includes('429') || message.includes('QUOTA') || message.includes('RATE_LIMIT')) return 'RATE_LIMIT';
    if (message.includes('503') || message.includes('SERVICE_UNAVAILABLE')) return 'SERVICE_UNAVAILABLE';
    if (message.includes('RECITATION')) return 'RECITATION';
    return 'API_ERROR';
}

function preserveAttemptTimeout(error, options = {}) {
    if (!options.isAttemptTimedOut?.()) return error;
    if (error?.code === 'CLIENT_TIMEOUT') return error;
    const timeoutError = new Error('TIMEOUT_EXCEEDED', { cause: error });
    timeoutError.code = 'CLIENT_TIMEOUT';
    return timeoutError;
}

async function generateContentStreaming(model, request, options = {}) {
    const parser = options.grounded ? null : new IncrementalAnswerParser();
    const now = options.now || options.latency?.now || Date.now;
    const streamStarted = now();
    const transportMetrics = {
        streamAttempted: true,
        streamInitMs: null,
        firstMeaningfulChunkMs: null,
        meaningfulChunkCount: 0,
        streamFailureType: null,
        streamFailureMs: null,
        nonStreamFallbackUsed: false,
        nonStreamFallbackMs: 0,
        nativeFetch: options.nativeFetch === true
    };
    let meaningfulChunkEmitted = false;
    const emit = delta => {
        if (String(delta || '').trim()) meaningfulChunkEmitted = true;
        (options.onDelta || (() => {}))(delta);
    };
    const batcher = createDeltaBatcher({ emit, intervalMs: options.intervalMs || 40 });
    const nonStreamFallback = async reason => {
        batcher.cancel();
        transportMetrics.nonStreamFallbackUsed = true;
        options.latency?.increment('streamTransportFallbackCalls');
        const started = now();
        options.onTransportFallback?.(reason);
        try {
            const result = await model.generateContent(request, options.requestOptions);
            const elapsed = now() - started;
            transportMetrics.nonStreamFallbackMs = elapsed;
            options.latency?.add('streamTransportFallbackMs', elapsed);
            options.onTransportFallbackSuccess?.(elapsed);
            options.onTransportMetrics?.({ ...transportMetrics });
            return { response: result.response, metrics: batcher.metrics(), transportMetrics, streamingSupported: false, transportFallback: true };
        } catch (error) {
            const normalizedError = preserveAttemptTimeout(error, options);
            const elapsed = now() - started;
            transportMetrics.nonStreamFallbackMs = elapsed;
            options.latency?.add('streamTransportFallbackMs', elapsed);
            options.onTransportFallbackFailure?.(normalizedError, elapsed);
            options.onTransportMetrics?.({ ...transportMetrics });
            normalizedError.transportMetrics = { ...transportMetrics };
            throw normalizedError;
        }
    };
    try {
        if (typeof model.generateContentStream !== 'function') {
            options.onUnsupported?.();
            return await nonStreamFallback('generateContentStream_unavailable');
        }
        const result = await model.generateContentStream(request, options.requestOptions);
        // The SDK aggregate response is an independent promise. Attach a
        // rejection handler immediately: a deadline may abort the iterator and
        // let the caller move to another model before we reach `await response`.
        // Keeping the original promise preserves normal error propagation.
        const responsePromise = Promise.resolve(result.response);
        responsePromise.catch(error => {
            options.onLateStreamError?.(error, {
                attemptTimedOut: options.isAttemptTimedOut?.() === true,
                source: 'aggregate_response'
            });
        });
        transportMetrics.streamInitMs = now() - streamStarted;
        options.onStart?.(transportMetrics.streamInitMs);
        for await (const chunk of result.stream) {
            const rawDelta = chunk.text();
            const parsedDelta = parser ? parser.push(rawDelta) : rawDelta;
            if (String(parsedDelta || '').trim()) {
                transportMetrics.meaningfulChunkCount += 1;
                if (transportMetrics.firstMeaningfulChunkMs === null) {
                    transportMetrics.firstMeaningfulChunkMs = now() - streamStarted;
                    options.onFirstMeaningfulChunk?.(transportMetrics.firstMeaningfulChunkMs);
                }
            }
            batcher.push(parsedDelta);
        }
        batcher.flush();
        const response = await responsePromise;
        options.onTransportMetrics?.({ ...transportMetrics });
        return { response, metrics: batcher.metrics(), transportMetrics, streamingSupported: true };
    } catch (error) {
        const normalizedError = preserveAttemptTimeout(error, options);
        transportMetrics.streamFailureType = classifyStreamFailure(normalizedError);
        transportMetrics.streamFailureMs = now() - streamStarted;
        if (isStreamTransportUnsupported(normalizedError) && !meaningfulChunkEmitted) {
            return nonStreamFallback('pipeThrough_unavailable');
        }
        batcher.flush();
        options.onError?.(normalizedError);
        options.onTransportMetrics?.({ ...transportMetrics });
        normalizedError.transportMetrics = { ...transportMetrics };
        throw normalizedError;
    }
}

module.exports = { IncrementalAnswerParser, createDeltaBatcher, isStreamTransportUnsupported, classifyStreamFailure, preserveAttemptTimeout, generateContentStreaming };
