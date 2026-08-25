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

async function generateContentStreaming(model, request, options = {}) {
    const parser = options.grounded ? null : new IncrementalAnswerParser();
    const batcher = createDeltaBatcher({ emit: options.onDelta || (() => {}), intervalMs: options.intervalMs || 40 });
    try {
        if (typeof model.generateContentStream !== 'function') {
            options.onUnsupported?.();
            const result = await model.generateContent(request, options.requestOptions);
            return { response: result.response, metrics: batcher.metrics(), streamingSupported: false };
        }
        const result = await model.generateContentStream(request, options.requestOptions);
        options.onStart?.();
        for await (const chunk of result.stream) {
            const rawDelta = chunk.text();
            batcher.push(parser ? parser.push(rawDelta) : rawDelta);
        }
        batcher.flush();
        const response = await result.response;
        return { response, metrics: batcher.metrics(), streamingSupported: true };
    } catch (error) {
        batcher.flush();
        options.onError?.(error);
        throw error;
    }
}

module.exports = { IncrementalAnswerParser, createDeltaBatcher, generateContentStreaming };
