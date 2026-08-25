const FULLY_EXPIRED = 'Hết hiệu lực';
const NOT_YET_EFFECTIVE = 'Chưa có hiệu lực';
const log = require('../utils/legalAiLogger');
const { timedSync } = require('../utils/latencyTracker');

function normalize(value) {
    return String(value || '').normalize('NFC').toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
}

function getStatus(doc = {}) {
    return String(doc.status ?? doc.Status ?? doc.metadata?.status ?? '').normalize('NFC').trim();
}

function hasHistoricalOrVersionIntent(userQuery, target = null) {
    if (target) return true;
    const query = normalize(userQuery);
    return /\b(?:19|20)\d{2}\b/u.test(query) ||
        /\btrước đây\b|\btrước năm\b|\bluật cũ\b|\bquy định cũ\b|\blịch sử\b|\bso sánh\b[^.!?\n]{0,80}\b(?:cũ|trước|mới)\b/u.test(query);
}

function hasFutureIntent(userQuery) {
    const query = normalize(userQuery);
    return /\bchưa có hiệu lực\b|\bsắp có hiệu lực\b|\bsắp tới\b|\btương lai\b|\bkhi nào có hiệu lực\b/u.test(query);
}

function applyRagStatusPolicy(userQuery, documents, options = {}) {
    if (!Array.isArray(documents) || documents.length === 0) return documents || [];

    return timedSync(options.latency, 'statusPolicyMs', () => {

    const target = options.target || null;
    const historicalMode = hasHistoricalOrVersionIntent(userQuery, target);
    const futureMode = hasFutureIntent(userQuery);
    let expiredAllowedForExplicitTarget = 0;

    const filtered = documents.filter(doc => {
        const status = getStatus(doc);
        if (status === FULLY_EXPIRED) {
            const allowed = historicalMode && (!target || options.documentMatchesTarget?.(doc, target));
            if (allowed) expiredAllowedForExplicitTarget += 1;
            return allowed;
        }
        if (status === NOT_YET_EFFECTIVE) return futureMode || historicalMode;
        return true;
    });

    const expiredRetrieved = documents.filter(doc => getStatus(doc) === FULLY_EXPIRED).length;
    log.debug('RAG STATUS POLICY', {
        queryMode: historicalMode ? 'historical/version' : (futureMode ? 'future' : 'current'),
        expiredRetrieved,
        expiredExcluded: expiredRetrieved - expiredAllowedForExplicitTarget,
        expiredAllowedForExplicitTarget
    });
    return filtered;
    });
}

module.exports = {
    applyRagStatusPolicy,
    getStatus,
    hasHistoricalOrVersionIntent,
    hasFutureIntent
};
