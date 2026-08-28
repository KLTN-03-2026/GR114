const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { retrieveForIssues, buildIssueQueries, validateDecision, technicalFilter, normalizeArticle, numericRelations, prioritizeCandidates, TOP_K, MAX_NEIGHBOR_IDS, MAX_RERANK_CANDIDATES_PER_ISSUE } = require('../src/services/multiQueryRagService');

const issues = [
    { id:'Q1', query:'hàng xóm cố ý đánh gây thương tích 12% và có bị truy cứu trách nhiệm hình sự không', legalMechanismQuery:'tội cố ý gây thương tích hoặc gây tổn hại cho sức khỏe trách nhiệm hình sự', factualAnchors:['hàng xóm cố ý đánh','thương tích 12%'] },
    { id:'Q2', query:'bồi thường viện phí và thu nhập bị mất do thương tích', legalMechanismQuery:'bồi thường thiệt hại do sức khỏe bị xâm phạm', factualAnchors:['viện phí','thu nhập bị mất'] },
    { id:'Q3', query:'hòa giải rút yêu cầu khởi tố thì vụ án có đình chỉ không', legalMechanismQuery:'rút yêu cầu khởi tố đình chỉ vụ án', factualAnchors:['hòa giải','rút yêu cầu khởi tố'] }
];
const doc = (id, article, title, content, score=.8) => ({ id, dieu:`Điều ${article}`, articleTitle:title, title, content, score, sourceUrl:`https://vbpl.vn/${id}` });
const fixtures = {
    'Q1:A': ['296','297','138','135','136'].map((n,i) => doc(`q1-${n}`,n,'Bộ luật Hình sự',`Quy định khác ${n}`,.99-i/100)),
    'Q1:B': [doc('q1-134','134','Bộ luật Hình sự - Tội cố ý gây thương tích','Tội cố ý gây thương tích hoặc gây tổn hại cho sức khỏe của người khác')],
    'Q2:A': [doc('q2-590-short','590','Bộ luật Dân sự','Thiệt hại do sức khỏe bị xâm phạm')],
    'Q2:B': [doc('q2-590-long','590','Bộ luật Dân sự','Thiệt hại do sức khỏe bị xâm phạm gồm chi phí cứu chữa, thu nhập thực tế bị mất và tổn thất tinh thần'), doc('state','7','Luật trách nhiệm bồi thường của Nhà nước','Nhà nước bồi thường thiệt hại')],
    'Q3:A': [doc('q3-155','155','Bộ luật Tố tụng hình sự','Rút yêu cầu khởi tố thì vụ án phải được đình chỉ')],
    'Q3:B': [doc('q3-155-copy','155','Bộ luật Tố tụng hình sự','Rút yêu cầu khởi tố thì vụ án phải được đình chỉ')]
};

test('final multi-issue correction uses six Top-10 retrievals and one batched reranker', async () => {
    const calls=[]; let rerankerCalls=0;
    const result = await retrieveForIssues(issues, {
        statusQuery: issues.map(x=>x.query).join(' '),
        ragService:{ query:async (query,topK,_latency,meta) => { calls.push({query,topK,...meta}); return fixtures[`${meta.issueId}:${meta.querySource}`] || []; } },
        rerankEvidence:async payload => { rerankerCalls++; assert.equal(payload.length,3); assert.ok(!payload[1].candidates.some(candidate=>candidate.candidateId==='state')); return { issues:[
            { issueId:'Q1',coreSelection:{candidateId:'q1-134',evidenceSpanIds:['q1-134:S1'],reason:'direct'},supportingSelection:null,rejectedCandidates:[],confidence:'HIGH' },
            { issueId:'Q2',coreSelection:{candidateId:'q2-590-long',evidenceSpanIds:['q2-590-long:S1'],reason:'direct'},supportingSelection:null,rejectedCandidates:[],confidence:'HIGH' },
            { issueId:'Q3',coreSelection:{candidateId:'q3-155',evidenceSpanIds:['q3-155:S1'],reason:'direct'},supportingSelection:null,rejectedCandidates:[],confidence:'HIGH' }
        ]}; }
    });
    assert.equal(calls.length,6); assert.ok(calls.every(c=>c.topK===TOP_K)); assert.equal(rerankerCalls,1);
    assert.deepEqual(result.documents.map(d=>d.dieu),['Điều 134','Điều 590','Điều 155']);
    assert.deepEqual(result.coverageCounts,{Q1:1,Q2:1,Q3:1}); assert.equal(result.documents.length,3); assert.equal(result.allMergedEvidenceSent,false);
    assert.ok(!result.documents.some(d=>['Điều 135','Điều 136','Điều 138','Điều 296','Điều 297'].includes(d.dieu)));
});

