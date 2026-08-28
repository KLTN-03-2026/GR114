const { performance } = require('node:perf_hooks');
const { AsyncLocalStorage } = require('node:async_hooks');
const storage = new AsyncLocalStorage();

function createLatencyTracker() {
    const values = Object.create(null);
    const counts = Object.create(null);
    const details = [];
    const modelAttempts = [];
    return {
        now: () => performance.now(),
        add(name, milliseconds) { values[name] = (values[name] || 0) + milliseconds; },
        increment(name) { counts[name] = (counts[name] || 0) + 1; },
        detail(entry) { details.push(entry); },
        modelAttempt(entry) { modelAttempts.push(entry); },
        values,
        counts,
        details,
        modelAttempts
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
    const exclusive = ['semanticResolverMs','complexityMs','decompositionMs','embeddingMs','pineconeMs','pineconeFetchMs','statusPolicyMs','selectorMs','mergeMs','targetEvaluationMs','routerMs','promptBuildMs','rerankerMs','finalModelMs','normalizationMs','verifierMs','repairMs'];
    const measured = exclusive.reduce((sum, name) => sum + value(name), 0);
    const verifierDetail = (tracker?.details || []).find(entry => entry?.type === 'legalVerifier');
    return {
        semanticResolverMs: value('semanticResolverMs'),
        semanticResolverCalls: tracker?.counts.semanticResolverCalls || 0,
        semanticResolverFallbackCalls: tracker?.counts.semanticResolverFallbackCalls || 0,
        streamTransportFallbackCalls: tracker?.counts.streamTransportFallbackCalls || 0,
        streamTransportFallbackMs: value('streamTransportFallbackMs'),
        complexityMs: value('complexityMs'), decompositionMs: value('decompositionMs'),
        embeddingMs: value('embeddingMs'), pineconeMs: value('pineconeMs'),
        pineconeFetchMs: value('pineconeFetchMs'), pineconeFetchCalls: tracker?.counts.pineconeFetchCalls || 0,
        hydrationMs: value('hydrationMs'), rerankerMs: value('rerankerMs'),
        rerankerCalls: tracker?.counts.rerankerCalls || 0, rerankerCandidateCount: value('rerankerCandidateCount'),
        statusPolicyMs: value('statusPolicyMs'), selectorMs: value('selectorMs'),
        mergeMs: value('mergeMs'), targetEvaluationMs: value('targetEvaluationMs'),
        routerMs: value('routerMs'), promptBuildMs: value('promptBuildMs'),
        groundingMs: value('groundingMs'), finalModelMs: value('finalModelMs'),
        retrievalWallMs: value('retrievalWallMs'), retrievalWorkMs: value('retrievalWorkMs'),
        normalizationMs: value('normalizationMs'), otherMs: Math.max(0, total - measured),
        verifierMs: value('verifierMs'), verifierCalls: tracker?.counts.verifierCalls || 0,
        verifierVerdict: verifierDetail?.verdict || null,
        repairMs: value('repairMs'), repairTriggered: (tracker?.counts.repairTriggered || 0) > 0,
        repairedIssueCount: tracker?.counts.repairedIssueCount || 0,
        totalMs: total, embeddingCalls: tracker?.counts.embeddingCalls || 0,
        pineconeCalls: tracker?.counts.pineconeCalls || 0,
        perIssue: (tracker?.details || []).filter(item => item?.issueId && !item?.type),
        modelAttempts: tracker?.modelAttempts || []
    };
}

function enterLatencyContext(tracker) { storage.enterWith(tracker); }
function currentLatencyTracker() { return storage.getStore() || null; }

module.exports = { createLatencyTracker, timed, timedSync, mergeLatencyTracker, snapshot, enterLatencyContext, currentLatencyTracker };
