function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9\s/.-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function labelMatches(expected, actual) {
  const a = normalize(expected); const b = normalize(actual);
  if (!a || !b) return false;
  const aa = new Set(a.split(' ')); const bb = new Set(b.split(' '));
  const overlap = [...aa].filter(x => bb.has(x)).length;
  return a === b || a.includes(b) || b.includes(a) || overlap / Math.max(aa.size, bb.size) >= 0.6;
}
function evidenceMatches(gold, doc) {
  const haystack = normalize([doc.documentNumber, doc.title, doc.lawName, doc.law_name, doc.dieu, doc.article].join(' '));
  return (!gold.documentNumber || haystack.includes(normalize(gold.documentNumber))) &&
    (!gold.article || haystack.includes(normalize(gold.article)));
}
function safeRate(n, d) { return d ? Number((n / d).toFixed(4)) : null; }
function coverageVerdict(result) {
  const gold = result.expected?.subjectCoverage;
  if (!gold) return null;
  if (gold.status === 'REVIEW_REQUIRED' || gold.expectedComplete == null) return 'AMBIGUOUS_REVIEW_REQUIRED';
  if (!!result.actual?.coverage?.coverageComplete !== gold.expectedComplete) return result.actual?.coverage?.coverageComplete ? 'REAL_FALSE_POSITIVE' : 'REAL_FALSE_MISSING';
  if (gold.classification === 'BENCHMARK_ARTIFACT') return 'BENCHMARK_ARTIFACT';
  return 'CORRECT_COVERAGE';
}
function enrichCoverageResult(result) {
  if (!result.actual?.coverage) return result;
  const gold = result.expected?.subjectCoverage;
  result.actual.coverage.expectedComplete = gold?.expectedComplete ?? null;
  result.actual.coverage.verdict = coverageVerdict(result);
  result.actual.coverage.diagnosticCauses = gold?.diagnosticCauses || [];
  return result;
}
function groundingReasonDistribution(results) {
  const counts = { coverage:0, freshness:0, targetMismatch:0, irrelevantRag:0, emptyRag:0, other:0 };
  for (const r of results.filter(x => x.actual?.grounding?.decision)) {
    const reasons = r.actual.grounding.reason || []; let classified = false;
    for (const reason of reasons) {
      if (reason === 'coverage_or_target_incomplete') {
        if (!r.actual.coverage?.coverageComplete) { counts.coverage++; classified=true; }
        if (r.actual.coverage?.targetVersionSatisfied === false) { counts.targetMismatch++; classified=true; }
        if (r.actual.coverage?.coverageComplete && r.actual.coverage?.targetVersionSatisfied !== false) { counts.other++; classified=true; }
      } else if (reason === 'current_info_with_outdated_rag_issueYear_check') { counts.freshness++; classified=true; }
      else if (reason === 'rag_irrelevant') { counts.irrelevantRag++; classified=true; }
      else if (reason === 'empty_rag') { counts.emptyRag++; classified=true; }
      else { counts.other++; classified=true; }
    }
    if (!classified) counts.other++;
  }
  return counts;
}

