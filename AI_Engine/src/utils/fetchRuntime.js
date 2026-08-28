function getFetchRuntimeCapabilities(runtime = globalThis) {
    const ReadableStreamCtor = runtime.ReadableStream;
    return {
        fetch: typeof runtime.fetch === 'function',
        headers: typeof runtime.Headers === 'function',
        request: typeof runtime.Request === 'function',
        response: typeof runtime.Response === 'function',
        readableStream: typeof ReadableStreamCtor === 'function',
        pipeThrough: typeof ReadableStreamCtor?.prototype?.pipeThrough === 'function'
    };
}

function isWhatwgFetchCapable(capabilities) {
    return capabilities.fetch && capabilities.headers && capabilities.request &&
        capabilities.response && capabilities.readableStream && capabilities.pipeThrough;
}

function ensureFetchRuntime(runtime = globalThis, options = {}) {
    const before = getFetchRuntimeCapabilities(runtime);
    if (isWhatwgFetchCapable(before)) {
        return { nativeFetch: true, polyfillInstalled: false, before, after: before };
    }

    const loadPolyfill = options.loadPolyfill || (() => require('node-fetch'));
    const polyfill = loadPolyfill();
    if (typeof runtime.fetch !== 'function') runtime.fetch = polyfill;
    if (typeof runtime.Headers !== 'function' && typeof polyfill.Headers === 'function') runtime.Headers = polyfill.Headers;
    if (typeof runtime.Request !== 'function' && typeof polyfill.Request === 'function') runtime.Request = polyfill.Request;
    if (typeof runtime.Response !== 'function' && typeof polyfill.Response === 'function') runtime.Response = polyfill.Response;

    if (typeof runtime.ReadableStream !== 'function') {
        try {
            const streamWeb = require('node:stream/web');
            if (typeof streamWeb.ReadableStream === 'function') runtime.ReadableStream = streamWeb.ReadableStream;
        } catch (_) {
            // Older runtimes can still use the existing non-stream safety fallback.
        }
    }

    const after = getFetchRuntimeCapabilities(runtime);
    return {
        nativeFetch: false,
        polyfillInstalled: true,
        before,
        after,
        whatwgFetchCapable: isWhatwgFetchCapable(after)
    };
}

module.exports = { getFetchRuntimeCapabilities, isWhatwgFetchCapable, ensureFetchRuntime };
