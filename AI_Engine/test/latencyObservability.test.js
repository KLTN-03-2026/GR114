const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createLatencyTracker, timed, timedSync, snapshot } = require('../src/utils/latencyTracker');
const { retrieveForIssues } = require('../src/services/multiQueryRagService');

test('latency snapshot keeps nested Grounding out of exclusive other-time arithmetic', async () => {
    const tracker = createLatencyTracker();
    await timed(tracker, 'embeddingMs', async () => {});
    timedSync(tracker, 'selectorMs', () => 42);
    tracker.add('finalModelMs', 40);
    tracker.add('groundingMs', 40);
    tracker.increment('embeddingCalls');
    tracker.increment('pineconeCalls');
    const result = snapshot(tracker, 50);
    assert.equal(result.groundingMs, 40);
    assert.equal(result.finalModelMs, 40);
    assert.ok(result.otherMs >= 0 && result.otherMs <= 10);
    assert.equal(result.embeddingCalls, 1);
    assert.equal(result.pineconeCalls, 1);
});

test('latency snapshot exposes Pinecone fetch, hydration and reranker separately', () => {
    const tracker=createLatencyTracker();
    tracker.add('pineconeFetchMs',40); tracker.add('hydrationMs',45); tracker.add('rerankerMs',20); tracker.add('rerankerCandidateCount',27);
    tracker.increment('pineconeFetchCalls'); tracker.increment('rerankerCalls');
    const result=snapshot(tracker,70);
    assert.equal(result.pineconeFetchMs,40); assert.equal(result.pineconeFetchCalls,1); assert.equal(result.hydrationMs,45);
    assert.equal(result.rerankerMs,20); assert.equal(result.rerankerCalls,1); assert.equal(result.rerankerCandidateCount,27); assert.equal(result.otherMs,10);
});

test('multi-issue timing preserves issue order and records concurrency-safe local timings', async () => {
    const tracker = createLatencyTracker();
    const calls = [];
    const issues = [{ id:'Q1',query:'one' }, { id:'Q2',query:'two' }];
    const result = await retrieveForIssues(issues, {
        latency: tracker,
        ragService: { query: async query => { calls.push(query); return [{ id:query || 'fallback',dieu:'Điều 10',content:'Bộ luật dân sự',score:.8 }]; } },
        rerankEvidence: async payload => ({issues:payload.map(row=>({issueId:row.issueId,coreSelection:null,supportingSelection:null,confidence:'LOW'}))})
    });
    assert.equal(calls.length,4);
    assert.deepEqual(result.documents, []);
    assert.ok(tracker.values.retrievalWallMs >= 0);
});

test('benchmark JSON path persists latencyBreakdown without replacing latencyMs', () => {
    const source = fs.readFileSync(path.join(__dirname, '../benchmark/chatbot/pipelineAdapter.js'), 'utf8');
    assert.match(source, /latencyMs, latencyBreakdown/u);
    assert.match(source, /snapshot\(stageLatency/u);
});
