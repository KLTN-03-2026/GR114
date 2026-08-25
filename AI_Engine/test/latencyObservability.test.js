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

test('multi-issue timing preserves issue order and records concurrency-safe local timings', async () => {
    const tracker = createLatencyTracker();
    const calls = [];
    const issues = [{ id:'Q1',query:'one' }, { id:'Q2',query:'two' }];
    const result = await retrieveForIssues(issues, {
        latency: tracker,
        ragService: { query: async query => { calls.push(query); return [{ id:query,score:.8 }]; } },
        selectRagChunks: (_query, docs) => ({ selectedDocs:docs,scores:[],fallbackAll:false,reason:'test' })
    });
    assert.deepEqual(calls, ['one','two']);
    assert.deepEqual(result.documents.map(doc => doc.id), ['one','two']);
    assert.deepEqual(tracker.details.map(item => item.issueId), ['Q1','Q2']);
    assert.ok(tracker.details.every(item => Number.isFinite(item.embeddingMs)));
    assert.ok(tracker.details.every(item => Number.isFinite(item.pineconeMs)));
    assert.ok(tracker.details.every(item => Number.isFinite(item.statusMs)));
    assert.ok(tracker.details.every(item => Number.isFinite(item.selectorMs)));
    assert.ok(tracker.details.every(item => Number.isFinite(item.totalRetrievalMs)));
    assert.ok(tracker.values.retrievalWallMs >= 0);
    assert.ok(tracker.values.retrievalWorkMs >= tracker.values.retrievalWallMs - 5);
    assert.ok(tracker.values.selectorMs >= 0);
    assert.ok(tracker.values.mergeMs >= 0);
    assert.ok(tracker.values.targetEvaluationMs >= 0);
});

test('benchmark JSON path persists latencyBreakdown without replacing latencyMs', () => {
    const source = fs.readFileSync(path.join(__dirname, '../benchmark/chatbot/pipelineAdapter.js'), 'utf8');
    assert.match(source, /latencyMs, latencyBreakdown/u);
    assert.match(source, /snapshot\(stageLatency/u);
});
