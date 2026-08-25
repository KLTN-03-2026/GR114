#!/usr/bin/env node
const {execute}=require('./runner');
function args(argv){const out={mode:'free',caseIds:[],name:'baseline'};for(const arg of argv){const [k,v]=arg.replace(/^--/,'').split('=');if(k==='mode')out.mode=v;if(k==='case')out.caseIds.push(v);if(k==='cases')out.caseIds.push(...v.split(',').filter(Boolean));if(k==='name')out.name=v;}return out;}
if(require.main===module)execute(args(process.argv.slice(2))).catch(error=>{console.error(`[BENCHMARK ERROR]\ntype=${error.name||'Error'}\nmessage=${error.message}`);process.exitCode=1;});
module.exports={args};
