const test = require('node:test');
const assert = require('node:assert/strict');

const { getFetchRuntimeCapabilities, ensureFetchRuntime } = require('../src/utils/fetchRuntime');

test('Node native WHATWG Fetch globals are capability-complete', () => {
    const capabilities = getFetchRuntimeCapabilities(globalThis);
    assert.deepEqual(capabilities, {
        fetch: true,
        headers: true,
        request: true,
        response: true,
        readableStream: true,
        pipeThrough: true
    });
});

test('capability guard preserves working native Fetch object identities', () => {
    const before = {
        fetch: globalThis.fetch,
        Headers: globalThis.Headers,
        Request: globalThis.Request,
        Response: globalThis.Response,
        ReadableStream: globalThis.ReadableStream
    };
    let polyfillLoads = 0;
    const result = ensureFetchRuntime(globalThis, { loadPolyfill: () => { polyfillLoads += 1; throw new Error('must not load'); } });
    assert.equal(result.nativeFetch, true);
    assert.equal(result.polyfillInstalled, false);
    assert.equal(polyfillLoads, 0);
    for (const [name, value] of Object.entries(before)) assert.equal(globalThis[name], value);
});

test('importing geminiService does not replace native Fetch globals', () => {
    const before = [globalThis.fetch, globalThis.Headers, globalThis.Request, globalThis.Response];
    const geminiService = require('../src/services/geminiService');
    assert.deepEqual([globalThis.fetch, globalThis.Headers, globalThis.Request, globalThis.Response], before);
    assert.equal(geminiService.fetchRuntime.nativeFetch, true);
});

test('missing legacy globals receive a scoped compatibility polyfill without replacing existing values', () => {
    const existingHeaders = function ExistingHeaders() {};
    const polyfillFetch = async () => ({ ok: true });
    polyfillFetch.Headers = function PolyfillHeaders() {};
    polyfillFetch.Request = function PolyfillRequest() {};
    polyfillFetch.Response = function PolyfillResponse() {};
    const runtime = { Headers: existingHeaders };
    const result = ensureFetchRuntime(runtime, { loadPolyfill: () => polyfillFetch });
    assert.equal(runtime.fetch, polyfillFetch);
    assert.equal(runtime.Headers, existingHeaders);
    assert.equal(runtime.Request, polyfillFetch.Request);
    assert.equal(runtime.Response, polyfillFetch.Response);
    assert.equal(result.nativeFetch, false);
    assert.equal(result.polyfillInstalled, true);
});

test('native Response bodies expose WHATWG pipeThrough without network access', async () => {
    const response = new Response(new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode('stream-ok'));
            controller.close();
        }
    }));
    assert.equal(typeof response.body.pipeThrough, 'function');
    assert.equal(await response.text(), 'stream-ok');
});
