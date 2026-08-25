const fs=require('node:fs'); const path=require('node:path');
const {validateDataset}=require('./schema'); const {calculateMetrics,enrichCoverageResult}=require('./metrics'); const {renderMarkdown}=require('./report'); const {runCase}=require('./pipelineAdapter');
const ROOT=__dirname; const CASES=path.join(ROOT,'cases.json'); const RESULTS=path.join(ROOT,'results');
function safeName(v){if(!/^[a-z0-9][a-z0-9_-]*$/i.test(v||''))throw new Error('Run name may contain only letters, numbers, _ and -');return v;}
function classifyFailures(results){const out=[];for(const r of results){if(!r.actual?.complexity)continue;if((r.expected.complexity==='complex')!==r.actual.complexity.isComplex)out.push({id:r.id,reason:`complexity false-${r.actual.complexity.isComplex?'complex':'simple'}`});if(r.actual.grounding.decision!==r.expected.shouldGround)out.push({id:r.id,reason:`grounding ${r.actual.grounding.decision?'over-trigger':'under-trigger'}: ${r.actual.grounding.reason.join(', ')}`});if(r.actual.coverage.verdict==='REAL_FALSE_POSITIVE')out.push({id:r.id,reason:`real coverage false-positive: ${r.actual.coverage.diagnosticCauses.join(', ')}`});if(r.actual.coverage.verdict==='REAL_FALSE_MISSING')out.push({id:r.id,reason:`real coverage false-missing: ${r.actual.coverage.diagnosticCauses.join(', ')}`});}return out.slice(0,10);}
async function execute({mode='free',caseIds=[],name='baseline',write=true}={}){
 if(!['free','live'].includes(mode))throw new Error('Mode must be free or live');
 if(mode==='live'&&!caseIds.length)throw new Error('LIVE benchmark requires explicit case IDs. No paid Grounding was executed.');
 if(mode==='live'&&caseIds.length>2)throw new Error('LIVE benchmark is limited to 1–2 explicitly selected cases. No paid Grounding was executed.');
 const all=JSON.parse(fs.readFileSync(CASES,'utf8')); const validation=validateDataset(all); if(!validation.valid)throw new Error(validation.errors.join('\n'));
 const unknown=caseIds.filter(id=>!all.some(x=>x.id===id));if(unknown.length)throw new Error(`Unknown case IDs: ${unknown.join(', ')}`);
 const selected=caseIds.length?all.filter(x=>caseIds.includes(x.id)):all; const results=[];
 for(const item of selected){try{const result=enrichCoverageResult(await runCase(item,{mode}));results.push(result);console.log(`[BENCHMARK]\ncase=${item.id}\nmode=${mode}\ngroundingDecision=${result.actual?.grounding?.decision??false}\ngroundingCalls=${result.actual?.calls?.grounding??0}\nlatencyMs=${result.actual?.latencyMs?.total??0}\nresult=${result.error?'FAIL':'PASS'}`);}catch(error){results.push({id:item.id,category:item.category,status:item.status,question:item.question,expected:item.expected,error:error.message,actual:{calls:{},tokens:{},latencyMs:{}}});console.error(`[BENCHMARK ERROR]\ncase=${item.id}\ntype=${error.name||'Error'}\nmessage=${error.message}`);}}
 const metrics=calculateMetrics(results); const categories=Object.fromEntries([...new Set(all.map(x=>x.category))].map(k=>[k,all.filter(x=>x.category===k).length]));
 const metricsByCategory=Object.fromEntries([...new Set(results.map(x=>x.category))].map(k=>[k,calculateMetrics(results.filter(x=>x.category===k))]));
 const run={metadata:{name:safeName(name),mode:mode==='free'?'free/mock':'live',generatedAt:new Date().toISOString(),datasetSize:all.length,executedCases:results.length,categoryDistribution:categories,metricsByCategory,topFailures:classifyFailures(results),productionMutation:false},metrics,results};
 if(write){fs.mkdirSync(RESULTS,{recursive:true});fs.writeFileSync(path.join(RESULTS,`${name}.json`),JSON.stringify(run,null,2));fs.writeFileSync(path.join(RESULTS,`${name}.md`),renderMarkdown(run));}
 return run;
}
module.exports={execute,CASES,RESULTS,classifyFailures};
