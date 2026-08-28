const test = require('node:test');
const assert = require('node:assert/strict');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { rerankLegalEvidence } = require('../src/services/geminiService');
const { retrieveForIssues } = require('../src/services/multiQueryRagService');

const issues = [{ issueId: 'Q1', issueText: 'Tranh chấp', factualAnchors: [], candidates: [{ candidateId: 'C1', evidenceSpans: [{ spanId: 'C1:S1', text: 'Chứng cứ' }] }] }];
const compactDecision = { issues: [{ issueId: 'Q1', coreSelection: { candidateId: 'C1', evidenceSpanIds: ['C1:S1'] }, confidence: 'HIGH' }] };
const success = (decision = compactDecision) => ({ response: { text: () => JSON.stringify(decision), candidates: [{ finishReason: 'STOP' }], usageMetadata: {} } });
const originalGetGenerativeModel = GoogleGenerativeAI.prototype.getGenerativeModel;
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
const originalDateNow = Date.now;
const envNames = ['GEMINI_API_KEY', 'GEMINI_RERANK_MODEL', 'GEMINI_RERANK_FALLBACK_MODEL', 'GEMINI_RERANK_PRIMARY_TIMEOUT_MS', 'GEMINI_RERANK_TIMEOUT_MS'];
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));

function apiError(status) { const error = new Error(`HTTP ${status}`); error.status = status; return error; }
function stubModels(behavior) {
    const calls = [];
    GoogleGenerativeAI.prototype.getGenerativeModel = function (config) {
        calls.push({ type: 'model', model: config.model });
        return { generateContent: (request, requestOptions) => {
            calls.push({ type: 'generate', model: config.model, request, requestOptions });
            return behavior(config.model, request, requestOptions, calls);
        } };
    };
    return calls;
}

test.beforeEach(() => {
    process.env.GEMINI_API_KEY = 'offline-reranker-test';
    for (const name of envNames.slice(1)) delete process.env[name];
});
test.afterEach(() => {
    GoogleGenerativeAI.prototype.getGenerativeModel = originalGetGenerativeModel;
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    Date.now = originalDateNow;
    for (const name of envNames) originalEnv[name] === undefined ? delete process.env[name] : process.env[name] = originalEnv[name];
});

test('primary success uses compact schema and never calls fallback', async () => {
    const calls = stubModels(async () => success());
    const result = await rerankLegalEvidence(issues);
    assert.deepEqual(result.issues[0], { ...compactDecision.issues[0], supportingSelection: null, rejectedCandidates: [] });
    assert.deepEqual(calls.filter(call => call.type === 'generate').map(call => call.model), ['gemini-3.5-flash']);
    const schema = calls.find(call => call.type === 'generate').request.generationConfig.responseSchema.properties.issues.items;
    assert.deepEqual(Object.keys(schema.properties), ['issueId', 'coreSelection', 'confidence']);
});

test('primary timeout aborts its request and calls Flash Lite once', async () => {
    process.env.GEMINI_RERANK_PRIMARY_TIMEOUT_MS = '10';
    process.env.GEMINI_RERANK_TIMEOUT_MS = '100';
    let primarySignal;
    const calls = stubModels((model, _request, requestOptions) => {
        if (model === 'gemini-3.5-flash') { primarySignal = requestOptions.signal; return new Promise(() => {}); }
        return Promise.resolve(success());
    });
    const result = await rerankLegalEvidence(issues);
    assert.equal(result.issues[0].coreSelection.candidateId, 'C1');
    assert.equal(primarySignal.aborted, true);
    assert.deepEqual(calls.filter(call => call.type === 'generate').map(call => call.model), ['gemini-3.5-flash', 'gemini-3.5-flash-lite']);
});

for (const [name, failedResponse] of [
    ['invalid JSON', { response: { text: () => '{"issues":[', candidates: [{ finishReason: 'STOP' }] } }],
    ['truncated JSON', { response: { text: () => '{"issues":[', candidates: [{ finishReason: 'MAX_TOKENS' }] } }]
]) {
    test(`primary ${name} calls fallback once`, async () => {
        const calls = stubModels(async model => model === 'gemini-3.5-flash' ? failedResponse : success());
        const result = await rerankLegalEvidence(issues);
        assert.equal(result.issues[0].coreSelection.candidateId, 'C1');
        assert.deepEqual(calls.filter(call => call.type === 'generate').map(call => call.model), ['gemini-3.5-flash', 'gemini-3.5-flash-lite']);
    });
}

test('primary HTTP 503 calls fallback once', async () => {
    const calls = stubModels(async model => { if (model === 'gemini-3.5-flash') throw apiError(503); return success(); });
    await rerankLegalEvidence(issues);
    assert.deepEqual(calls.filter(call => call.type === 'generate').map(call => call.model), ['gemini-3.5-flash', 'gemini-3.5-flash-lite']);
});

for (const status of [400, 401, 403]) {
    test(`primary HTTP ${status} is terminal and does not call fallback`, async () => {
        const calls = stubModels(async () => { throw apiError(status); });
        await assert.rejects(rerankLegalEvidence(issues), error => error.code === 'RERANK_UNAVAILABLE');
        assert.deepEqual(calls.filter(call => call.type === 'generate').map(call => call.model), ['gemini-3.5-flash']);
    });
}

