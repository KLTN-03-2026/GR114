const { performance } = require('node:perf_hooks');
const queryDecompositionService = require('../../src/services/queryDecompositionService');
const multiQueryRagService = require('../../src/services/multiQueryRagService');
const ragService = require('../../src/services/ragService');
const geminiService = require('../../src/services/geminiService');
const { applyRagStatusPolicy } = require('../../src/services/ragStatusPolicy');
const { createLatencyTracker, timedSync, snapshot, enterLatencyContext } = require('../../src/utils/latencyTracker');

function ragRelevant(question, docs) {
  if (!docs.length) return false;
  const q = question.toLowerCase();
  const numbers = q.match(/\d+[\/_-]\d+[\/_-]?[a-z0-9]*/g) || [];
  if (numbers.length) return docs.some(d => numbers.some(n => `${d.title||d.law_name||d.doc_id||''} ${d.content||d.text||''}`.toLowerCase().includes(n)));
  return docs.some(d => d.score ? d.score > 0.72 : true);
}

function groundingDecision(question, docs, allowGrounding) {
  const reasons = [];
  if (!docs.length) reasons.push('empty_rag');
  if (allowGrounding) reasons.push('coverage_or_target_incomplete');
  if (docs.length && !ragRelevant(question, docs)) reasons.push('rag_irrelevant');
  const seekingCurrent = /mới nhất|tuần này|tháng này|năm này| vừa ra |vừa ban hành|cập nhật/i.test(question);
  if (seekingCurrent && docs.length && geminiService.isRagOutdated(docs)) reasons.push('current_info_with_outdated_rag_issueYear_check');
  return { decision: reasons.length > 0, reasons };
}

function snippet(value, limit = 240) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit); }
function docView(d) { return { id: d.id || d.chunk_id || null, docId: d.doc_id || null, documentNumber: d.documentNumber || null, title: d.title || d.law_name || null, article: d.dieu || d.article || null, issueYear: d.issueYear ?? d.IssueYear ?? null, status: d.status || null, sourceUrl: d.sourceUrl || d.source || null, score: Number.isFinite(d.score) ? d.score : null }; }
function selectionMode(result) {
  if (result.fallbackAll && /ambiguous/i.test(result.reason || '')) return 'ambiguous_fallback';
  if (result.fallbackAll) return 'fallback_all';
  if (/clear local relevance/i.test(result.reason || '')) return 'clear_separation';
  return 'direct_selection';
}
function selectedEvidenceView(doc, issueId, result, candidateIndex, target) {
  const byId = doc.id && result.scores.find(score => score.id === doc.id);
  const score = byId || result.scores[candidateIndex] || {};
  const targetMatch = target ? multiQueryRagService.documentMatchesTarget(doc, target) : null;
  return { ...docView(doc), issueId, supportedIssueIds: [issueId], snippet: snippet(doc.content || doc.text || doc.noi_dung_tom_tat), selector: { pineconeScore: Number.isFinite(score.pineconeScore) ? score.pineconeScore : (Number.isFinite(doc.score) ? doc.score : null), contentScore: Number.isFinite(score.contentScore) ? score.contentScore : null, titleScore: Number.isFinite(score.titleScore) ? score.titleScore : null, articleScore: Number.isFinite(score.articleScore) ? score.articleScore : null, finalScore: Number.isFinite(score.finalScore) ? score.finalScore : null, selectionMode: selectionMode(result), reason: result.reason || null, ambiguousFallback: !!result.fallbackAll }, targetLawMatch: targetMatch, targetVersionMatch: targetMatch };
}
function mergedEvidenceView(docs, target, defaultIssueId = 'Q1') {
  return docs.map(doc => ({ ...docView(doc), supportedIssueIds:Array.isArray(doc.supportedIssueIds)?doc.supportedIssueIds:[defaultIssueId], snippet:snippet(doc.content||doc.text||doc.noi_dung_tom_tat), targetLawMatch:target?multiQueryRagService.documentMatchesTarget(doc,target):null, targetVersionMatch:target?multiQueryRagService.documentMatchesTarget(doc,target):null }));
}
function usageAdd(total, usage) { for (const k of ['promptTokenCount','candidatesTokenCount','totalTokenCount']) total[k] += usage?.[k] || 0; }

