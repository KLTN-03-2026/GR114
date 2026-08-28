const { AUTHORITY_ROLES } = require('./legalEvidenceEligibilityService');

const DEFAULT_FINAL_EVIDENCE_CAP = 8;

function getFinalEvidenceCap(value = process.env.FINAL_EVIDENCE_CAP) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_FINAL_EVIDENCE_CAP;
}

function identity(document = {}, index = 0) {
    return String(document.id || document.vector_id || document.chunk_id || document.doc_id || `E${index + 1}`);
}

function evidenceChars(document = {}) {
    return String(document.content || document.text || '').length;
}

function score(document = {}) {
    return Number(document.finalScore ?? document.relevance ?? document.score ?? 0);
}

function sanitizeAndDeduplicate(documents = []) {
    const byId = new Map();
    documents.forEach((document, index) => {
        const cleanRoles = Object.fromEntries(Object.entries(document.authorityRoles || {})
            .filter(([, role]) => role !== AUTHORITY_ROLES.REJECTED));
        const cleanIssueIds = (document.supportedIssueIds || []).filter(issueId => document.authorityRoles?.[issueId] !== AUTHORITY_ROLES.REJECTED);
        if (!cleanIssueIds.length && Object.keys(document.authorityRoles || {}).length > 0) return;
        const key = identity(document, index);
        const clean = { ...document, supportedIssueIds: cleanIssueIds, authorityRoles: cleanRoles };
        const existing = byId.get(key);
        if (!existing) {
            byId.set(key, clean);
            return;
        }
        const mergedRoles = { ...existing.authorityRoles };
        for (const [issueId, role] of Object.entries(cleanRoles)) {
            if (role === AUTHORITY_ROLES.PRIMARY || !mergedRoles[issueId]) mergedRoles[issueId] = role;
        }
        byId.set(key, {
            ...(score(clean) > score(existing) ? clean : existing),
            supportedIssueIds: [...new Set([...existing.supportedIssueIds, ...cleanIssueIds])],
            authorityRoles: mergedRoles
        });
    });
    return [...byId.values()];
}

function optimizeFinalEvidence(documents = [], issues = [], options = {}) {
    const cap = getFinalEvidenceCap(options.cap);
    const deduped = sanitizeAndDeduplicate(documents);
    if (options.preserveVerifiedEvidence === true) {
        const coreOnly = deduped.filter(document =>
            document.validationStatus === 'VALIDATED_CORE' ||
            Object.values(document.authorityRoles || {}).includes(AUTHORITY_ROLES.PRIMARY));
        const beforeChars = documents.reduce((sum, document) => sum + evidenceChars(document), 0);
        const afterChars = coreOnly.reduce((sum, document) => sum + evidenceChars(document), 0);
        return {
            documents: coreOnly,
            telemetry: {
                beforeEvidenceCount: documents.length,
                afterEvidenceCount: coreOnly.length,
                beforeEvidenceChars: beforeChars,
                afterEvidenceChars: afterChars,
                primaryKept: coreOnly.filter(document => Object.values(document.authorityRoles || {}).includes(AUTHORITY_ROLES.PRIMARY)).length,
                supportingKept: 0,
                estimatedReductionPercent: beforeChars > 0 ? Number((((beforeChars - afterChars) / beforeChars) * 100).toFixed(2)) : 0,
                cap: issues.length * 2,
                preserveVerifiedEvidence: true
            }
        };
    }
    const selected = [];
    const selectedIds = new Set();
    const add = document => {
        const key = identity(document);
        if (selectedIds.has(key)) return;
        selectedIds.add(key);
        selected.push(document);
    };
    const primary = deduped.filter(document => Object.values(document.authorityRoles || {}).includes(AUTHORITY_ROLES.PRIMARY));
    primary.forEach(add);

    const issueIds = issues.map(issue => String(issue.id));
    const issueHasSelectedEvidence = issueId => selected.some(document =>
        document.supportedIssueIds?.includes(issueId) &&
        [AUTHORITY_ROLES.PRIMARY, AUTHORITY_ROLES.SUPPORTING].includes(document.authorityRoles?.[issueId]));
    const supportingForIssue = issueId => deduped
        .filter(document => document.supportedIssueIds?.includes(issueId) && document.authorityRoles?.[issueId] === AUTHORITY_ROLES.SUPPORTING)
        .sort((a, b) => score(b) - score(a));

    // Coverage-preserving supporting evidence is mandatory even when a strict
    // cap would otherwise leave an issue with no evidence at all.
    for (const issueId of issueIds) {
        if (!issueHasSelectedEvidence(issueId)) {
            const best = supportingForIssue(issueId)[0];
            if (best) add(best);
        }
    }

    // Optional supporting context: at most one selected SUPPORTING document
    // per issue, and only while capacity remains.
    for (const issueId of issueIds) {
        if (selected.length >= cap) break;
        const alreadyHasSupporting = selected.some(document => document.authorityRoles?.[issueId] === AUTHORITY_ROLES.SUPPORTING);
        if (alreadyHasSupporting) continue;
        const best = supportingForIssue(issueId).find(document => !selectedIds.has(identity(document)));
        if (best) add(best);
    }

    const beforeChars = documents.reduce((sum, document) => sum + evidenceChars(document), 0);
    const afterChars = selected.reduce((sum, document) => sum + evidenceChars(document), 0);
    return {
        documents: selected,
        telemetry: {
            beforeEvidenceCount: documents.length,
            afterEvidenceCount: selected.length,
            beforeEvidenceChars: beforeChars,
            afterEvidenceChars: afterChars,
            primaryKept: selected.filter(document => Object.values(document.authorityRoles || {}).includes(AUTHORITY_ROLES.PRIMARY)).length,
            supportingKept: selected.filter(document => Object.values(document.authorityRoles || {}).includes(AUTHORITY_ROLES.SUPPORTING)).length,
            estimatedReductionPercent: beforeChars > 0 ? Number((((beforeChars - afterChars) / beforeChars) * 100).toFixed(2)) : 0,
            cap
        }
    };
}

module.exports = { DEFAULT_FINAL_EVIDENCE_CAP, getFinalEvidenceCap, identity, sanitizeAndDeduplicate, optimizeFinalEvidence };
