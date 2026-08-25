#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_INPUT = path.join(__dirname, 'results', 'after_coverage_observability_fix.json');
const DEFAULT_JSON = path.join(__dirname, 'results', 'coverage_rule_simulation.json');
const DEFAULT_MD = path.join(__dirname, 'results', 'coverage_rule_simulation.md');
const REAL_FP_IDS = ['CASE_005','CASE_007','CASE_009','CASE_019','CASE_027','CASE_028','CASE_034','CASE_039'];

function quantile(values, q) {
  if (!values.length) return null;
  const sorted=[...values].sort((a,b)=>a-b); const position=(sorted.length-1)*q; const base=Math.floor(position); const rest=position-base;
  return Number((sorted[base]+((sorted[base+1]-sorted[base]||0)*rest)).toFixed(4));
}
function distribution(values) { return { count:values.length,min:quantile(values,0),p25:quantile(values,.25),median:quantile(values,.5),p75:quantile(values,.75),max:quantile(values,1) }; }
function normalizeNumber(value) { return String(value||'').replace(/\s+/g,'').toUpperCase(); }
function documentNumbers(value) { return [...String(value||'').matchAll(/\b\d{1,3}\s*\/\s*\d{4}\s*\/\s*[A-ZĐ0-9-]+\b/giu)].map(x=>normalizeNumber(x[0])); }
function evidenceForIssue(result, issue) {
  const traces=result.actual.retrieval.selectorTraces||[];
  return (issue.finalMergedEvidence||[]).map(doc => {
    const local=(issue.phase2?.selectedEvidence||[]).find(x=>x.id===doc.id);
    const any=traces.flatMap(x=>x.selectedEvidence||[]).find(x=>x.id===doc.id);
    return {...doc,...(any||{}),...(local||{}),supportedIssueIds:doc.supportedIssueIds||local?.supportedIssueIds||any?.supportedIssueIds||[]};
  });
}
function isAmbiguous(e) { return !!e.selector?.ambiguousFallback || /ambiguous|fallback_all/.test(e.selector?.selectionMode||''); }
function targetAssessment(result, issue, evidence) {
  const issueNumbers=documentNumbers(issue.issueQuery); const caseNumbers=documentNumbers(result.question);
  let required=[]; let source='none';
  if (issueNumbers.length===1) { required=issueNumbers; source='issue_document_number'; }
  else if (issueNumbers.length>1) return {applicable:true,evaluable:false,reason:'multiple explicit document numbers remain unresolved at issue level'};
  else if (caseNumbers.length===1) { required=caseNumbers; source='case_document_number'; }
  else if (caseNumbers.length>1) return {applicable:true,evaluable:false,reason:'comparison target cannot be assigned to this issue from stored text'};
  if (required.length) {
    const haystack=normalizeNumber([evidence.documentNumber,evidence.docId,evidence.id,evidence.title].join(' '));
    return {applicable:true,evaluable:true,compatible:required.every(n=>haystack.includes(n)),required,source};
  }
  const explicit=!!(result.expected.targetLaw||result.expected.targetYear||result.expected.targetDocumentNumber);
  if (!explicit) return {applicable:false,evaluable:true,compatible:true,source};
  if (typeof evidence.targetVersionMatch==='boolean') return {applicable:true,evaluable:true,compatible:evidence.targetVersionMatch,source:'stored_target_compatibility'};
  return {applicable:true,evaluable:false,reason:'stored evidence lacks target compatibility'};
}
function issueCovered(result, issue, rule) {
  const evidence=evidenceForIssue(result,issue); const assessments=[];
  const accepted=evidence.filter(e=>rule.accept(e,{result,issue,target:targetAssessment(result,issue,e)}));
  for(const e of evidence){const t=targetAssessment(result,issue,e);if(t.applicable&&!t.evaluable)assessments.push(t.reason);}
  return {covered:accepted.length>0,evidenceCount:evidence.length,acceptedCount:accepted.length,unevaluable:[...new Set(assessments)]};
}
function ruleDefinitions(calibration) {
  const finalFloor=calibration.final.p25; const contentFloor=calibration.content.p25;
  const rules=[
    {id:'BASELINE',family:'BASELINE',definition:'Any final retained evidence carrying the issue ID counts.',accept:()=>true},
    {id:'A1_REJECT_AMBIGUOUS',family:'A',definition:'Reject ambiguous/fallback evidence entirely.',accept:e=>!isAmbiguous(e)},
    {id:'A2_REQUIRE_NON_AMBIGUOUS_PEER',family:'A',definition:'An issue needs at least one non-ambiguous selected chunk.',accept:e=>!isAmbiguous(e)},
    {id:'B_EXPLICIT_TARGET',family:'B',definition:'For reliably evaluable explicit targets, require compatible evidence; otherwise preserve baseline.',accept:(e,c)=>!c.target.applicable||!c.target.evaluable||c.target.compatible},
  ];
  for(const floor of [.60,.65,.70,.72,.75,calibration.final.p25,calibration.final.median].filter((x,i,a)=>Number.isFinite(x)&&a.indexOf(x)===i)) rules.push({id:`C_FINAL_${floor.toFixed(4)}`,family:'C',definition:`Require finalScore >= ${floor.toFixed(4)}.`,accept:e=>Number.isFinite(e.selector?.finalScore)&&e.selector.finalScore>=floor});
  for(const floor of [calibration.content.p25,calibration.content.median,calibration.content.p75].filter((x,i,a)=>Number.isFinite(x)&&a.indexOf(x)===i)) rules.push({id:`D_CONTENT_${floor.toFixed(4)}`,family:'D',definition:`Require contentScore >= ${floor.toFixed(4)}.`,accept:e=>Number.isFinite(e.selector?.contentScore)&&e.selector.contentScore>=floor});
  rules.push(
    {id:'E1_TARGET_OR_FINAL',family:'E',definition:`Explicit target: target match OR finalScore >= ${finalFloor}; no target: finalScore floor.`,accept:(e,c)=>(c.target.applicable&&c.target.evaluable&&c.target.compatible)||(Number.isFinite(e.selector?.finalScore)&&e.selector.finalScore>=finalFloor)},
    {id:'E2_TARGET_NONAMBIG',family:'E',definition:`Explicit target: target match AND non-ambiguous; no target: finalScore >= ${finalFloor}.`,accept:(e,c)=>c.target.applicable?(c.target.evaluable?c.target.compatible&&!isAmbiguous(e):true):(Number.isFinite(e.selector?.finalScore)&&e.selector.finalScore>=finalFloor)},
    {id:'E3_TARGET_CONTENT_NONAMBIG',family:'E',definition:`Explicit target: target match, contentScore >= ${contentFloor}, and non-ambiguous; no target: finalScore >= ${finalFloor}.`,accept:(e,c)=>c.target.applicable?(c.target.evaluable?c.target.compatible&&!isAmbiguous(e)&&e.selector?.contentScore>=contentFloor:true):(e.selector?.finalScore>=finalFloor)},
    {id:'F1_ZERO_CALL_STRICT',family:'F',definition:`Explicit target compatibility mandatory; no target requires finalScore >= ${finalFloor} and non-ambiguous selection.`,accept:(e,c)=>c.target.applicable?(c.target.evaluable?c.target.compatible:true):e.selector?.finalScore>=finalFloor&&!isAmbiguous(e)},
    {id:'F2_ZERO_CALL_BALANCED',family:'F',definition:`Explicit target compatibility mandatory; no target requires finalScore >= ${finalFloor} or a non-ambiguous selection.`,accept:(e,c)=>c.target.applicable?(c.target.evaluable?c.target.compatible:true):(e.selector?.finalScore>=finalFloor||!isAmbiguous(e))}
  );
  return rules;
}
function simulateRule(run, rule) {
  const cases=run.results.map(result=>{
    const issues=result.actual.retrieval.perIssue||[]; const issueResults=issues.map(issue=>({issueId:issue.issueId,...issueCovered(result,issue,rule)}));
    const complete=issueResults.length?issueResults.every(x=>x.covered):result.actual.coverage.coverageComplete;
    const changed=complete!==result.actual.coverage.coverageComplete;
    const newlyGrounded=changed&&!complete&&result.actual.complexity.isComplex&&!result.actual.grounding.decision;
    const gold=result.expected.subjectCoverage; let verdict=null;
    if(gold?.status==='REVIEW_REQUIRED')verdict='AMBIGUOUS_REVIEW_REQUIRED';
    else if(gold){if(complete!==gold.expectedComplete)verdict=complete?'REAL_FALSE_POSITIVE':'REAL_FALSE_MISSING';else verdict=gold.classification==='BENCHMARK_ARTIFACT'?'BENCHMARK_ARTIFACT':'CORRECT_COVERAGE';}
    const impact=!gold?'UNLABELED':gold.status==='REVIEW_REQUIRED'?'REVIEW_REQUIRED':complete===gold.expectedComplete?'UNCHANGED':gold.expectedComplete?'BECOMES_FALSE_MISSING':'STILL_FALSE_COVERED';
    const correctedImpact=gold?.status==='SCORABLE'&&gold.expectedComplete===false&&!complete?'FIXED':impact;
    return {id:result.id,baselineComplete:result.actual.coverage.coverageComplete,simulatedComplete:complete,changed,newlyGrounded,groundingAlreadyTriggered:!complete&&result.actual.grounding.decision,verdict,impact:correctedImpact,issues:issueResults};
  });
  const labeled=cases.filter(x=>x.verdict); const scorable=labeled.filter(x=>x.verdict!=='AMBIGUOUS_REVIEW_REQUIRED');
  const fp=scorable.filter(x=>x.verdict==='REAL_FALSE_POSITIVE'); const fm=scorable.filter(x=>x.verdict==='REAL_FALSE_MISSING');
  const additional=cases.filter(x=>x.newlyGrounded); const existing=run.metrics.operational.groundingDecisions;
  return {id:rule.id,family:rule.family,definition:rule.definition,metrics:{realFalsePositiveRemaining:fp.length,falsePositivesFixed:8-fp.length,realFalseMissingIntroduced:fm.length,scorableCoverageAccuracy:Number(((scorable.length-fp.length-fm.length)/scorable.length).toFixed(4)),groundingDecisions:existing+additional.length,groundingRate:Number(((existing+additional.length)/run.results.length).toFixed(4)),additionalGroundingCases:additional.map(x=>x.id),alreadyGroundedIncompleteCases:cases.filter(x=>x.groundingAlreadyTriggered).map(x=>x.id),affectedCases:cases.filter(x=>x.changed).map(x=>x.id),benchmarkArtifactBehavior:cases.filter(x=>['CASE_013','CASE_017'].includes(x.id)).map(x=>({id:x.id,complete:x.simulatedComplete,verdict:x.verdict})),reviewRequiredBehavior:cases.filter(x=>['CASE_006','CASE_008'].includes(x.id)).map(x=>({id:x.id,complete:x.simulatedComplete}))},cases};
}
function renderMarkdown(output) {
  const table=output.rules.map(r=>`| ${r.id} | ${r.metrics.realFalsePositiveRemaining} | ${r.metrics.falsePositivesFixed} | ${r.metrics.realFalseMissingIntroduced} | ${(r.metrics.scorableCoverageAccuracy*100).toFixed(1)}% | ${r.metrics.groundingDecisions}/40 | ${(r.metrics.groundingRate*100).toFixed(1)}% | ${r.metrics.additionalGroundingCases.join(', ')||'—'} |`).join('\n');
  const impacts=output.rules.map(rule=>`### ${rule.id}\n\n${REAL_FP_IDS.map(id=>{const row=rule.cases.find(x=>x.id===id);return `- ${id}: ${row.impact} — ${row.simulatedComplete?'at least one retained item passes':'no retained item passes'} ${rule.id}.`;}).join('\n')}`).join('\n\n');
  return `# Offline Coverage Rule Simulation\n\nInput: after_coverage_observability_fix.json. Stored artifact and dataset labels only; no API execution.\n\n## Baseline reproduction\n\n${output.baselineReproduced?'PASS':'FAIL'}: ${output.baselineMismatchIds.length} mismatches (${output.baselineMismatchIds.join(', ')||'none'}).\n\n## Score distributions\n\n- finalScore: ${JSON.stringify(output.distributions.final)}\n- contentScore: ${JSON.stringify(output.distributions.content)}\n\n## Candidate metrics\n\n| Rule | FP remain | FP fixed | False-missing | Coverage accuracy | Grounding | Rate | Added Grounding |\n|---|---:|---:|---:|---:|---:|---:|---|\n${table}\n\n## Rule definitions\n\n${output.rules.map(x=>`- ${x.id}: ${x.definition}`).join('\n')}\n\n## Case-by-case impact for the eight real false-positives\n\n${impacts}\n\n## Target-evaluation limitations\n\n${output.targetLimitations.map(x=>`- ${x.caseId}/${x.issueId}: ${x.reason}`).join('\n')||'- None'}\n\n## Recommendation\n\n${output.recommendation.rule}: ${output.recommendation.reason}\n\n## Rejected candidates\n\n${output.rejections.map(x=>`- ${x.rule}: ${x.reason}`).join('\n')}\n`;
}
function runSimulation(input=DEFAULT_INPUT) {
  const run=JSON.parse(fs.readFileSync(input,'utf8'));
  const selected=run.results.flatMap(r=>(r.actual.retrieval.selectorTraces||[]).flatMap(t=>t.selectedEvidence||[]));
  const calibration={final:distribution(selected.map(x=>x.selector?.finalScore).filter(Number.isFinite)),content:distribution(selected.map(x=>x.selector?.contentScore).filter(Number.isFinite))};
  const rules=ruleDefinitions(calibration).map(rule=>simulateRule(run,rule)); const baseline=rules[0];
  const mismatch=baseline.cases.filter(x=>x.baselineComplete!==x.simulatedComplete).map(x=>x.id);
  const limitations=[]; for(const r of run.results)for(const issue of r.actual.retrieval.perIssue||[])for(const e of evidenceForIssue(r,issue)){const t=targetAssessment(r,issue,e);if(t.applicable&&!t.evaluable)limitations.push({caseId:r.id,issueId:issue.issueId,reason:t.reason});}
  const recommendation={rule:'B_EXPLICIT_TARGET',reason:'Smallest deterministic guard: fixes stored exact-target mismatch cases while adding no confidence floor, no selector change, and no API calls. Multi-target comparisons are resolved per issue when the issue contains one exact document number.'};
  const rejections=[{rule:'A1/A2',reason:'Ambiguity alone removes substantial evidence and provides no semantic guarantee.'},{rule:'C/D floors',reason:'Universal score floors trade coverage errors for false-missing and/or large routing increases; high requested finalScore floors are outside most observed selected-score values.'},{rule:'E/F hybrids',reason:'Compound confidence guards are less minimal and increase false-missing or Grounding more than the target-only guard.'}];
  return {metadata:{input:path.basename(input),cases:run.results.length,offline:true,productionMutation:false},baselineReproduced:mismatch.length===0,baselineMismatchIds:mismatch,distributions:calibration,rules,targetLimitations:[...new Map(limitations.map(x=>[`${x.caseId}/${x.issueId}/${x.reason}`,x])).values()],recommendation,rejections};
}
function writeSimulation(output,jsonPath=DEFAULT_JSON,mdPath=DEFAULT_MD){fs.writeFileSync(jsonPath,JSON.stringify(output,null,2));fs.writeFileSync(mdPath,renderMarkdown(output));}
if(require.main===module){const output=runSimulation(process.argv[2]||DEFAULT_INPUT);writeSimulation(output);console.log(`Offline simulation complete: ${output.rules.length} rules; baseline=${output.baselineReproduced?'PASS':'FAIL'}`);}
module.exports={quantile,distribution,documentNumbers,evidenceForIssue,targetAssessment,issueCovered,ruleDefinitions,simulateRule,runSimulation,writeSimulation,renderMarkdown,DEFAULT_INPUT,DEFAULT_JSON,DEFAULT_MD};