async function runCase(item, options = {}) {
  const started = performance.now();
  const stageLatency = createLatencyTracker();
  enterLatencyContext(stageLatency);
  const calls = { decomposer: 0, embedding: 0, finalGemini: 0, grounding: 0, gemini: 0 };
  const tokens = { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
  const latencyMs = {};
  const timed = async (name, fn) => { const s=performance.now(); try{return await fn();} finally{latencyMs[name]=Math.round(performance.now()-s);} };
  const analysis = await timed('complexityAndDecomposition', async () => {
    const result = await queryDecompositionService.analyzeQuery(item.question, { latency: stageLatency });
    if (result.usedModel) { calls.decomposer++; calls.gemini++; usageAdd(tokens, result.usage); }
    return result;
  });
  const target = multiQueryRagService.extractLegalTarget(item.question);
  let docs = [], observedMergedDocs = [], top5ByIssue = [], coverageCounts = {}, coverageComplete = false, targetVersionSatisfied = !target, selectedIds = [], selectorTraces = [];
  const trackedQuery = async (q, k = 5, latency = stageLatency, context = {}) => { calls.embedding++; const found = ragService.queryWithLatency ? await ragService.queryWithLatency(q, k, latency) : await ragService.query(q, k); const issueId = context.issueId || 'Q1'; top5ByIssue[context.issueIndex ?? 0] = { issueId, query: q, documents: found.slice(0,5).map(docView) }; return found; };
  const trackingRag = { query: trackedQuery, queryWithLatency: trackedQuery };
  await timed('retrieval', async () => {
    if (analysis.isComplex && analysis.issues.length) {
      const observingSelector = (query, candidates, context = {}) => {
        const issueId = context.issueId || 'Q1';
        const result = geminiService.selectRagChunks(query, candidates);
        selectorTraces[context.issueIndex ?? 0] = { issueId, query, selectionMode: selectionMode(result), reason: result.reason || null, ambiguousFallback: !!result.fallbackAll, selectedEvidence: result.selectedDocs.map(doc => selectedEvidenceView(doc, issueId, result, candidates.indexOf(doc), target)) };
        return result;
      };
      const merged = await multiQueryRagService.retrieveForIssues(analysis.issues, { ragService: trackingRag, selectRagChunks: observingSelector, target, statusQuery: item.question, latency: stageLatency });
      docs=merged.documents; observedMergedDocs=merged.documents; coverageCounts=merged.coverageCounts; coverageComplete=merged.coverageComplete; targetVersionSatisfied=merged.targetVersionSatisfied; selectedIds=docs.map(d=>d.id).filter(Boolean);
    } else {
      const raw = await trackingRag.query(item.question);
      const filtered = applyRagStatusPolicy(item.question, raw, { target, documentMatchesTarget: multiQueryRagService.documentMatchesTarget, latency: stageLatency });
      const selected = timedSync(stageLatency, 'selectorMs', () => geminiService.selectRagChunks(item.question, filtered));
      selectorTraces=[{ issueId:'Q1', query:item.question, selectionMode:selectionMode(selected), reason:selected.reason||null, ambiguousFallback:!!selected.fallbackAll, selectedEvidence:selected.selectedDocs.map(doc=>selectedEvidenceView(doc,'Q1',selected,filtered.indexOf(doc),target)) }];
      docs=filtered; observedMergedDocs=selected.selectedDocs; selectedIds=selected.selectedDocs.map(d=>d.id).filter(Boolean);
      const issue={id:'Q1',query:item.question}; const coverageDocs=selected.selectedDocs.map(doc=>({...doc,supportedIssueIds:['Q1']}));
      coverageCounts={Q1:coverageDocs.filter(doc=>multiQueryRagService.documentSatisfiesIssueCoverage(doc,issue,target,item.question)).length}; coverageComplete=coverageCounts.Q1>0; targetVersionSatisfied=!target || coverageDocs.some(d=>multiQueryRagService.documentMatchesTarget(d,target));
    }
  });
  const missingIssueIds = analysis.isComplex ? analysis.issues.filter(x=>!coverageCounts[x.id]).map(x=>x.id) : (coverageComplete?[]:['Q1']);
  const targetMismatchedIssueIds = analysis.isComplex && target ? analysis.issues.filter(issue => !docs.some(doc => {
    const issueTarget = multiQueryRagService.resolveIssueTarget(issue, target, item.question);
    return doc.supportedIssueIds?.includes(issue.id) && (!issueTarget || multiQueryRagService.documentMatchesCoverageTarget(doc, issueTarget));
  })).map(issue=>issue.id) : [];
  const allowGrounding = analysis.isComplex && (!coverageComplete || !targetVersionSatisfied);
  const routing = timedSync(stageLatency, 'routerMs', () => groundingDecision(item.question, docs, allowGrounding));
  const rescueReason = routing.reasons.includes('rag_irrelevant') ? 'rag_irrelevant' : routing.reasons.includes('current_info_with_outdated_rag_issueYear_check') ? 'rag_outdated' : 'forced';
  let groundingRescue = routing.decision && analysis.isComplex ? geminiService.buildGroundingRescuePlan({
    issues: analysis.issues.map(issue=>({...issue,target:multiQueryRagService.resolveIssueTarget(issue,target,item.question)})),
    missingIssueIds,targetMismatchedIssueIds
  }, rescueReason) : null;
  let final = { answer: '', citations: [], skippedReason: null };
  if (routing.decision && options.mode !== 'live') final.skippedReason='mock_grounding_intercept';
  else {
    if (options.mode === 'live' && routing.decision) calls.grounding++;
    calls.finalGemini++; calls.gemini++;
    const response = await timed('finalGemini', () => geminiService.generateAnswerWithGemini(item.question, docs, [], true, analysis.isComplex ? { ragAlreadySelected:true, allowGrounding, targetLaw:target, groundingContext:{issues:analysis.issues.map(issue=>({...issue,target:multiQueryRagService.resolveIssueTarget(issue,target,item.question)})),coverageCounts,coverageComplete,targetVersionSatisfied,missingIssueIds,targetMismatchedIssueIds}, latency:stageLatency } : { latency:stageLatency }));
    groundingRescue=response?.groundingRescue||groundingRescue;
    final={ answer:typeof response==='string'?response:response.answer||'', citations:Array.isArray(response?.citations)?response.citations:[], skippedReason:null };
    usageAdd(tokens, response?.usage);
  }
  latencyMs.total=Math.round(performance.now()-started);
  const latencyBreakdown = snapshot(stageLatency, performance.now()-started);
  const issueDefinitions = analysis.isComplex && analysis.issues.length ? analysis.issues : [{ id:'Q1', query:item.question }];
  const mergedEvidence = mergedEvidenceView(observedMergedDocs, target);
  const perIssue = issueDefinitions.map(issue => ({ issueId:issue.id, issueQuery:issue.query, retrievedCandidates:top5ByIssue.find(x=>x.issueId===issue.id)?.documents||[], phase2:selectorTraces.find(x=>x.issueId===issue.id)||{issueId:issue.id,selectedEvidence:[]}, finalMergedEvidence:mergedEvidence.filter(doc=>doc.supportedIssueIds.includes(issue.id)), countedAsCovered:(coverageCounts[issue.id]||0)>0 }));
  return { id:item.id, category:item.category, status:item.status, question:item.question, expected:item.expected, actual:{ complexity:{candidateComplex:analysis.candidateComplex,signals:analysis.signals,isComplex:analysis.isComplex}, decomposition:{called:analysis.usedModel,issueCount:analysis.issueCount,issues:analysis.issues}, retrieval:{top5ByIssue,selectedIds,count:docs.length,selectorTraces,mergedEvidence,perIssue}, coverage:{coverageCounts,coverageComplete,missingIssueIds,targetVersionSatisfied}, grounding:{decision:routing.decision,executed:options.mode==='live'&&routing.decision,mode:options.mode==='live'?'live':'mock',reason:routing.reasons}, groundingRescue:groundingRescue?{issueIds:groundingRescue.issueIds,fullQueryMode:groundingRescue.fullQueryMode,preservedIssueIds:groundingRescue.preservedIssueIds,rescuedIssueIds:groundingRescue.rescuedIssueIds}:null, final, calls, tokens, latencyMs, latencyBreakdown } };
}
module.exports = { runCase, groundingDecision, ragRelevant, selectionMode, selectedEvidenceView, mergedEvidenceView };