function calculateMetrics(results) {
  const scored = results.filter(r => r.status === 'SCORABLE' && !r.error);
  let gateOk = 0, falseSimple = 0, falseComplex = 0, requiredIssues = 0, hitIssues = 0, actualIssues = 0, matchedActual = 0;
  let requiredEvidence = 0, hitEvidence = 0, missingEvidence = 0, groundOk = 0, unnecessary = 0, missedGround = 0;
  let citationGold = 0, citationHits = 0;
  for (const r of scored) {
    const wantComplex = r.expected.complexity === 'complex';
    if (wantComplex === !!r.actual.complexity.isComplex) gateOk++; else if (wantComplex) falseSimple++; else falseComplex++;
    const goldIssues = r.expected.issues.filter(x => x.required); const gotIssues = r.actual.decomposition.issues || [];
    requiredIssues += goldIssues.length; actualIssues += gotIssues.length;
    const issueHits = goldIssues.filter(g => gotIssues.some(a => labelMatches(g.label, a.query || a.label))).length;
    hitIssues += issueHits; matchedActual += gotIssues.filter(a => goldIssues.some(g => labelMatches(g.label, a.query || a.label))).length;
    const goldEvidence = r.expected.expectedEvidence.filter(x => x.required);
    requiredEvidence += goldEvidence.length;
    const evidenceHits = goldEvidence.filter(g => (r.actual.retrieval.top5ByIssue || []).flatMap(x => x.documents).some(d => evidenceMatches(g, d))).length;
    hitEvidence += evidenceHits; missingEvidence += goldEvidence.length - evidenceHits;
    const gd = r.actual.grounding.decision;
    if (gd === r.expected.shouldGround) groundOk++; else if (gd) unnecessary++; else missedGround++;
    if (goldEvidence.length) { citationGold += goldEvidence.length; citationHits += goldEvidence.filter(g => (r.actual.final.citations || []).some(c => evidenceMatches(g, c))).length; }
  }
  const sums = key => results.reduce((n, r) => n + (r.actual?.calls?.[key] || 0), 0);
  const latencyValues = results.map(r => r.actual?.latencyMs?.total).filter(Number.isFinite);
  const tokens = ['promptTokenCount','candidatesTokenCount','totalTokenCount'].reduce((o, k) => (o[k] = results.reduce((n,r)=>n+(r.actual?.tokens?.[k]||0),0), o), {});
  const coverageRows = results.filter(r => r.expected?.subjectCoverage && !r.error);
  const coverageScorable = coverageRows.filter(r => r.expected.subjectCoverage.status === 'SCORABLE');
  const coverageCounts = Object.fromEntries(['REAL_FALSE_POSITIVE','REAL_FALSE_MISSING','BENCHMARK_ARTIFACT','AMBIGUOUS_REVIEW_REQUIRED','CORRECT_COVERAGE'].map(v => [v, coverageRows.filter(r => coverageVerdict(r) === v).length]));
  return {
    scoredCases: scored.length, reviewRequiredCases: results.filter(r => r.status === 'REVIEW_REQUIRED').length,
    complexity: { accuracy: safeRate(gateOk, scored.length), falseSimpleCount: falseSimple, falseComplexCount: falseComplex },
    decomposition: { issueRecall: safeRate(hitIssues, requiredIssues), issuePrecision: safeRate(matchedActual, actualIssues), overDecompositionCount: Math.max(0, actualIssues - matchedActual), missedRequiredIssues: requiredIssues - hitIssues },
    retrieval: { expectedDocumentRecallAt5: safeRate(hitEvidence, requiredEvidence), expectedEvidenceHitRate: safeRate(hitEvidence, requiredEvidence), missingRequiredEvidenceCount: missingEvidence },
    coverage: { rawLabeledCount:coverageRows.length, scorableCount:coverageScorable.length, actualCompleteCount:coverageRows.filter(r=>r.actual.coverage.coverageComplete).length, realFalsePositiveCount:coverageCounts.REAL_FALSE_POSITIVE, realFalseMissingCount:coverageCounts.REAL_FALSE_MISSING, benchmarkArtifactCount:coverageCounts.BENCHMARK_ARTIFACT, ambiguousReviewCount:coverageCounts.AMBIGUOUS_REVIEW_REQUIRED, correctCoverageCount:coverageCounts.CORRECT_COVERAGE, accuracy: safeRate(coverageScorable.length-coverageCounts.REAL_FALSE_POSITIVE-coverageCounts.REAL_FALSE_MISSING,coverageScorable.length) },
    grounding: { decisionAccuracy: safeRate(groundOk, scored.length), unnecessaryGroundingCount: unnecessary, missedGroundingCount: missedGround, groundingRate: safeRate(results.filter(r=>r.actual?.grounding?.decision).length, results.length), reasonDistribution:groundingReasonDistribution(results) },
    citation: { expectedDocumentCitationHitRate: safeRate(citationHits, citationGold) },
    operational: { cases: results.length, decomposerCalls: sums('decomposer'), embeddingCalls: sums('embedding'), finalGeminiCalls: sums('finalGemini'), groundingDecisions: results.filter(r=>r.actual?.grounding?.decision).length, actualGroundingCalls: sums('grounding'), averageDecomposerCallsPerQuery:safeRate(sums('decomposer'),results.length), averageEmbeddingCallsPerQuery: safeRate(sums('embedding'), results.length), averageGeminiCallsPerQuery: safeRate(sums('gemini'), results.length), averageGroundingCallsPerQuery:safeRate(sums('grounding'),results.length), averageLatencyMs: latencyValues.length ? Math.round(latencyValues.reduce((a,b)=>a+b,0)/latencyValues.length) : null, tokens }
  };
}
module.exports = { normalize, labelMatches, evidenceMatches, coverageVerdict, enrichCoverageResult, groundingReasonDistribution, calculateMetrics };
