const DEFAULT_MAX_MERGED_CHUNKS = 12;
const { applyRagStatusPolicy } = require('./ragStatusPolicy');
const log = require('../utils/legalAiLogger');
const { createLatencyTracker, mergeLatencyTracker, timedSync } = require('../utils/latencyTracker');

const DEFAULT_MULTI_RAG_CONCURRENCY = 2;

function getMultiRagConcurrency() {
    const configured = Number(process.env.MULTI_RAG_CONCURRENCY);
    return configured === 1 ? 1 : DEFAULT_MULTI_RAG_CONCURRENCY;
}

async function mapWithConcurrency(items, limit, operation) {
    const results = new Array(items.length);
    let nextIndex = 0;
    async function worker() {
        while (true) {
            const index = nextIndex;
            nextIndex += 1;
            if (index >= items.length) return;
            results[index] = await operation(items[index], index);
        }
    }
    const workerCount = Math.min(limit, items.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

function getMergedCap() {
    const configured = Number(process.env.MULTI_RAG_MAX_MERGED_CHUNKS);
    return Number.isInteger(configured) && configured > 0
        ? configured
        : DEFAULT_MAX_MERGED_CHUNKS;
}

function getStableIdentity(doc) {
    if (doc.id) return `chunk:${doc.id}`;
    if (doc.vector_id) return `vector:${doc.vector_id}`;
    if (doc.chunk_id) return `chunk:${doc.chunk_id}`;
    if (doc.doc_id) {
        const article = doc.dieu || doc.article || doc.article_number || '';
        const chapter = doc.chuong || doc.chapter || '';
        return `document:${doc.doc_id}:article:${article}:chapter:${chapter}`;
    }

    const metadata = doc.metadata || {};
    if (metadata.vector_id) return `vector:${metadata.vector_id}`;
    if (metadata.chunk_id) return `chunk:${metadata.chunk_id}`;
    if (metadata.doc_id) {
        const article = metadata.dieu || metadata.article || '';
        return `document:${metadata.doc_id}:article:${article}`;
    }
    return null;
}

function selectorScoreFor(doc, selectorResult, rawIndex) {
    const score = (doc.id && selectorResult.scores.find(item => item.id === doc.id)) ||
        selectorResult.scores[rawIndex];
    return score ? score.finalScore : (Number(doc.score) || 0);
}

function normalizeTargetText(value) {
    return String(value || '').normalize('NFC').toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
}

function extractLegalTarget(userQuery) {
    const query = String(userQuery || '');
    const numberMatch = query.match(/\b\d{1,3}\s*\/\s*\d{4}\s*\/\s*[A-ZĐ0-9-]+\b/iu);
    const yearMatch = query.match(/\b(?:19|20)\d{2}\b/u);
    const nameMatch = query.match(/\bLuật\s+[\p{L}\s]+?(?=\s+(?:số\s+)?(?:19|20)\d{2}\b|\s+số\s+\d+\s*\/|[,.;:!?]|$)/iu);
    let name = nameMatch ? nameMatch[0].replace(/\s+/g, ' ').trim().replace(/\s+năm$/iu, '') : '';
    if (normalizeTargetText(name) === 'luật số') name = '';
    if (!numberMatch && !(name && yearMatch)) return null;
    return {
        name,
        year: numberMatch ? (numberMatch[0].match(/\b(?:19|20)\d{2}\b/u) || [''])[0] : yearMatch[0],
        number: numberMatch ? numberMatch[0].replace(/\s+/g, '').toUpperCase() : ''
    };
}

function documentMatchesTarget(doc, target) {
    if (!target) return false;
    const text = normalizeTargetText(JSON.stringify(doc || {}));
    const compactText = text.replace(/\s+/g, '');
    const nameMatches = !target.name || text.includes(normalizeTargetText(target.name));
    const numberMatches = !target.number || compactText.includes(normalizeTargetText(target.number).replace(/\s+/g, ''));
    const yearMatches = !target.year || text.includes(target.year);
    return nameMatches && numberMatches && yearMatches;
}

function resolveIssueTarget(issue, queryTarget, fullQuery = '') {
    const issueTarget = extractLegalTarget(issue?.query || '');
    if (issueTarget?.number) return { name: '', year: '', number: issueTarget.number };
    if (issueTarget) return issueTarget;
    const explicitNumbers = String(fullQuery).match(/\b\d{1,3}\s*\/\s*\d{4}\s*\/\s*[A-ZĐ0-9-]+\b/giu) || [];
    if (explicitNumbers.length > 1) return null;
    return queryTarget?.number ? { name: '', year: '', number: queryTarget.number } : queryTarget;
}

function documentMatchesCoverageTarget(doc, target) {
    if (!target) return true;
    if (!target.number) return documentMatchesTarget(doc, target);
    const number = normalizeTargetText(target.number).replace(/\s+/g, '');
    const canonicalNumber = number.replace(/[^a-z0-9đ]+/giu, '-').replace(/^-|-$/g, '');
    const identityText = normalizeTargetText([
        doc.documentNumber, doc.DocumentNumber, doc.lawNumber, doc.so_hieu,
        doc.doc_id, doc.id, doc.vector_id, doc.title, doc.law_name
    ].filter(Boolean).join(' '));
    const compactIdentity = identityText.replace(/\s+/g, '');
    const canonicalIdentity = identityText.replace(/[^a-z0-9đ]+/giu, '-');
    return compactIdentity.includes(number) || canonicalIdentity.includes(canonicalNumber);
}

function documentSatisfiesIssueCoverage(doc, issue, queryTarget, fullQuery = '') {
    if (!doc.supportedIssueIds?.includes(issue.id)) return false;
    const issueTarget = resolveIssueTarget(issue, queryTarget, fullQuery);
    return !issueTarget || documentMatchesCoverageTarget(doc, issueTarget);
}

async function retrieveForIssues(issues, dependencies = {}) {
    const ragService = dependencies.ragService || require('./ragService');
    const selectRagChunks = dependencies.selectRagChunks || require('./geminiService').selectRagChunks;
    const cap = dependencies.cap || getMergedCap();
    const target = dependencies.target || null;
    const statusQuery = dependencies.statusQuery || '';
    const latency = dependencies.latency || null;

    const concurrency = dependencies.concurrency === 1 ? 1 : getMultiRagConcurrency();
    const retrievalStarted = latency?.now();
    const orderedResults = await mapWithConcurrency(issues, Math.min(concurrency, DEFAULT_MULTI_RAG_CONCURRENCY), async (issue, issueIndex) => {
        log.debug('MULTI-RAG ISSUE', { id: issue.id, query: issue.query });
        const issueLatency = latency ? createLatencyTracker() : null;
        const issueStarted = issueLatency?.now();
        try {
            const retrievalQuery = target
                ? `${issue.query} ${target.name} ${target.number || target.year}`.replace(/\s+/g, ' ').trim()
                : issue.query;
            const retrievedDocs = ragService.queryWithLatency
                ? await ragService.queryWithLatency(retrievalQuery, 5, issueLatency, { issueId: issue.id, issueIndex })
                : await ragService.query(retrievalQuery, 5, issueLatency, { issueId: issue.id, issueIndex });
            const rawDocs = applyRagStatusPolicy(statusQuery || issue.query, retrievedDocs, {
                target,
                documentMatchesTarget,
                latency: issueLatency
            });
            let selectorResult;
            try {
                const matchingDocs = target ? rawDocs.filter(doc => documentMatchesTarget(doc, target)) : [];
                selectorResult = timedSync(issueLatency, 'selectorMs', () => selectRagChunks(issue.query, matchingDocs.length > 0 ? matchingDocs : rawDocs, { issueId: issue.id, issueIndex }));
                if (target) {
                    log.debug('MULTI-RAG TARGET', { id: issue.id, matchedTarget: matchingDocs.length, selectedOlder: matchingDocs.length > 0 ? 0 : selectorResult.selectedDocs.length });
                }
            } catch (error) {
                console.error(`[MULTI-RAG SELECTOR FAILURE] ${issue.id}: ${error.message}`);
                return { success: false, issue, issueLatency, totalRetrievalMs: issueLatency ? issueLatency.now() - issueStarted : 0 };
            }
            log.line(`RAG ${issue.id}`, {
                topK: rawDocs.length,
                selected: selectorResult.selectedDocs.length,
                topScore: rawDocs.length ? Number(rawDocs[0].score || 0).toFixed(3) : 'N/A'
            });
            log.debug(`RAG ${issue.id} DETAILS`, {
                selectedIds: selectorResult.selectedDocs.map(doc => doc.id).join(',') || 'none',
                selectorReason: selectorResult.reason
            });
            return { success: true, issue, rawDocs, selectorResult, issueLatency, totalRetrievalMs: issueLatency ? issueLatency.now() - issueStarted : 0 };
        } catch (error) {
            console.error(`[MULTI-RAG RETRIEVAL FAILURE] ${issue.id}: ${error.message}`);
            return { success: false, issue, issueLatency, totalRetrievalMs: issueLatency ? issueLatency.now() - issueStarted : 0 };
        }
    });

    const successfulIssues = orderedResults.filter(result => result.success);
    const failedIssueCount = orderedResults.length - successfulIssues.length;
    if (latency) {
        for (const result of orderedResults) {
            mergeLatencyTracker(latency, result.issueLatency);
            const detail = {
                issueId: result.issue.id,
                embeddingMs: Math.round(result.issueLatency?.values.embeddingMs || 0),
                pineconeMs: Math.round(result.issueLatency?.values.pineconeMs || 0),
                statusMs: Math.round(result.issueLatency?.values.statusPolicyMs || 0),
                selectorMs: Math.round(result.issueLatency?.values.selectorMs || 0),
                totalRetrievalMs: Math.round(result.totalRetrievalMs),
                totalMs: Math.round(result.totalRetrievalMs)
            };
            latency.detail(detail);
        }
        latency.add('retrievalWallMs', latency.now() - retrievalStarted);
        latency.add('retrievalWorkMs', orderedResults.reduce((sum, result) => sum + result.totalRetrievalMs, 0));
    }

    const mergeStarted = latency?.now();
    const candidates = successfulIssues.flatMap(({ issue, rawDocs, selectorResult }) =>
        selectorResult.selectedDocs.map((doc, index) => ({
            doc,
            issueId: issue.id,
            rank: index,
            relevance: selectorScoreFor(doc, selectorResult, rawDocs.indexOf(doc))
        }))
    );
    log.debug('MULTI-RAG MERGE', { preDedupe: candidates.length });

    const deduped = [];
    const byIdentity = new Map();
    for (const candidate of candidates) {
        const identity = getStableIdentity(candidate.doc);
        const existing = identity ? byIdentity.get(identity) : null;
        if (existing) {
            if (!existing.supportedIssueIds.includes(candidate.issueId)) {
                existing.supportedIssueIds.push(candidate.issueId);
            }
            existing.relevance = Math.max(existing.relevance, candidate.relevance);
            existing.rank = Math.min(existing.rank, candidate.rank);
            continue;
        }
        const item = {
            ...candidate,
            supportedIssueIds: [candidate.issueId]
        };
        deduped.push(item);
        if (identity) byIdentity.set(identity, item);
    }
    log.debug('MULTI-RAG MERGE', { postDedupe: deduped.length });

    const chosen = [];
    const chosenSet = new Set();
    for (const { issue } of successfulIssues) {
        const best = deduped
            .filter(item => item.supportedIssueIds.includes(issue.id))
            .sort((a, b) => b.relevance - a.relevance || a.rank - b.rank)[0];
        if (best && !chosenSet.has(best)) {
            chosen.push(best);
            chosenSet.add(best);
        }
    }
    const remaining = deduped
        .filter(item => !chosenSet.has(item))
        .sort((a, b) => b.relevance - a.relevance || a.rank - b.rank);
    for (const item of remaining) {
        if (chosen.length >= cap) break;
        chosen.push(item);
    }

    const documents = chosen.slice(0, cap).map(item => ({
        ...item.doc,
        supportedIssueIds: item.supportedIssueIds
    }));
    if (latency) latency.add('mergeMs', latency.now() - mergeStarted);
    const targetStarted = latency?.now();
    const coverageCounts = Object.fromEntries(issues.map(issue => [
        issue.id,
        documents.filter(doc => documentSatisfiesIssueCoverage(doc, issue, target, statusQuery)).length
    ]));
    const coverage = issues.map(issue => `${issue.id}=${coverageCounts[issue.id]}`).join(' ');
    const coveredIssueCount = Object.values(coverageCounts).filter(count => count > 0).length;
    const coverageComplete = issues.length > 0 && coveredIssueCount === issues.length;
    const targetVersionSatisfied = issues.every(issue => {
        const issueTarget = resolveIssueTarget(issue, target, statusQuery);
        return !issueTarget || documents.some(doc =>
            doc.supportedIssueIds.includes(issue.id) && documentMatchesCoverageTarget(doc, issueTarget)
        );
    });
    if (latency) latency.add('targetEvaluationMs', latency.now() - targetStarted);
    log.line('MULTI-RAG', { merged: documents.length, coverage: `${coveredIssueCount}/${issues.length}`, complete: coverageComplete });
    log.debug('MULTI-RAG DETAILS', { cap, capApplied: deduped.length > cap, coverage: coverage || 'none' });

    return { documents, successfulIssueCount: successfulIssues.length, failedIssueCount, coverage, coverageCounts, coverageComplete, targetVersionSatisfied };
}

module.exports = { retrieveForIssues, getStableIdentity, getMergedCap, getMultiRagConcurrency, extractLegalTarget, documentMatchesTarget, resolveIssueTarget, documentMatchesCoverageTarget, documentSatisfiesIssueCoverage };
