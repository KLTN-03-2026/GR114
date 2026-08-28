const {
    AUTHORITY_ROLES
} = require('./legalEvidenceEligibilityService');
const { isValidArticleIdentifier } = require('./articleIdentifierService');

function normalize(value) {
    return String(value || '')
        .normalize('NFC')
        .toLocaleLowerCase('vi-VN')
        .replace(/\\[*_`#]/g, match => match.slice(1))
        .replace(/[\p{P}\p{S}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function evidenceId(document = {}, index = 0) {
    return String(document.id || document.vector_id || document.chunk_id || document.doc_id || `E${index + 1}`);
}

function lawName(value = {}) {
    return normalize(value.lawName || value.title || value.law_name || value.documentName || value.doc_id);
}

function article(value = {}) {
    return normalize(value.dieu || value.article || value.article_number);
}

function articleMatches(citation, document) {
    const cited = article(citation);
    const supplied = article(document);
    if (!cited || !supplied) return true;
    return cited === supplied || cited.includes(supplied) || supplied.includes(cited);
}

function findCitationEvidence(citation, documents) {
    const citedId = String(citation?.evidenceId || '').trim();
    if (citedId) {
        const byId = documents.find((document, index) => evidenceId(document, index) === citedId);
        return byId && articleMatches(citation, byId) ? byId : null;
    }
    const citedLaw = lawName(citation);
    if (!citedLaw) return null;
    return documents.find(document => {
        const suppliedLaw = lawName(document);
        return suppliedLaw && (citedLaw === suppliedLaw || citedLaw.includes(suppliedLaw) || suppliedLaw.includes(citedLaw)) && articleMatches(citation, document);
    }) || null;
}

function validateLegalAnswerIntegrity({ structuredAnswer, citations = [], expectedIssues = [], documents = [], userQuery = '' } = {}) {
    const failures = [];
    const expectedIds = expectedIssues.map(issue => String(issue.id));

    for (const citation of citations) {
        if (citation?.invalidEvidenceId) {
            failures.push({ type: 'INVALID_EVIDENCE_ID', citation });
            continue;
        }
        if (!isValidArticleIdentifier(citation?.dieu || citation?.article || citation?.article_number)) {
            failures.push({ type: 'INVALID_ARTICLE_IDENTIFIER', citation });
            continue;
        }
        const document = findCitationEvidence(citation, documents);
        if (!document) {
            failures.push({ type: 'UNSUPPORTED_CITATION', citation });
            continue;
        }
        const citedIssueIds = Array.isArray(citation.supportedIssueIds) ? citation.supportedIssueIds.map(String) : [];
        const issueIds = expectedIds.length
            ? (citedIssueIds.length
                ? citedIssueIds
                : (document.supportedIssueIds || []).filter(issueId => expectedIds.includes(String(issueId))).map(String))
            : [];
        if (expectedIds.length && !issueIds.length) {
            failures.push({ type: 'CITATION_WITHOUT_ISSUE', citation });
            continue;
        }
        for (const issueId of issueIds) {
            const issue = expectedIssues.find(item => String(item.id) === issueId);
            const storedRole = document.authorityRoles?.[issueId];
            if (!issue || !document.supportedIssueIds?.includes(issueId)) {
                failures.push({ type: 'CITATION_ISSUE_MISMATCH', issueId, citation });
            } else if (storedRole === AUTHORITY_ROLES.REJECTED) {
                failures.push({ type: 'REJECTED_CITATION', issueId, citation });
            } else if (![AUTHORITY_ROLES.PRIMARY, AUTHORITY_ROLES.SUPPORTING].includes(storedRole)) {
                failures.push({ type: 'INVALID_AUTHORITY_ROLE', issueId, citation });
            }
        }
    }

    const analyzedIds = Array.isArray(structuredAnswer?.analysis)
        ? structuredAnswer.analysis.map(item => String(item?.issueId || ''))
        : [];
    for (const issueId of expectedIds) {
        if (!analyzedIds.includes(issueId)) failures.push({ type: 'MISSING_EXPECTED_ISSUE', issueId });
    }

    return { valid: failures.length === 0, failures };
}

module.exports = { validateLegalAnswerIntegrity, findCitationEvidence, articleMatches, isValidArticleIdentifier };
