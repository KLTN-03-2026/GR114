const crypto = require('node:crypto');
const { AUTHORITY_ROLES } = require('./legalEvidenceEligibilityService');
const { hasValidArticleMetadata } = require('./articleIdentifierService');

const FINAL_LEGAL_PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const FINAL_LEGAL_FALLBACK_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_PROMPT_SCHEMA_VERSION = 'final-legal-v1';
const MAX_CACHE_ENTRIES = 100;
const answerCache = new Map();

function originalIdentity(document = {}, index = 0) {
    return String(document.originalEvidenceId || document.id || document.vector_id || document.chunk_id || document.doc_id || `row-${index + 1}`);
}

function score(document = {}) {
    return Number(document.finalScore ?? document.relevance ?? document.score ?? 0);
}

function stableTieBreak(document, index) {
    return [originalIdentity(document, index), document.dieu || document.article || document.article_number || ''].join('\u0000');
}

function prepareDeterministicEvidence(documents = [], issues = []) {
    const eligible = documents.filter(document => hasValidArticleMetadata(document) &&
        Object.values(document.authorityRoles || {}).some(role => role === AUTHORITY_ROLES.PRIMARY || role === AUTHORITY_ROLES.SUPPORTING)
    );
    const ordered = [];
    const seen = new Set();
    const add = (document, index) => {
        const key = originalIdentity(document, index);
        if (seen.has(key)) return;
        seen.add(key);
        ordered.push(document);
    };
    for (const issue of issues) {
        eligible
            .filter(document => document.supportedIssueIds?.includes(issue.id))
            .sort((left, right) => {
                const roleRank = role => role === AUTHORITY_ROLES.PRIMARY ? 0 : 1;
                const roleDifference = roleRank(left.authorityRoles?.[issue.id]) - roleRank(right.authorityRoles?.[issue.id]);
                return roleDifference || score(right) - score(left) || stableTieBreak(left).localeCompare(stableTieBreak(right));
            })
            .forEach(add);
    }
    eligible
        .sort((left, right) => score(right) - score(left) || stableTieBreak(left).localeCompare(stableTieBreak(right)))
        .forEach(add);
    return ordered.map((document, index) => ({
        ...document,
        originalEvidenceId: originalIdentity(document, index),
        id: `E${index + 1}`
    }));
}

function evidenceHash(documents = []) {
    const stable = documents.map(document => ({
        id: document.id,
        originalEvidenceId: document.originalEvidenceId,
        title: document.title || document.law_name || '',
        article: document.dieu || document.article || document.article_number || '',
        sourceUrl: document.sourceUrl || document.source || document.protected_url || '',
        supportedIssueIds: document.supportedIssueIds || [],
        authorityRoles: document.authorityRoles || {},
        score: score(document),
        content: String(document.content || document.text || '')
    }));
    return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

function normalizeQuestion(value) {
    return String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN');
}

function buildCacheKey({ userQuestion, documents, model = FINAL_LEGAL_PRIMARY_MODEL, promptSchemaVersion = DEFAULT_PROMPT_SCHEMA_VERSION }) {
    return crypto.createHash('sha256').update(JSON.stringify({
        question: normalizeQuestion(userQuestion), evidence: evidenceHash(documents), model, promptSchemaVersion
    })).digest('hex');
}

function clone(value) { return structuredClone(value); }

function getCachedAnswer(key) {
    const value = answerCache.get(key);
    if (!value) return null;
    answerCache.delete(key);
    answerCache.set(key, value);
    return clone(value);
}

function setCachedAnswer(key, value) {
    if (answerCache.has(key)) answerCache.delete(key);
    answerCache.set(key, clone(value));
    while (answerCache.size > MAX_CACHE_ENTRIES) answerCache.delete(answerCache.keys().next().value);
}

function clearFinalAnswerCacheForTests() { answerCache.clear(); }

function resolveModelPayload(payload, documents, expectedIssues) {
    const byId = new Map(documents.map(document => [document.id, document]));
    const expectedIds = expectedIssues.map(issue => String(issue.id));
    const analysis = Array.isArray(payload?.analysis) ? payload.analysis.map(item => ({
        issueId: String(item?.issueId || ''),
        content: String(item?.text ?? item?.content ?? ''),
        evidenceIds: Array.isArray(item?.evidenceIds) ? item.evidenceIds.map(String) : []
    })) : [];
    if (analysis.length !== expectedIds.length || new Set(analysis.map(item => item.issueId)).size !== analysis.length || expectedIds.some(id => !analysis.some(item => item.issueId === id))) {
        throw new Error('Incomplete issue analysis');
    }
    const requestedIds = [...new Set([
        ...analysis.flatMap(item => item.evidenceIds),
        ...(Array.isArray(payload.legalBasisEvidenceIds) ? payload.legalBasisEvidenceIds.map(String) : [])
    ])];
    const citations = requestedIds.map(id => {
        const document = byId.get(id);
        if (!document) {
            return {
                evidenceId: id,
                lawName: `INVALID_EVIDENCE_ID:${id}`, dieu: '', khoan: '', quoteSnippet: '', sourceUrl: '',
                supportedIssueIds: analysis.filter(item => item.evidenceIds.includes(id)).map(item => item.issueId),
                invalidEvidenceId: true
            };
        }
        return {
            evidenceId: id,
            lawName: document.title || document.law_name || document.doc_id || '',
            dieu: document.dieu || document.article || document.article_number || '',
            khoan: '', quoteSnippet: '',
            sourceUrl: document.sourceUrl || document.source || document.protected_url || '',
            supportedIssueIds: (() => {
                const citedByAnalysis = analysis.filter(item => item.evidenceIds.includes(id)).map(item => item.issueId);
                return citedByAnalysis.length ? citedByAnalysis : (document.supportedIssueIds || []).filter(issueId => expectedIds.includes(String(issueId)));
            })()
        };
    });
    return {
        conclusion: String(payload.conclusion || ''),
        analysis: analysis.map(({ issueId, content }) => ({ issueId, content })),
        legalBasis: [],
        advice: String(payload.advice || ''),
        citations
    };
}

module.exports = {
    FINAL_LEGAL_PRIMARY_MODEL, FINAL_LEGAL_FALLBACK_MODEL, DEFAULT_PROMPT_SCHEMA_VERSION,
    prepareDeterministicEvidence, evidenceHash, buildCacheKey, getCachedAnswer, setCachedAnswer,
    clearFinalAnswerCacheForTests, resolveModelPayload
};
