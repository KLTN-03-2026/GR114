const test = require('node:test');
const assert = require('node:assert/strict');
const { createLatencyTracker } = require('../src/utils/latencyTracker');
const {
    usageMetadataFrom,
    recordCostUsage,
    recordFinalInputTelemetry,
    summarizeCostUsage
} = require('../src/utils/costUsageTelemetry');

test('SDK usage metadata is normalized without pricing guesses', () => {
    assert.deepEqual(usageMetadataFrom({ usageMetadata: {
        promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 7,
        cachedContentTokenCount: 30, totalTokenCount: 127
    } }), { inputTokens: 100, outputTokens: 20, thoughtTokens: 7, cachedTokens: 30, totalTokens: 127 });
});

test('request summary aggregates bounded paid stages and success metadata', () => {
    const tracker = createLatencyTracker();
    recordCostUsage(tracker, { stage: 'decomposer', model: 'gemini-lite', response: { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2, totalTokenCount: 12 } }, latencyMs: 5, success: true });
    recordCostUsage(tracker, { stage: 'final', model: 'gemini-flash', response: { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 30, thoughtsTokenCount: 4, totalTokenCount: 134 } }, latencyMs: 20, success: true });
    recordCostUsage(tracker, { stage: 'verifier', model: 'gemini-lite', latencyMs: 3, success: false, failureType: 'TIMEOUT' });
    const result = summarizeCostUsage(tracker);
    assert.equal(result.summary.totalInputTokens, 110);
    assert.equal(result.summary.totalOutputTokens, 32);
    assert.equal(result.summary.totalThoughtTokens, 4);
    assert.match(result.summary.decomposer, /calls=1,input=10/);
    assert.match(result.summary.final, /calls=1,input=100/);
    assert.match(result.summary.repair, /calls=0/);
    assert.equal(result.byStage.verifier[0].success, false);
    assert.equal(result.byStage.final[0].grounded, false);
});

test('final input telemetry contains sizes and never stores raw prompt or user content', () => {
    const tracker = createLatencyTracker();
    recordFinalInputTelemetry(tracker, {
        finalPromptChars: 5000, finalEvidenceCount: 4, mergedEvidenceCount: 4, allMergedEvidenceSent: true, primaryEvidenceCount: 2,
        supportingEvidenceCount: 2, totalEvidenceChars: 1800, issueCount: 3,
        duplicateEvidenceCount: 0, generalEvidenceCount: 0, generalEvidenceChars: 0,
        fixedSystemPromptChars: 900, fixedFinalWrapperChars: 700
    });
    const stored = tracker.details[0];
    assert.equal(stored.finalEvidenceCount, 4);
    assert.equal(stored.allMergedEvidenceSent, true);
    assert.equal(stored.primaryEvidenceCount, 2);
    assert.equal(stored.totalEvidenceChars, 1800);
    assert.equal(Object.hasOwn(stored, 'prompt'), false);
    assert.equal(Object.hasOwn(stored, 'userQuestion'), false);
    assert.equal(Object.hasOwn(stored, 'content'), false);
});

test('telemetry source contains no currency pricing constants', () => {
    const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/utils/costUsageTelemetry.js'), 'utf8');
    assert.doesNotMatch(source, /USD|VND|pricePer|costPer/iu);
});
