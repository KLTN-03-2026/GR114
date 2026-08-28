const { applyRagStatusPolicy } = require('./ragStatusPolicy');
const log = require('../utils/legalAiLogger');
const { inferIssueContext, inferDocumentRegime } = require('./legalEvidenceEligibilityService');

const TOP_K = 10;
const NEIGHBOR_RADIUS = 2;
const MAX_HYDRATED_PER_ARTICLE = 5;
const MAX_HYDRATION_SEEDS_PER_ISSUE = 2;
const MAX_NEIGHBOR_IDS = 24;
const MAX_RERANK_CANDIDATES_PER_ISSUE = 10;
const DEFAULT_PINECONE_FETCH_TIMEOUT_MS = 5000;
const DEFAULT_MULTI_RAG_CONCURRENCY = 2;

function clean(value) { return String(value || '').normalize('NFC').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim(); }
function normalize(value) { return clean(value).toLocaleLowerCase('vi-VN').replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim(); }
function textOf(doc = {}) { return clean(doc.content || doc.text || doc.noi_dung_tom_tat); }
function idOf(doc = {}) { return clean(doc.id || doc.vector_id || doc.chunk_id || doc.documentId); }
function normalizeArticle(value) {
    const raw = clean(value).replace(/^(?:điều\s*)+/iu, '').trim();
    return /^\d+[a-zđ]?$/iu.test(raw) ? `Điều ${raw}` : '';
}
function articleOf(doc = {}) { return normalizeArticle(doc.dieu || doc.article || doc.article_number); }
function documentIdentity(doc = {}) { return clean(doc.documentNumber || doc.DocumentNumber || doc.lawNumber || doc.so_hieu || doc.doc_id || doc.title || doc.law_name); }
function canonicalArticle(doc = {}) { return `${normalize(documentIdentity(doc))}|${normalize(articleOf(doc))}`; }
function getStableIdentity(doc) { return idOf(doc) ? `chunk:${idOf(doc)}` : canonicalArticle(doc); }
function getMultiRagConcurrency() { return Number(process.env.MULTI_RAG_CONCURRENCY) === 1 ? 1 : DEFAULT_MULTI_RAG_CONCURRENCY; }
function getMergedCap() { return 12; }

async function mapConcurrent(items, limit, fn) {
    const results = new Array(items.length); let next = 0;
    async function worker() { while (next < items.length) { const index = next++; results[index] = await fn(items[index], index); } }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}
