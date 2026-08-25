const { performance } = require('node:perf_hooks');
const { AsyncLocalStorage } = require('node:async_hooks');
const storage = new AsyncLocalStorage();

function createLatencyTracker() {
    const values = Object.create(null);
    const counts = Object.create(null);
    const details = [];
    return {
        now: () => performance.now(),
        add(name, milliseconds) { values[name] = (values[name] || 0) + milliseconds; },
        increment(name) { counts[name] = (counts[name] || 0) + 1; },
        detail(entry) { details.push(entry); },
        values,
        counts,
        details
    };
}

async function timed(tracker, name, operation) {
    if (!tracker) return operation();
    const started = tracker.now();
    try { return await operation(); }
    finally { tracker.add(name, tracker.now() - started); }
}

function timedSync(tracker, name, operation) {
    if (!tracker) return operation();
    const started = tracker.now();
    try { return operation(); }
    finally { tracker.add(name, tracker.now() - started); }
}

function mergeLatencyTracker(target, source) {
    if (!target || !source) return;
    for (const [name, milliseconds] of Object.entries(source.values || {})) {
        target.add(name, milliseconds);
    }
    for (const [name, count] of Object.entries(source.counts || {})) {
        for (let index = 0; index < count; index += 1) target.increment(name);
    }
}

function snapshot(tracker, totalMs) {
    const value = name => Math.round(tracker?.values[name] || 0);
    const total = Math.round(totalMs ?? tracker?.values.totalMs ?? 0);
    const exclusive = ['complexityMs','decompositionMs','embeddingMs','pineconeMs','statusPolicyMs','selectorMs','mergeMs','targetEvaluationMs','routerMs','promptBuildMs','finalModelMs','normalizationMs'];
    const measured = exclusive.reduce((sum, name) => sum + value(name), 0);
    return {
        complexityMs: value('complexityMs'), decompositionMs: value('decompositionMs'),
        embeddingMs: value('embeddingMs'), pineconeMs: value('pineconeMs'),
        statusPolicyMs: value('statusPolicyMs'), selectorMs: value('selectorMs'),
        mergeMs: value('mergeMs'), targetEvaluationMs: value('targetEvaluationMs'),
        routerMs: value('routerMs'), promptBuildMs: value('promptBuildMs'),
        groundingMs: value('groundingMs'), finalModelMs: value('finalModelMs'),
        retrievalWallMs: value('retrievalWallMs'), retrievalWorkMs: value('retrievalWorkMs'),
        normalizationMs: value('normalizationMs'), otherMs: Math.max(0, total - measured),
        totalMs: total, embeddingCalls: tracker?.counts.embeddingCalls || 0,
        pineconeCalls: tracker?.counts.pineconeCalls || 0,
        perIssue: tracker?.details || []
    };
}

function enterLatencyContext(tracker) { storage.enterWith(tracker); }
function currentLatencyTracker() { return storage.getStore() || null; }

module.exports = { createLatencyTracker, timed, timedSync, mergeLatencyTracker, snapshot, enterLatencyContext, currentLatencyTracker };
