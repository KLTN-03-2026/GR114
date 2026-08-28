const log = require('./legalAiLogger');

const STAGES = ['decomposer', 'final', 'verifier', 'repair', 'grounding'];

function usageMetadataFrom(response) {
    const usage = response?.usageMetadata || response?.response?.usageMetadata || {};
    const cached = usage.cachedContentTokenCount ?? usage.cachedTokenCount ??
        (usage.promptTokensDetails || []).filter(item => /cache/iu.test(item?.modality || '')).reduce((sum, item) => sum + Number(item.tokenCount || 0), 0);
    return {
        inputTokens: Number(usage.promptTokenCount || 0),
        outputTokens: Number(usage.candidatesTokenCount || 0),
        thoughtTokens: Number(usage.thoughtsTokenCount || 0),
        cachedTokens: Number(cached || 0),
        totalTokens: Number(usage.totalTokenCount || 0)
    };
}

function recordCostUsage(tracker, { stage, model, response = null, latencyMs = 0, success, grounded = false, failureType = null }) {
    if (!tracker || !STAGES.includes(stage)) return null;
    const record = {
        type: 'costUsage', stage, model: model || null,
        ...usageMetadataFrom(response),
        latencyMs: Math.round(Number(latencyMs || 0)),
        success: success === true,
        failureType: success ? null : (failureType || 'API_ERROR'),
        grounded: grounded === true
    };
    tracker.detail(record);
    return record;
}

function recordFinalInputTelemetry(tracker, fields) {
    if (!tracker) return;
    tracker.detail({ type: 'finalInputCost', ...fields });
    log.line('FINAL COST INPUT', fields);
}

function summarizeCostUsage(tracker) {
    const records = (tracker?.details || []).filter(item => item?.type === 'costUsage');
    const byStage = Object.fromEntries(STAGES.map(stage => [stage, records.filter(item => item.stage === stage)]));
    const stageText = stage => {
        const rows = byStage[stage];
        if (!rows.length) return 'calls=0';
        return `calls=${rows.length},input=${rows.reduce((sum, row) => sum + row.inputTokens, 0)},output=${rows.reduce((sum, row) => sum + row.outputTokens, 0)},thought=${rows.reduce((sum, row) => sum + row.thoughtTokens, 0)},cached=${rows.reduce((sum, row) => sum + row.cachedTokens, 0)},total=${rows.reduce((sum, row) => sum + row.totalTokens, 0)}`;
    };
    const summary = {
        decomposer: stageText('decomposer'), final: stageText('final'), verifier: stageText('verifier'),
        repair: stageText('repair'), grounding: stageText('grounding'),
        totalInputTokens: records.reduce((sum, row) => sum + row.inputTokens, 0),
        totalOutputTokens: records.reduce((sum, row) => sum + row.outputTokens, 0),
        totalThoughtTokens: records.reduce((sum, row) => sum + row.thoughtTokens, 0)
    };
    return { records, byStage, summary };
}

function logCostUsageSummary(tracker) {
    const result = summarizeCostUsage(tracker);
    log.line('COST USAGE', result.summary);
    return result;
}

module.exports = { STAGES, usageMetadataFrom, recordCostUsage, recordFinalInputTelemetry, summarizeCostUsage, logCostUsageSummary };