function compactPhrases(values) {
    const unique = [...new Map(values.map(clean).filter(Boolean).map(value => [normalize(value), value])).values()];
    return unique.filter((value, index) => !unique.some((other, otherIndex) => otherIndex !== index && normalize(other).includes(normalize(value))));
}
function buildIssueQueries(issue, userQuery = '') {
    const issueText = clean(issue.issueText || issue.query);
    const context = inferIssueContext({ ...issue, query: issueText }, userQuery || issueText);
    const suppliedAnchors = Array.isArray(issue.factualAnchors) ? issue.factualAnchors.map(clean).filter(Boolean) : [];
    const objectiveAnchors = issueText.match(/\b\d+(?:[.,]\d+)?\s*%?|\b\d+(?:[.,]\d+)?\s*(?:đồng|nghìn|triệu|tỷ|ngày|tháng|năm)\b/giu) || [];
    const factualAnchors = compactPhrases([...suppliedAnchors, ...objectiveAnchors]).slice(0, 10);
    let mechanism = clean(issue.legalMechanismQuery);
    const forbidden = /(?:https?:\/\/|\b(?:điều|article)\s+\d+\b|\b\d{1,3}\s*\/\s*\d{4}\b|_chunk_)/iu;
    if (forbidden.test(mechanism)) mechanism = '';
    const mechanismWeak = normalize(mechanism).split(' ').filter(Boolean).length < 3 || /(?:theo quy định nào|có bị làm sao không|pháp luật quy định thế nào|truy cứu trách nhiệm như thế nào)/iu.test(mechanism);
    let queryB = clean(compactPhrases([mechanism, ...factualAnchors]).join(' '));
    const numericAnchors = (issueText.match(/\b\d+(?:[.,]\d+)?\s*%?/gu) || []).map(normalize);
    const quality = value => {
        const normalized = normalize(value);
        return Boolean(normalized && normalized !== normalize(issueText) && mechanism && numericAnchors.every(anchor => normalized.includes(anchor)) && normalized.split(' ').length >= 4);
    };
    let augmentationUsed = mechanismWeak;
    if (!quality(queryB)) {
        augmentationUsed = true;
        queryB = clean(compactPhrases([mechanism, ...factualAnchors, ...numericAnchors]).join(' '));
    }
    if (normalize(queryB) === normalize(issueText)) queryB = clean([mechanism, ...objectiveAnchors].join(' '));
    return { issueText, queryA: issueText, queryB, factualAnchors, qualityGatePassed: quality(queryB), augmentationUsed, context };
}
function technicalFilter(issue, candidates) {
    const accepted = []; const seenIds = new Set(); const diagnostics = [];
    for (const candidate of candidates) {
        const doc = candidate.doc; const id = idOf(doc); const article = articleOf(doc); const content = textOf(doc);
        const regimeHint = inferDocumentRegime(doc).regime; let technicalReason = 'accepted';
        if (!id || !/^[\p{L}\p{N}_.:-]+$/u.test(id)) technicalReason = 'invalid_document_id';
        else if (!content) technicalReason = 'missing_article_text';
        else if (!article) technicalReason = 'invalid_article_metadata';
        else if (doc.sourceValid === false) technicalReason = 'invalid_source';
        else if (issue.purposeHint === 'CIVIL_DAMAGE' && regimeHint === 'STATE_COMPENSATION') technicalReason = 'incompatible_state_compensation_regime';
        else if (/(?:sửa đổi|bổ sung|thay thế)\s+(?:cụm từ|một số điều|tại)/iu.test(content) && !/(?:quy định|người|cơ quan|được|phải|không được|trách nhiệm|quyền)/iu.test(content)) technicalReason = 'wrapper_without_operative_proposition';
        if (technicalReason === 'accepted' && seenIds.has(id)) technicalReason = 'duplicate_vector_id';
        else if (technicalReason === 'accepted') { accepted.push(candidate); seenIds.add(id); }
        diagnostics.push({ candidateId: id, accepted: technicalReason === 'accepted', technicalReason, regimeHint });
        log.line('TECHNICAL FILTER', { issue: issue.id, candidateId: id, article, accepted: technicalReason === 'accepted', technicalReason, regimeHint, purposeHint: issue.purposeHint });
    }
    return { accepted, diagnostics };
}
function validateDecision(issue, pool, decision = {}) {
    const byId = new Map(pool.map(candidate => [idOf(candidate.doc), candidate]));
    const invalid = reason => ({ state: 'INVALID_RERANK_DECISION', core: null, support: null, reason, decision });
    if (decision.issueId !== issue.id) return invalid('issue_id_mismatch');
    if (decision.coreSelection == null) return { state: 'MISSING_CORE', core: null, support: null, reason: 'reranker_returned_null', decision };
    const resolveSpans = (selection, candidate) => {
        const available = new Map(buildEvidenceSpans(candidate || {}).map(span => [span.spanId, span.text]));
        const ids = Array.isArray(selection?.evidenceSpanIds) ? selection.evidenceSpanIds.map(clean) : [];
        return { ids, valid: ids.length > 0 && ids.every(id => available.has(id)), text: ids.filter(id => available.has(id)).map(id => available.get(id)).join('\n') };
    };
    const coreId = clean(decision.coreSelection.candidateId); const core = byId.get(coreId); const coreSpans = resolveSpans(decision.coreSelection, core);
    let reason = !core ? 'core_id_not_in_issue' : !articleOf(core.doc) ? 'invalid_core_article' : core.doc.sourceValid === false ? 'invalid_core_source' : !coreSpans.ids.length ? 'missing_core_span' : !coreSpans.valid ? 'invalid_core_span_id' : !['HIGH', 'MEDIUM'].includes(decision.confidence) ? 'confidence_not_sufficient' : '';
    log.line('EVIDENCE VALIDATION', { issue: issue.id, selectionRole: 'CORE', candidateId: coreId, idExists: Boolean(core), articleValid: Boolean(core && articleOf(core.doc)), sourceValid: core?.doc.sourceValid !== false, spanRequired: true, spanVerified: coreSpans.valid, sameIssue: Boolean(core), duplicate: false, confidence: decision.confidence || '', accepted: !reason, reason: reason || 'validated' });
    if (reason) return invalid(reason);
    let support = null;
    if (decision.supportingSelection != null) {
        const supportId = clean(decision.supportingSelection.candidateId);
        log.line('EVIDENCE VALIDATION', { issue: issue.id, selectionRole: 'SUPPORTING', candidateId: supportId, idExists: byId.has(supportId), articleValid: false, sourceValid: false, spanRequired: false, spanVerified: false, sameIssue: byId.has(supportId), duplicate: false, confidence: decision.confidence || '', accepted: false, reason: 'supporting_selection_ignored_core_only_flow' });
    }
    core.selectedEvidenceText = coreSpans.text;
    return { state: 'VALIDATED_CORE', core, support, reason: 'validated', decision };
}
function boundedCandidateText(doc) {
    const heading = clean([articleOf(doc), doc.articleTitle || ''].filter(Boolean).join(' - ')); const content = textOf(doc);
    return clean(`${heading}\n${content.slice(0, 2600)}`);
}
function buildEvidenceSpans(candidate) {
    const content = textOf(candidate.doc);
    return content ? [{ spanId: `${idOf(candidate.doc)}:S1`, text: content }] : [];
}
function parseNumber(value) { return Number(String(value).replace(',', '.')); }
function extractPercentageFacts(text) {
    return [...clean(text).matchAll(/(\d+(?:[.,]\d+)?)\s*%/gu)].map(match => ({ fact: `${match[1]}%`, value: parseNumber(match[1]), unit: 'PERCENT' }));
}
function extractPercentageRanges(text) {
    const source = clean(text); const ranges = []; const occupied = [];
    const add = (match, lower, upper, lowerInclusive, upperInclusive) => {
        ranges.push({ rangeText: match[0], unit: 'PERCENT', lower, upper, lowerInclusive, upperInclusive });
        occupied.push([match.index, match.index + match[0].length]);
    };
    for (const match of source.matchAll(/trên\s+(\d+(?:[.,]\d+)?)\s*%\s*(?:đến|–|—|-)\s*(\d+(?:[.,]\d+)?)\s*%/giu)) add(match, parseNumber(match[1]), parseNumber(match[2]), false, true);
    for (const match of source.matchAll(/từ\s+(\d+(?:[.,]\d+)?)\s*%\s+trở\s+lên/giu)) add(match, parseNumber(match[1]), null, true, false);
    for (const match of source.matchAll(/(?:dưới|nhỏ hơn)\s+(\d+(?:[.,]\d+)?)\s*%/giu)) add(match, null, parseNumber(match[1]), false, false);
    for (const match of source.matchAll(/(?:từ\s+)?(\d+(?:[.,]\d+)?)\s*%?\s*(?:đến|–|—|-)\s*(\d+(?:[.,]\d+)?)\s*%/giu)) {
        if (occupied.some(([start, end]) => match.index >= start && match.index < end)) continue;
        add(match, parseNumber(match[1]), parseNumber(match[2]), true, true);
    }
    return ranges.filter((range, index) => ranges.findIndex(other => other.rangeText === range.rangeText && other.lower === range.lower && other.upper === range.upper) === index);
}
function numericRelations(issueText, candidateText) {
    const facts = extractPercentageFacts(issueText); const ranges = extractPercentageRanges(candidateText); const relations = [];
    for (const fact of facts) for (const range of ranges) {
        if (fact.unit !== range.unit) continue;
        const aboveLower = range.lower == null || (range.lowerInclusive ? fact.value >= range.lower : fact.value > range.lower);
        const belowUpper = range.upper == null || (range.upperInclusive ? fact.value <= range.upper : fact.value < range.upper);
        relations.push({ fact: fact.fact, unit: fact.unit, rangeText: range.rangeText, relation: aboveLower && belowUpper ? 'WITHIN_RANGE' : 'OUTSIDE_RANGE', lower: range.lower, upper: range.upper, lowerInclusive: range.lowerInclusive, upperInclusive: range.upperInclusive });
    }
    return relations;
}
function prioritySignals(issue, candidate) {
    const retrieval = [...(candidate.ranks || []), ...(candidate.alternateRanks || [])];
    const sources = new Set(retrieval.map(item => item.querySource));
    const issueTokens = new Set(normalize(issue.issueText || issue.query).split(' ').filter(token => token.length > 2));
    const titleTokens = new Set(normalize(candidate.doc.articleTitle).split(' ').filter(token => token.length > 2));
    const lexicalOverlap = [...titleTokens].filter(token => issueTokens.has(token)).length;
    const relations = numericRelations(issue.issueText || issue.query, textOf(candidate.doc));
    return { numericWithinRange: relations.some(item => item.relation === 'WITHIN_RANGE'), lexicalOverlap, inBothQueries: sources.has('A') && sources.has('B'), bestRank: Math.min(...retrieval.map(item => Number(item.rank)).filter(Number.isFinite), Number.MAX_SAFE_INTEGER), bestScore: Math.max(0, ...retrieval.map(item => Number(item.score) || 0)), numericRelations: relations };
}
function comparePriority(left, right) {
    const a = left.prioritySignals; const b = right.prioritySignals;
    return Number(b.numericWithinRange) - Number(a.numericWithinRange) || b.lexicalOverlap - a.lexicalOverlap || Number(b.inBothQueries) - Number(a.inBothQueries) || a.bestRank - b.bestRank || b.bestScore - a.bestScore || idOf(left.doc).localeCompare(idOf(right.doc));
}
function prioritizeCandidates(issue, candidates, limit = MAX_RERANK_CANDIDATES_PER_ISSUE) {
    return candidates.map(candidate => ({ ...candidate, prioritySignals: prioritySignals(issue, candidate) })).sort(comparePriority).slice(0, limit);
}
function neighborIds(candidateId) {
    const match = clean(candidateId).match(/^(.*)_chunk_(\d+)$/u);
    if (!match) return [];
    const index = Number(match[2]); const ids = [];
    for (let offset = -NEIGHBOR_RADIUS; offset <= NEIGHBOR_RADIUS; offset += 1) {
        if (index + offset >= 0) ids.push(`${match[1]}_chunk_${index + offset}`);
    }
    return ids;
}
function beginsWithArticleHeading(candidate) {
    const article = articleOf(candidate.doc); const number = article.replace(/^Điều\s+/iu, '');
    return Boolean(number && new RegExp(`^\\s*Điều\\s+${number}(?:\\s|[.:,-])`, 'iu').test(textOf(candidate.doc)) && textOf(candidate.doc).length >= 60);
}
function getPineconeFetchTimeoutMs(value = process.env.PINECONE_FETCH_TIMEOUT_MS) {
    const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PINECONE_FETCH_TIMEOUT_MS;
}
async function hydrateArticleNeighbors(results, ragService, latency, options = {}) {
    const started = Date.now(); const requested = new Set(); const seeds = []; let eligibleGroups = 0; let skippedCompleteGroups = 0; let timedOut = false;
    for (const result of results) {
        const groups = new Map();
        for (const candidate of result.accepted) { const key = canonicalArticle(candidate.doc); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(candidate); }
        const eligible = [];
        for (const group of groups.values()) {
            if (new Set(group.map(candidate => idOf(candidate.doc))).size > 1 || group.some(beginsWithArticleHeading)) { skippedCompleteGroups += 1; continue; }
            const seed = group[0];
            if (neighborIds(idOf(seed.doc)).length && articleOf(seed.doc)) { eligibleGroups += 1; eligible.push({ ...seed, prioritySignals: prioritySignals(result.issue, seed), issueId: result.issue.id }); }
        }
        eligible.sort(comparePriority).slice(0, MAX_HYDRATION_SEEDS_PER_ISSUE).forEach(seed => seeds.push(seed));
    }
    const existingIds = new Set(results.flatMap(result => result.accepted.map(candidate => idOf(candidate.doc))));
    for (const seed of seeds) for (const id of neighborIds(idOf(seed.doc))) if (!existingIds.has(id) && requested.size < MAX_NEIGHBOR_IDS) requested.add(id);
    let fetched = [];
    if (requested.size && typeof ragService.fetchByIds === 'function') {
        const timeoutMs = getPineconeFetchTimeoutMs(options.fetchTimeoutMs);
        let timer;
        const fetchOutcome = Promise.resolve().then(() => ragService.fetchByIds([...requested], latency)).then(value => ({ value }), error => ({ error }));
        const timeoutOutcome = new Promise(resolve => { timer = setTimeout(() => resolve({ timeout: true }), timeoutMs); });
        const outcome = await Promise.race([fetchOutcome, timeoutOutcome]); clearTimeout(timer);
        timedOut = outcome.timeout === true;
        if (!timedOut && !outcome.error) fetched = Array.isArray(outcome.value) ? outcome.value : [];
        else if (outcome.error) console.error('[ARTICLE CHUNK HYDRATION FAILURE]', outcome.error.message);
    }
    let acceptedSiblingIds = 0;
    if (!timedOut) for (const seed of seeds) {
        const result = results.find(item => item.issue.id === seed.issueId); if (!result) continue;
        const currentIds = new Set(result.accepted.map(candidate => idOf(candidate.doc))); let count = 0;
        for (const sibling of fetched) {
            if (!neighborIds(idOf(seed.doc)).includes(idOf(sibling)) || currentIds.has(idOf(sibling))) continue;
            if (normalize(sibling.doc_id) !== normalize(seed.doc.doc_id) || articleOf(sibling) !== articleOf(seed.doc) || !textOf(sibling) || count >= MAX_HYDRATED_PER_ARTICLE) continue;
            result.accepted.push({ doc: { ...sibling, retrievalOrigin: 'PINECONE_NEIGHBOR_FETCH' }, ranks: [{ querySource: 'NEIGHBOR_FETCH', rank: null, score: 0 }], alternateRanks: [] }); currentIds.add(idOf(sibling)); count += 1; acceptedSiblingIds += 1;
        }
    }
    const durationMs = Date.now() - started; latency?.add('hydrationMs', durationMs);
    log.line('ARTICLE CHUNK HYDRATION', { eligibleGroups, skippedCompleteGroups, seedIds: seeds.map(seed => idOf(seed.doc)).join(','), requestedIds: requested.size, fetchedIds: fetched.length, acceptedSiblingIds, timedOut, durationMs });
}
async function retrieveForIssues(rawIssues, dependencies = {}) {
    const ragService = dependencies.ragService || require('./ragService'); const userQuery = dependencies.statusQuery || ''; const latency = dependencies.latency; const started = latency?.now?.() ?? Date.now();
    const issues = rawIssues.map(issue => { const queries = buildIssueQueries(issue, userQuery); return { ...issue, id: issue.id || issue.issueId, query: queries.issueText, issueText: queries.issueText, factualAnchors: queries.factualAnchors, purposeHint: queries.context.purpose, queries }; });
    const results = await mapConcurrent(issues, dependencies.concurrency === 1 ? 1 : getMultiRagConcurrency(), async (issue, issueIndex) => {
        log.line('RETRIEVAL QUERY', { issue: issue.id, queryA: issue.queries.queryA, queryB: issue.queries.queryB, factualAnchors: issue.factualAnchors.join('|'), qualityGatePassed: issue.queries.qualityGatePassed, augmentationUsed: issue.queries.augmentationUsed, topK: TOP_K });
        try {
            const queryResults = await Promise.all([['A', issue.queries.queryA], ['B', issue.queries.queryB]].map(async ([querySource, query]) => {
                const docs = await (ragService.queryWithLatency ? ragService.queryWithLatency(query, TOP_K, latency, { issueId: issue.id, issueIndex, querySource }) : ragService.query(query, TOP_K, latency, { issueId: issue.id, issueIndex, querySource }));
                return applyRagStatusPolicy(userQuery || issue.query, docs, { target: dependencies.target, documentMatchesTarget, latency }).map((doc, rank) => {
                    doc.dieu = articleOf(doc) || doc.dieu; const item = { doc, ranks: [{ querySource, rank: rank + 1, score: Number(doc.score) || 0 }], alternateRanks: [] };
                    log.line('RETRIEVAL RESULT', { issue: issue.id, querySource, rank: rank + 1, score: Number(doc.score) || 0, documentId: idOf(doc), article: articleOf(doc), articleTitle: clean(doc.articleTitle) }); return item;
                });
            }));
            const union = new Map(); for (const candidate of queryResults.flat()) { const key = idOf(candidate.doc); const existing = union.get(key); if (existing) existing.ranks.push(...candidate.ranks); else union.set(key, candidate); }
            return { success: true, issue, retrievedCount: queryResults.reduce((sum, rows) => sum + rows.length, 0), ...technicalFilter(issue, [...union.values()]) };
        } catch (error) { console.error(`[MULTI-RAG RETRIEVAL FAILURE] ${issue.id}: ${error.message}`); return { success: false, issue, retrievedCount: 0, accepted: [], diagnostics: [] }; }
    });
    await hydrateArticleNeighbors(results, ragService, latency, { fetchTimeoutMs: dependencies.fetchTimeoutMs });
    if (latency) latency.add('retrievalWallMs', (latency.now?.() ?? Date.now()) - started);
    for (const result of results) result.rerankCandidates = prioritizeCandidates(result.issue, result.accepted);
    const payload = results.map(result => ({ issueId: result.issue.id, issueText: result.issue.issueText, factualAnchors: result.issue.factualAnchors, issuePurposeHint: result.issue.purposeHint, candidates: result.rerankCandidates.map(candidate => ({ candidateId: idOf(candidate.doc), article: articleOf(candidate.doc), articleTitle: clean(candidate.doc.articleTitle), documentIdentity: documentIdentity(candidate.doc), documentRegimeHint: inferDocumentRegime(candidate.doc).regime, prioritySignals: candidate.prioritySignals, numericRelations: candidate.prioritySignals.numericRelations, evidenceSpans: buildEvidenceSpans(candidate), retrieval: [...candidate.ranks, ...candidate.alternateRanks] })) }));
    const rerankerStarted = latency?.now?.() ?? Date.now(); const rerankerCandidateCount = payload.reduce((sum, issue) => sum + issue.candidates.length, 0);
    latency?.increment('rerankerCalls'); latency?.add('rerankerCandidateCount', rerankerCandidateCount);
    let reranked;
    try {
        reranked = dependencies.rerankEvidence ? await dependencies.rerankEvidence(payload, { latency }) : { issues: issues.map(issue => ({ issueId: issue.id, coreSelection: null, supportingSelection: null, confidence: 'LOW', rejectedCandidates: [] })) };
    } catch (error) {
        if (error?.code !== 'RERANK_UNAVAILABLE') throw error;
        const sourceError = new Error('SOURCE_UNAVAILABLE');
        sourceError.code = 'SOURCE_UNAVAILABLE';
        throw sourceError;
    }
    latency?.add('rerankerMs', (latency?.now?.() ?? Date.now()) - rerankerStarted);
    const decisionByIssue = new Map((reranked?.issues || []).map(decision => [decision.issueId, decision])); const documents = []; const coverageCounts = {}; const coverageDetails = {}; const issueStates = {};
    for (const result of results) {
        const decision = decisionByIssue.get(result.issue.id) || { issueId: result.issue.id, coreSelection: null, supportingSelection: null, confidence: 'LOW' };
        const validation = validateDecision(result.issue, result.rerankCandidates, decision); issueStates[result.issue.id] = validation.state;
        const add = (candidate, role) => { if (!candidate) return; documents.push({ ...candidate.doc, content: candidate.selectedEvidenceText, text: candidate.selectedEvidenceText, selectedEvidenceText: candidate.selectedEvidenceText, supportedIssueIds: [result.issue.id], authorityRoles: { [result.issue.id]: role }, validationStatus: role === 'PRIMARY' ? 'VALIDATED_CORE' : 'VALIDATED_SUPPORTING', retrievalDiagnostics: [...candidate.ranks, ...candidate.alternateRanks] }); };
        add(validation.core, 'PRIMARY'); coverageCounts[result.issue.id] = validation.state === 'VALIDATED_CORE' ? 1 : 0;
        coverageDetails[result.issue.id] = { issueId: result.issue.id, retrievalCovered: result.retrievedCount > 0, authorityCovered: coverageCounts[result.issue.id] === 1, validationState: validation.state, missingReason: coverageCounts[result.issue.id] ? null : validation.reason };
        log.line('ISSUE EVIDENCE STATE', { issue: result.issue.id, retrievedCandidates: result.retrievedCount, technicalCandidates: result.accepted.length, rerankerCoreId: decision.coreSelection?.candidateId || '', validationState: validation.state, validatedCoreArticle: validation.core ? articleOf(validation.core.doc) : '', missingReason: coverageDetails[result.issue.id].missingReason || '' });
    }
    const finalByCanonical = new Map(); for (const doc of documents) { const key = canonicalArticle(doc); const existing = finalByCanonical.get(key); if (!existing) finalByCanonical.set(key, doc); else { existing.supportedIssueIds = [...new Set([...existing.supportedIssueIds, ...doc.supportedIssueIds])]; existing.authorityRoles = { ...existing.authorityRoles, ...doc.authorityRoles }; existing.retrievalDiagnostics = [...(existing.retrievalDiagnostics || []), ...(doc.retrievalDiagnostics || [])]; } }
    const finalDocuments = [...finalByCanonical.values()]; const covered = Object.values(coverageCounts).filter(Boolean).length; const missingIssueIds = issues.filter(issue => !coverageCounts[issue.id]).map(issue => issue.id);
    const targetVersionSatisfied = issues.every(issue => { const target = resolveIssueTarget(issue, dependencies.target); return !target || finalDocuments.some(doc => doc.supportedIssueIds.includes(issue.id) && documentMatchesCoverageTarget(doc, target)); });
    return { documents: finalDocuments, successfulIssueCount: results.filter(r => r.success).length, failedIssueCount: results.filter(r => !r.success).length, coverageCounts, retrievalCoverageCounts: Object.fromEntries(results.map(r => [r.issue.id, r.retrievedCount])), coverageDetails, issueStates, missingIssueIds, ragIssuesPreserved: covered, coverage: `${covered}/${issues.length}`, coverageComplete: covered === issues.length, targetVersionSatisfied, allMergedEvidenceSent: false, forensicTrace: { issues: payload } };
}
function extractLegalTarget(userQuery) { const query = clean(userQuery); const number = query.match(/\b\d{1,3}\s*\/\s*\d{4}\s*\/\s*[A-ZĐ0-9-]+\b/iu)?.[0]; const year = query.match(/\b(?:19|20)\d{2}\b/u)?.[0]; if (!number && !year) return null; return { name: '', year: number?.match(/\d{4}/)?.[0] || year, number: number ? number.replace(/\s+/g, '').toUpperCase() : '' }; }
function documentMatchesTarget(doc, target) { if (!target) return false; const value = normalize(JSON.stringify(doc)); return (!target.number || value.replace(/\s+/g, '').includes(normalize(target.number).replace(/\s+/g, ''))) && (!target.year || value.includes(target.year)); }
const resolveIssueTarget = (issue, target) => extractLegalTarget(issue.query || issue.issueText) || target;
const documentMatchesCoverageTarget = (doc, target) => !target || documentMatchesTarget(doc, target);
const documentSatisfiesIssueCoverage = (doc, issue, target) => doc.supportedIssueIds?.includes(issue.id) && doc.validationStatus === 'VALIDATED_CORE' && documentMatchesCoverageTarget(doc, resolveIssueTarget(issue, target));

module.exports = { TOP_K, NEIGHBOR_RADIUS, MAX_HYDRATION_SEEDS_PER_ISSUE, MAX_NEIGHBOR_IDS, MAX_RERANK_CANDIDATES_PER_ISSUE, DEFAULT_PINECONE_FETCH_TIMEOUT_MS, retrieveForIssues, buildIssueQueries, technicalFilter, hardFilter: technicalFilter, validateDecision, normalizeArticle, canonicalArticle, getStableIdentity, getMergedCap, getMultiRagConcurrency, extractPercentageFacts, extractPercentageRanges, numericRelations, prioritizeCandidates, getPineconeFetchTimeoutMs, extractLegalTarget, documentMatchesTarget, resolveIssueTarget, documentMatchesCoverageTarget, documentSatisfiesIssueCoverage };
