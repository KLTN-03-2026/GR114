const DEFAULT_MAX_ESTIMATED_TOKENS = 7000;
const DEFAULT_CHARS_PER_TOKEN = 2.5;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_MAX_ITEMS_PER_BATCH = 20;
const DEFAULT_ITEM_LIMIT = 80;
const DEFAULT_ITEM_WINDOW_MS = 60000;
const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function estimateTokens(text, charsPerToken = DEFAULT_CHARS_PER_TOKEN) {
    return Math.max(1, Math.ceil(String(text || '').length / charsPerToken));
}

function createTokenBatches(chunks, options = {}) {
    const maxTokens = Number(options.maxTokens) > 0
        ? Number(options.maxTokens)
        : DEFAULT_MAX_ESTIMATED_TOKENS;
    const charsPerToken = Number(options.charsPerToken) > 0
        ? Number(options.charsPerToken)
        : DEFAULT_CHARS_PER_TOKEN;
    const maxItems = Number(options.maxItemsPerBatch) > 0
        ? Number(options.maxItemsPerBatch)
        : DEFAULT_MAX_ITEMS_PER_BATCH;
    const batches = [];
    let current = [];
    let currentTokens = 0;

    for (const chunk of chunks || []) {
        const tokens = estimateTokens(chunk?.text ?? chunk, charsPerToken);
        if (current.length && (currentTokens + tokens > maxTokens || current.length >= maxItems)) {
            batches.push(current);
            current = [];
            currentTokens = 0;
        }
        current.push(chunk);
        currentTokens += tokens;
    }
    if (current.length) batches.push(current);
    return batches;
}

function createRollingItemLimiter(options = {}) {
    const limit = Number(options.itemLimit) > 0 ? Number(options.itemLimit) : DEFAULT_ITEM_LIMIT;
    const windowMs = Number(options.windowMs) > 0 ? Number(options.windowMs) : DEFAULT_ITEM_WINDOW_MS;
    const now = options.now || Date.now;
    const sleep = options.sleep || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
    const history = [];
    return {
        async acquire(itemCount) {
            if (itemCount > limit) throw new Error(`Embedding batch item count ${itemCount} exceeds rolling-window limit ${limit}.`);
            while (true) {
                const current = now();
                while (history.length && current - history[0] >= windowMs) history.shift();
                if (history.length + itemCount <= limit) {
                    history.push(...Array(itemCount).fill(current));
                    return;
                }
                await sleep(Math.max(1, windowMs - (current - history[0])));
            }
        },
        getItemCount() {
            const current = now();
            while (history.length && current - history[0] >= windowMs) history.shift();
            return history.length;
        }
    };
}

function getStatus(error) {
    const candidates = [error?.status, error?.statusCode, error?.code, error?.response?.status];
    for (const value of candidates) {
        const status = Number(value);
        if (Number.isInteger(status)) return status;
    }
    const match = String(error?.message || '').match(/(?:^|\D)(408|429|5\d\d)(?:\D|$)/u);
    return match ? Number(match[1]) : null;
}

function parseDelay(value, now = Date.now()) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value * 1000);
    const seconds = String(value).trim().match(/^([0-9]+(?:\.[0-9]+)?)s?$/iu);
    if (seconds) return Number(seconds[1]) * 1000;
    const date = Date.parse(value);
    return Number.isNaN(date) ? null : Math.max(0, date - now);
}

function getRetryAfterMs(error) {
    const headers = error?.response?.headers || error?.headers;
    const header = typeof headers?.get === 'function'
        ? headers.get('retry-after')
        : headers?.['retry-after'] ?? headers?.['Retry-After'];
    const headerDelay = parseDelay(header);
    if (headerDelay !== null) return headerDelay;
    const containers = [error?.errorDetails, error?.details, error?.error?.details, error?.response?.data?.error?.details];
    for (const container of containers) {
        for (const detail of Array.isArray(container) ? container : (container ? [container] : [])) {
            if (String(detail?.['@type'] || detail?.type || '').includes('RetryInfo')) {
                const retryDelay = parseDelay(detail.retryDelay);
                if (retryDelay !== null) return retryDelay;
            }
        }
    }
    return null;
}

async function embedChunkBatches(chunks, embedBatch, options = {}) {
    const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : DEFAULT_MAX_RETRIES;
    const sleep = options.sleep || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
    const random = options.random || Math.random;
    const batches = createTokenBatches(chunks, options);
    const limiter = options.itemLimiter || createRollingItemLimiter(options);
    const embeddings = [];

    for (const batch of batches) {
        let attempt = 0;
        while (true) {
            try {
                await limiter.acquire(batch.length);
                const result = await embedBatch(batch);
                if (!Array.isArray(result) || result.length !== batch.length) {
                    throw new Error(`Embedding count mismatch: expected ${batch.length}, received ${result?.length || 0}`);
                }
                embeddings.push(...result);
                break;
            } catch (error) {
                const status = getStatus(error);
                if (!TRANSIENT_STATUSES.has(status) || attempt >= maxRetries) throw error;
                const retryAfter = getRetryAfterMs(error);
                const fallback = Math.min(60000, 1000 * (2 ** attempt)) * (0.5 + random());
                attempt += 1;
                await sleep(retryAfter ?? Math.max(100, Math.round(fallback)));
            }
        }
    }
    return embeddings;
}

module.exports = {
    DEFAULT_MAX_ESTIMATED_TOKENS,
    DEFAULT_MAX_RETRIES,
    DEFAULT_MAX_ITEMS_PER_BATCH,
    DEFAULT_ITEM_LIMIT,
    estimateTokens,
    createTokenBatches,
    createRollingItemLimiter,
    getRetryAfterMs,
    embedChunkBatches
};