test('primary and fallback share one 20000ms request-wide budget', async () => {
    let now = 1000;
    Date.now = () => now;
    const delays = [];
    global.setTimeout = (callback, delay) => {
        delays.push(delay);
        if (delays.length === 1) queueMicrotask(() => { now += delay; callback(); });
        return { delay };
    };
    global.clearTimeout = () => {};
    const calls = stubModels(model => model === 'gemini-3.5-flash' ? new Promise(() => {}) : Promise.resolve(success()));
    await rerankLegalEvidence(issues);
    assert.deepEqual(delays, [10000, 10000]);
    assert.equal(calls.filter(call => call.type === 'generate').length, 2);
});

test('both failures become controlled SOURCE_UNAVAILABLE at the orchestration boundary', async () => {
    const calls = stubModels(async () => { throw apiError(503); });
    await assert.rejects(rerankLegalEvidence(issues), error => error.code === 'RERANK_UNAVAILABLE');
    assert.equal(calls.filter(call => call.type === 'generate').length, 2);
    let groundingCalls = 0;
    let finalSynthesisCalls = 0;
    await assert.rejects(retrieveForIssues([{ id: 'Q1', query: 'vấn đề', legalMechanismQuery: 'cơ chế' }], {
        ragService: { query: async () => [{ id: 'law-1', doc_id: 'law', dieu: 'Điều 1', title: 'Luật', content: 'Điều 1. Nội dung.', sourceUrl: 'https://vbpl.vn/law-1', score: 0.9 }] },
        rerankEvidence: async () => { const error = new Error('RERANK_UNAVAILABLE'); error.code = 'RERANK_UNAVAILABLE'; throw error; },
        grounding: async () => { groundingCalls += 1; }, finalSynthesis: async () => { finalSynthesisCalls += 1; }
    }), error => error.code === 'SOURCE_UNAVAILABLE');
    assert.equal(groundingCalls, 0);
    assert.equal(finalSynthesisCalls, 0);
});

test('fallback decision passes the unchanged local span and issue validation', async () => {
    const document = { id: 'law-1_chunk_1', doc_id: 'law-1', dieu: 'Điều 1', title: 'Luật mẫu', content: 'Điều 1. Nghĩa vụ trực tiếp.', sourceUrl: 'https://vbpl.vn/law-1', score: 0.9 };
    stubModels(async (model, request) => {
        if (model === 'gemini-3.5-flash') throw apiError(503);
        const payload = JSON.parse(request.contents[0].parts[0].text.match(/INPUT=(.*)$/su)[1]);
        const candidateId = payload[0].candidates[0].candidateId;
        return success({ issues: [{ issueId: 'Q1', coreSelection: { candidateId, evidenceSpanIds: [`${candidateId}:S1`] }, confidence: 'HIGH' }] });
    });
    const result = await retrieveForIssues([{ id: 'Q1', query: 'nghĩa vụ', legalMechanismQuery: 'nghĩa vụ trực tiếp' }], { ragService: { query: async () => [document] }, rerankEvidence: rerankLegalEvidence });
    assert.equal(result.coverage, '1/1');
});

test('Article 134/590/155 fallback fixture remains coverage 3/3 with Grounding false', async () => {
    const fixture = [['Q1', '134', '100-2015-qh13_chunk_151'], ['Q2', '590', '91-2015-qh13_chunk_590'], ['Q3', '155', '101-2015-qh13_chunk_155']];
    stubModels(async (model, request) => {
        if (model === 'gemini-3.5-flash') throw apiError(503);
        const payload = JSON.parse(request.contents[0].parts[0].text.match(/INPUT=(.*)$/su)[1]);
        return success({ issues: payload.map(row => ({ issueId: row.issueId, coreSelection: { candidateId: row.candidates[0].candidateId, evidenceSpanIds: [`${row.candidates[0].candidateId}:S1`] }, confidence: 'HIGH' })) });
    });
    const rawIssues = fixture.map(([id, article]) => ({ id, query: `Điều ${article}`, legalMechanismQuery: `quy định Điều ${article}` }));
    const docs = Object.fromEntries(fixture.map(([id, article, docId]) => [id, { id: docId, doc_id: docId, dieu: `Điều ${article}`, title: 'Bộ luật', content: `Điều ${article}. Quy định trực tiếp.`, sourceUrl: `https://vbpl.vn/${docId}`, score: 0.9 }]));
    const result = await retrieveForIssues(rawIssues, { ragService: { query: async (_query, _topK, _latency, meta) => [docs[meta.issueId]] }, rerankEvidence: rerankLegalEvidence });
    assert.equal(result.coverage, '3/3');
    assert.equal(!result.coverageComplete || !result.targetVersionSatisfied, false);
});

test('invalid timeout environment values use 10000ms primary and 20000ms total defaults', async () => {
    process.env.GEMINI_RERANK_PRIMARY_TIMEOUT_MS = 'invalid';
    process.env.GEMINI_RERANK_TIMEOUT_MS = '-1';
    const delays = [];
    global.setTimeout = (_callback, delay) => { delays.push(delay); return {}; };
    global.clearTimeout = () => {};
    stubModels(async () => success());
    await rerankLegalEvidence(issues);
    assert.deepEqual(delays, [10000]);
});
