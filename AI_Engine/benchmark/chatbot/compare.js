#!/usr/bin/env node
const fs=require('node:fs');const path=require('node:path');
const dir=path.join(__dirname,'results');const [baseName,candidateName]=process.argv.slice(2).map(x=>x.replace(/^--(?:baseline|candidate)=/,''));
if(!baseName||!candidateName){console.error('Usage: npm run benchmark:chatbot:compare -- baseline after_gate_fix');process.exit(1);}
const load=n=>JSON.parse(fs.readFileSync(path.join(dir,`${n}.json`),'utf8'));const a=load(baseName).metrics,b=load(candidateName).metrics;
const rows=[['Gate accuracy',a.complexity.accuracy,b.complexity.accuracy],['Issue recall',a.decomposition.issueRecall,b.decomposition.issueRecall],['Retrieval Recall@5',a.retrieval.expectedDocumentRecallAt5,b.retrieval.expectedDocumentRecallAt5],['Grounding rate',a.grounding.groundingRate,b.grounding.groundingRate],['Embedding calls',a.operational.embeddingCalls,b.operational.embeddingCalls],['Total tokens',a.operational.tokens.totalTokenCount,b.operational.tokens.totalTokenCount],['Average latency ms',a.operational.averageLatencyMs,b.operational.averageLatencyMs]];
console.log('| Metric | Baseline | Candidate | Delta |\n|---|---:|---:|---:|');for(const [n,x,y] of rows)console.log(`| ${n} | ${x??'N/A'} | ${y??'N/A'} | ${x==null||y==null?'N/A':Number((y-x).toFixed(4))} |`);