test('mechanism fallback is generic and contains no guessed authority', () => {
    const built=buildIssueQueries(issues[0],issues[0].query);
    assert.match(built.queryB,/cố ý[\s\S]*gây thương tích/iu); assert.doesNotMatch(built.queryB,/Điều\s+\d+|https?:|_chunk_/iu);
});

test('local validation rejects fabricated candidate IDs, span IDs, and cross-issue IDs', () => {
    const issue={...issues[0],context:buildIssueQueries(issues[0]).context};
    const pool=[{doc:fixtures['Q1:B'][0],ranks:[],alternateRanks:[]}];
    assert.equal(validateDecision(issue,pool,{issueId:'Q1',coreSelection:{candidateId:'fake',evidenceSpanIds:['fake:S1']},supportingSelection:null,confidence:'HIGH'}).state,'INVALID_RERANK_DECISION');
    assert.equal(validateDecision(issue,pool,{issueId:'Q1',coreSelection:{candidateId:'q1-134',evidenceSpanIds:['invented:S9']},supportingSelection:null,confidence:'HIGH'}).state,'INVALID_RERANK_DECISION');
    assert.equal(validateDecision(issue,pool,{issueId:'Q2',coreSelection:{candidateId:'q1-134',evidenceSpanIds:['q1-134:S1']},supportingSelection:null,confidence:'HIGH'}).state,'INVALID_RERANK_DECISION');
});

test('query quality augments weak mechanism and preserves numeric facts', () => {
    const built=buildIssueQueries({...issues[0],legalMechanismQuery:'truy cứu trách nhiệm như thế nào',factualAnchors:['cố ý đánh gây thương tích','tỷ lệ 12%']});
    assert.match(built.queryB,/12%/u); assert.match(built.queryB,/thương tích/iu); assert.equal(built.augmentationUsed,true); assert.equal(built.qualityGatePassed,true);
});

test('technical filter preserves unclassified valid laws for reranking', () => {
    for (const title of ['Luật Đất đai','Bộ luật Lao động','Luật Doanh nghiệp','Luật An ninh mạng']) {
        const issue={id:'QX',purposeHint:'GENERAL'}; const candidate={doc:doc(title.replaceAll(' ', '-'),'1',title,'Người có quyền và nghĩa vụ theo quy định này'),ranks:[],alternateRanks:[]};
        assert.equal(technicalFilter(issue,[candidate]).accepted.length,1);
    }
});

test('selection spans are role-scoped and LOW cannot cover', () => {
    const issue={...issues[1],context:buildIssueQueries(issues[1]).context};
    const core={doc:fixtures['Q2:B'][0],ranks:[],alternateRanks:[]}; const support={doc:doc('support-13','13','Luật khác','Nội dung hỗ trợ riêng'),ranks:[],alternateRanks:[]};
    assert.equal(validateDecision(issue,[core,support],{issueId:'Q2',coreSelection:{candidateId:'q2-590-long',evidenceSpanIds:['support-13:S1']},supportingSelection:null,confidence:'HIGH'}).state,'INVALID_RERANK_DECISION');
    assert.equal(validateDecision(issue,[core,support],{issueId:'Q2',coreSelection:{candidateId:'q2-590-long',evidenceSpanIds:['q2-590-long:S1']},supportingSelection:{candidateId:'support-13',evidenceSpanIds:[]},confidence:'HIGH'}).state,'VALIDATED_CORE');
    assert.equal(validateDecision(issue,[core],{issueId:'Q2',coreSelection:{candidateId:'q2-590-long',evidenceSpanIds:['q2-590-long:S1']},supportingSelection:null,confidence:'LOW'}).state,'INVALID_RERANK_DECISION');
    assert.equal(validateDecision(issue,[core],{issueId:'Q2',coreSelection:null,supportingSelection:{candidateId:'q2-590-long',evidenceSpanIds:['q2-590-long:S1']},confidence:'HIGH'}).state,'MISSING_CORE');
});

