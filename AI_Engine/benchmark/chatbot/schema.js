const STATUSES = new Set(['SCORABLE', 'REVIEW_REQUIRED']);
const COMPLEXITIES = new Set(['simple', 'complex']);
const COVERAGE_VERDICTS = new Set(['SCORABLE', 'REVIEW_REQUIRED']);
const COVERAGE_CLASSIFICATIONS = new Set(['BENCHMARK_ARTIFACT']);
const COVERAGE_CAUSES = new Set(['DECOMPOSITION_TOO_BROAD','RETRIEVAL_SEMANTIC_ONLY','SELECTOR_TOO_PERMISSIVE','COVERAGE_EXISTENCE_ONLY','MERGE_TAG_PROPAGATION','TARGET_MISMATCH','FRESHNESS_ONLY','BENCHMARK_GOLD_MISMATCH','AMBIGUOUS','OTHER']);

function validateDataset(cases) {
  const errors = [];
  if (!Array.isArray(cases)) return { valid: false, errors: ['dataset must be an array'] };
  const ids = new Set();
  cases.forEach((item, index) => {
    const at = `cases[${index}]`;
    if (!item || typeof item !== 'object') return errors.push(`${at} must be an object`);
    if (!/^CASE_\d{3}$/.test(item.id || '')) errors.push(`${at}.id must match CASE_###`);
    if (ids.has(item.id)) errors.push(`${at}.id is duplicated`); else ids.add(item.id);
    if (!item.category || !item.question) errors.push(`${at} requires category and question`);
    if (!STATUSES.has(item.status)) errors.push(`${at}.status is invalid`);
    if (!item.expected || !COMPLEXITIES.has(item.expected.complexity)) errors.push(`${at}.expected.complexity is invalid`);
    if (!Array.isArray(item.expected?.issues) || item.expected.issues.some(x => !x.label || typeof x.required !== 'boolean')) errors.push(`${at}.expected.issues is invalid`);
    if (!Array.isArray(item.expected?.expectedEvidence)) errors.push(`${at}.expected.expectedEvidence must be an array`);
    if (typeof item.expected?.shouldGround !== 'boolean') errors.push(`${at}.expected.shouldGround must be boolean`);
    if (!Array.isArray(item.expected?.answerPoints)) errors.push(`${at}.expected.answerPoints must be an array`);
    const coverage = item.expected?.subjectCoverage;
    if (coverage !== undefined) {
      if (!coverage || !COVERAGE_VERDICTS.has(coverage.status)) errors.push(`${at}.expected.subjectCoverage.status is invalid`);
      if (coverage?.status === 'SCORABLE' && typeof coverage.expectedComplete !== 'boolean') errors.push(`${at}.expected.subjectCoverage.expectedComplete must be boolean when scorable`);
      if (coverage?.status === 'REVIEW_REQUIRED' && coverage.expectedComplete !== null) errors.push(`${at}.expected.subjectCoverage.expectedComplete must be null when review is required`);
      if (coverage?.classification !== undefined && !COVERAGE_CLASSIFICATIONS.has(coverage.classification)) errors.push(`${at}.expected.subjectCoverage.classification is invalid`);
      if (!Array.isArray(coverage?.diagnosticCauses) || coverage.diagnosticCauses.some(x => !COVERAGE_CAUSES.has(x))) errors.push(`${at}.expected.subjectCoverage.diagnosticCauses is invalid`);
    }
  });
  return { valid: errors.length === 0, errors };
}

module.exports = { validateDataset, COVERAGE_CAUSES };