test('ragService uses the Pinecone v3 batch fetch signature and canonical metadata reader', () => {
    const source=fs.readFileSync(path.join(__dirname,'../src/services/ragService.js'),'utf8');
    assert.match(source,/index\.fetch\(uniqueIds\)/u);
    assert.match(source,/readLegalVectorMetadata\(record\?\.metadata/u);
    assert.match(source,/content:\s*canonical\.text/u);
});

test('article normalization handles newlines and nullable title', () => {
    assert.equal(normalizeArticle('Điều\n590'),'Điều 590');
    const candidate={doc:{id:'land-1',dieu:'Điều\n1',content:'Người sử dụng đất có quyền',articleTitle:null,sourceUrl:'https://vbpl.vn/land'},ranks:[],alternateRanks:[]};
    assert.equal(technicalFilter({id:'Q1',purposeHint:'GENERAL'},[candidate]).accepted.length,1);
});

test('one invalid issue preserves two validated RAG issues for partial Grounding', async () => {
    const result=await retrieveForIssues(issues,{
        statusQuery:issues.map(x=>x.query).join(' '),
        ragService:{query:async (_query,_topK,_latency,meta)=>fixtures[`${meta.issueId}:${meta.querySource}`]||[]},
        rerankEvidence:async()=>({issues:[
            {issueId:'Q1',coreSelection:null,supportingSelection:null,confidence:'LOW'},
            {issueId:'Q2',coreSelection:{candidateId:'q2-590-long',evidenceSpanIds:['q2-590-long:S1'],reason:'direct'},supportingSelection:null,confidence:'HIGH'},
            {issueId:'Q3',coreSelection:{candidateId:'q3-155',evidenceSpanIds:['q3-155:S1'],reason:'direct'},supportingSelection:null,confidence:'HIGH'}
        ]})
    });
    assert.equal(result.coverage,'2/3'); assert.deepEqual(result.missingIssueIds,['Q1']); assert.equal(result.ragIssuesPreserved,2);
    assert.deepEqual(result.documents.map(item=>item.dieu),['Điều 590','Điều 155']); assert.equal(result.allMergedEvidenceSent,false);
});

test('distinct same-article chunks survive while exact vector IDs deduplicate', () => {
    const issue={id:'Q1',purposeHint:'GENERAL'};
    const make=id=>({doc:{id,doc_id:'law-1',dieu:'Điều 10',title:'Luật mẫu',content:`Nội dung ${id}`},ranks:[],alternateRanks:[]});
    assert.equal(technicalFilter(issue,[make('law-1_chunk_1'),make('law-1_chunk_2')]).accepted.length,2);
    assert.equal(technicalFilter(issue,[make('law-1_chunk_1'),make('law-1_chunk_1')]).accepted.length,1);
});

test('one batch neighbor fetch hydrates the genuine preceding Article 134 span', async () => {
    const chunk152={id:'100-2015-qh13_chunk_152',doc_id:'100-2015-qh13',dieu:'Điều 134',articleTitle:'Tội cố ý gây thương tích',title:'Bộ luật Hình sự',content:'Các khung hình phạt tiếp theo',sourceUrl:'https://vbpl.vn/blhs',score:.8};
    const exact151='Người nào cố ý gây thương tích cho người khác với tỷ lệ tổn thương cơ thể 12% thì chịu trách nhiệm theo quy định.';
    const chunk151={...chunk152,id:'100-2015-qh13_chunk_151',content:exact151,score:0};
    const different={...chunk152,id:'100-2015-qh13_chunk_153',dieu:'Điều 135',content:'Một điều luật khác'};
    let fetchCalls=0; let rerankerCalls=0; let requested=[];
    const result=await retrieveForIssues([issues[0]],{
        statusQuery:issues[0].query,
        ragService:{query:async()=>[chunk152],fetchByIds:async ids=>{fetchCalls++;requested=ids;return [chunk151,chunk152,different];}},
        rerankEvidence:async payload=>{rerankerCalls++;const ids=payload[0].candidates.map(item=>item.candidateId);assert.ok(ids.includes(chunk151.id));assert.ok(ids.includes(chunk152.id));return {issues:[{issueId:'Q1',coreSelection:{candidateId:chunk151.id,evidenceSpanIds:[`${chunk151.id}:S1`],reason:'direct threshold'},supportingSelection:null,confidence:'HIGH',rejectedCandidates:[]}]};}
    });
    assert.equal(fetchCalls,1); assert.equal(rerankerCalls,1); assert.ok(requested.includes(chunk151.id));
    assert.equal(result.documents[0].id,chunk151.id); assert.equal(result.documents[0].content,exact151); assert.equal(result.coverage,'1/1');
});

test('existing Article 134 chunks 151 and 152 need no hydration fetch', async () => {
    const base={doc_id:'100-2015-qh13',dieu:'Điều 134',articleTitle:'Tội cố ý gây thương tích',title:'Bộ luật Hình sự',sourceUrl:'https://vbpl.vn/blhs',score:.8};
    const chunk151={...base,id:'100-2015-qh13_chunk_151',content:'Điều 134. Tội cố ý gây thương tích hoặc gây tổn hại cho sức khỏe của người khác. Người nào gây thương tích từ 11% đến 30% thì bị xử lý.'};
    const chunk152={...base,id:'100-2015-qh13_chunk_152',content:'Các khoản và khung hình phạt tiếp theo của cùng điều luật.'};
    let fetchCalls=0;
    const result=await retrieveForIssues([issues[0]],{ragService:{query:async()=>[chunk151,chunk152],fetchByIds:async()=>{fetchCalls++;return[];}},rerankEvidence:async payload=>({issues:[{issueId:'Q1',coreSelection:{candidateId:chunk151.id,evidenceSpanIds:[`${chunk151.id}:S1`],reason:'range'},supportingSelection:null,confidence:'HIGH',rejectedCandidates:[]}]})});
    assert.equal(fetchCalls,0); assert.equal(result.coverage,'1/1');
});

test('complete article-start chunk needs no hydration fetch', async () => {
    const complete={id:'law_chunk_10',doc_id:'law',dieu:'Điều 10',articleTitle:'Quyền của người bị thiệt hại',content:'Điều 10. Người bị thiệt hại có quyền yêu cầu bồi thường và cơ quan có trách nhiệm giải quyết theo quy định.',sourceUrl:'https://vbpl.vn/law',score:.8};
    let fetchCalls=0;
    await retrieveForIssues([{id:'Q1',query:'yêu cầu bồi thường',legalMechanismQuery:'quyền yêu cầu bồi thường'}],{ragService:{query:async()=>[complete],fetchByIds:async()=>{fetchCalls++;return[];}},rerankEvidence:async()=>({issues:[{issueId:'Q1',coreSelection:null,supportingSelection:null,confidence:'LOW',rejectedCandidates:[]}]})});
    assert.equal(fetchCalls,0);
});

test('hydration is capped at two seeds per issue and 24 neighbor IDs request-wide', async () => {
    const manyIssues=Array.from({length:3},(_,issueIndex)=>({id:`Q${issueIndex+1}`,query:`vấn đề ${issueIndex+1}`,legalMechanismQuery:`cơ chế pháp lý vấn đề ${issueIndex+1}`}));
    const candidates=Object.fromEntries(manyIssues.map((issue,issueIndex)=>[issue.id,Array.from({length:3},(_,articleIndex)=>({id:`law-${issueIndex}-${articleIndex}_chunk_10`,doc_id:`law-${issueIndex}-${articleIndex}`,dieu:`Điều ${articleIndex+1}`,articleTitle:`Quy định ${articleIndex+1}`,content:'Nội dung tiếp theo của quy định và nghĩa vụ liên quan.',sourceUrl:'https://vbpl.vn/law',score:.9-articleIndex/10}))]));
    let fetchCalls=0; let requested=[];
    await retrieveForIssues(manyIssues,{ragService:{query:async(_q,_k,_l,meta)=>candidates[meta.issueId],fetchByIds:async ids=>{fetchCalls++;requested=ids;return[];}},rerankEvidence:async payload=>({issues:payload.map(row=>({issueId:row.issueId,coreSelection:null,supportingSelection:null,confidence:'LOW',rejectedCandidates:[]}))})});
    assert.equal(fetchCalls,1); assert.equal(requested.length,MAX_NEIGHBOR_IDS);
});

test('hydration timeout preserves originals and safely observes a late rejection', async () => {
    const continuation={id:'law_chunk_10',doc_id:'law',dieu:'Điều 10',articleTitle:'Quy định',content:'Nội dung tiếp theo của điều luật đang được áp dụng.',sourceUrl:'https://vbpl.vn/law',score:.8};
    let unhandled=false; const listener=()=>{unhandled=true;}; process.once('unhandledRejection',listener);
    const result=await retrieveForIssues([{id:'Q1',query:'vấn đề pháp lý',legalMechanismQuery:'cơ chế pháp lý chung'}],{fetchTimeoutMs:1,ragService:{query:async()=>[continuation],fetchByIds:async()=>new Promise((_resolve,reject)=>setTimeout(()=>reject(new Error('late')),10))},rerankEvidence:async payload=>({issues:[{issueId:'Q1',coreSelection:{candidateId:continuation.id,evidenceSpanIds:[`${continuation.id}:S1`],reason:'original'},supportingSelection:null,confidence:'HIGH',rejectedCandidates:[]}]})});
    await new Promise(resolve=>setTimeout(resolve,20)); process.removeListener('unhandledRejection',listener);
    assert.equal(unhandled,false); assert.equal(result.documents[0].id,continuation.id);
});

test('prioritization retains rank-10 range evidence and bounds payload without duplicate text', async () => {
    const candidates=Array.from({length:11},(_,index)=>doc(index===9?'100-2015-qh13_chunk_151':index===0?'DOC-1775801439737-77_chunk_654':index===1?'101-2015-qh13_chunk_206':`noise_chunk_${index}`,index+1,index===9?'Tội gây thương tích':'Quy định khác',index===9?'Người nào gây thương tích với tỷ lệ tổn thương cơ thể từ 11% đến 30% thì bị xử lý.':`Nội dung không liên quan ${index}`,.99-index/100));
    let seen;
    await retrieveForIssues([issues[0]],{ragService:{query:async(_q,_k,_l,meta)=>meta.querySource==='A'?candidates:[]},rerankEvidence:async payload=>{seen=payload[0].candidates;return{issues:[{issueId:'Q1',coreSelection:null,supportingSelection:null,confidence:'LOW',rejectedCandidates:[]}]};}});
    assert.ok(seen.length<=MAX_RERANK_CANDIDATES_PER_ISSUE); assert.ok(seen.some(item=>item.candidateId==='100-2015-qh13_chunk_151')); assert.ok(seen.some(item=>item.candidateId==='DOC-1775801439737-77_chunk_654')); assert.ok(seen.some(item=>item.candidateId==='101-2015-qh13_chunk_206'));
    assert.ok(seen.every(item=>!Object.hasOwn(item,'text'))); assert.equal(seen.find(item=>item.candidateId==='100-2015-qh13_chunk_151').numericRelations[0].relation,'WITHIN_RANGE');
});

test('percentage relations preserve boundaries and never compare non-percent units', () => {
    assert.equal(numericRelations('tỷ lệ 12%','từ 11% đến 30%')[0].relation,'WITHIN_RANGE');
    assert.equal(numericRelations('tỷ lệ 11%','từ 11% đến 30%')[0].relation,'WITHIN_RANGE');
    assert.equal(numericRelations('tỷ lệ 10%','trên 10% đến 20%')[0].relation,'OUTSIDE_RANGE');
    assert.equal(numericRelations('tỷ lệ 11%','dưới 11%')[0].relation,'OUTSIDE_RANGE');
    assert.equal(numericRelations('chi phí 12 triệu đồng','từ 11% đến 30%').length,0);
});

test('numeric overlap alone cannot establish validated core', () => {
    const candidate={doc:doc('range-only','1','Quy định khác','Từ 11% đến 30%'),ranks:[{querySource:'A',rank:1,score:.9}],alternateRanks:[]};
    assert.equal(prioritizeCandidates(issues[0],[candidate])[0].prioritySignals.numericWithinRange,true);
    assert.equal(validateDecision(issues[0],[candidate],{issueId:'Q1',coreSelection:null,supportingSelection:null,confidence:'LOW'}).state,'MISSING_CORE');
});

test('reranker source uses dedicated model, range instruction, bounded output and no fallback', () => {
    const source=fs.readFileSync(path.join(__dirname,'../src/services/geminiService.js'),'utf8');
    const body=source.slice(source.indexOf('async function rerankLegalEvidence'),source.indexOf('module.exports',source.indexOf('async function rerankLegalEvidence')));
    assert.match(body,/GEMINI_RERANK_MODEL\s*\|\|\s*'gemini-3\.5-flash'/u); assert.match(body,/12%[\s\S]*11%–30%/u); assert.match(body,/maxOutputTokens:\s*2048/u); assert.doesNotMatch(body,/FINAL_LEGAL_PRIMARY_MODEL/u);
});
