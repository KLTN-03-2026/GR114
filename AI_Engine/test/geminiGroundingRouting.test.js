const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const servicePath = path.join(__dirname, '..', 'src', 'services', 'geminiService.js');
const source = fs.readFileSync(servicePath, 'utf8');
const groundedWrapper = source.match(/const compiledPrompt = `([\s\S]*?)`;\s*if \(latency\)/)?.[1] || '';
const {
    getGroundingTimeoutMs,
    getTimeoutSource,
    buildGroundingGapHint,
    buildGroundingRescuePlan,
    buildGroundingRescueInstruction,
    filterGroundingContextDocuments,
    scheduleGroundedSourceCache,
    normalizeGeminiResponse,
    isRagOutdated
} = require('../src/services/geminiService');

const rescueIssues = [
    { id:'Q1',query:'supported one' },
    { id:'Q2',query:'supported two' },
    { id:'Q3',query:'missing three' }
];

test('partial coverage scopes rescue to missing issues and preserves supported issues', () => {
    const plan = buildGroundingRescuePlan({ issues:rescueIssues,missingIssueIds:['Q3'] }, 'forced');
    assert.deepEqual(plan.issueIds,['Q3']);
    assert.deepEqual(plan.preservedIssueIds,['Q1','Q2']);
    assert.equal(plan.fullQueryMode,false);
    const instruction=buildGroundingRescueInstruction(plan);
    assert.match(instruction,/Q3: missing three/);
    assert.doesNotMatch(instruction,/Q1: supported one/);
});

test('target mismatch rescues only the mismatched issue and keeps its target identity', () => {
    const issues=[{id:'Q1',query:'2019'},{id:'Q2',query:'2010',target:{number:'62/2010/QH12'}}];
    const plan=buildGroundingRescuePlan({issues,targetMismatchedIssueIds:['Q2']},'forced');
    assert.deepEqual(plan.issueIds,['Q2']);
    assert.match(buildGroundingRescueInstruction(plan),/62\/2010\/QH12/);
});

test('all missing or irrelevant issues use one full-query rescue plan', () => {
    const missing=buildGroundingRescuePlan({issues:rescueIssues,missingIssueIds:['Q1','Q2','Q3']},'forced');
    const irrelevant=buildGroundingRescuePlan({issues:rescueIssues},'rag_irrelevant');
    assert.equal(missing.fullQueryMode,true);
    assert.deepEqual(irrelevant.issueIds,['Q1','Q2','Q3']);
    assert.equal(irrelevant.fullQueryMode,true);
});

test('no missing issue produces no rescue and therefore no Grounding scope', () => {
    assert.equal(buildGroundingRescuePlan({issues:rescueIssues},'rag_sufficient'),null);
});

test('two missing issues are consolidated in one ordered rescue plan', () => {
    const plan=buildGroundingRescuePlan({issues:rescueIssues,missingIssueIds:['Q2','Q3']},'forced');
    assert.deepEqual(plan.issueIds,['Q2','Q3']);
    assert.equal(plan.fullQueryMode,false);
});

test('freshness can be scoped to one existing issue', () => {
    const plan=buildGroundingRescuePlan({issues:rescueIssues,freshnessIssueIds:['Q2']},'rag_outdated');
    assert.deepEqual(plan.issueIds,['Q2']);
    assert.deepEqual(plan.preservedIssueIds,['Q1','Q3']);
});

test('freshness scope is inferred from the affected decomposed issue when available', () => {
    const plan=buildGroundingRescuePlan({issues:[{id:'Q1',query:'quy định ổn định'},{id:'Q2',query:'mức phạt mới nhất'}]},'rag_outdated');
    assert.deepEqual(plan.issueIds,['Q2']);
});

test('partial rescue context retains only evidence supporting preserved issues', () => {
    const plan=buildGroundingRescuePlan({issues:rescueIssues,missingIssueIds:['Q3']},'forced');
    const docs=[
        {id:'q1',supportedIssueIds:['Q1']},
        {id:'q3',supportedIssueIds:['Q3']},
        {id:'shared',supportedIssueIds:['Q2','Q3']}
    ];
    assert.deepEqual(filterGroundingContextDocuments(docs,plan).map(doc=>doc.id),['q1','shared']);
    assert.deepEqual(filterGroundingContextDocuments(docs,{...plan,fullQueryMode:true}),[]);
});

test('grounded citations are attributed only to rescued issue scope', () => {
    const normalized=normalizeGeminiResponse({
        text:'rescued answer',grounded:true,
        groundingRescue:{issueIds:['Q2']},
        groundingMetadata:{groundingChunks:[{web:{title:'VBPL',uri:'https://vbpl.vn/detail'}}],groundingSupports:[]}
    });
    assert.deepEqual(normalized.citations[0].supportedIssueIds,['Q2']);
});

test('slow source cache is scheduled without blocking grounded citations or answer', async () => {
    let finishCache;
    const slowCache = new Promise(resolve => { finishCache = resolve; });
    let cacheCalls = 0;
    const metadata = {
        groundingChunks: [{ web: { title: 'Luật 62/2010/QH12', uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/example' } }],
        groundingSupports: []
    };

    const startedAt = Date.now();
    const cacheTask = scheduleGroundedSourceCache('Luật 62/2010/QH12', metadata, () => {
        cacheCalls += 1;
        return slowCache;
    });
    const normalized = normalizeGeminiResponse({ text: 'grounded answer', grounded: true, groundingMetadata: metadata }, true);

    assert.ok(Date.now() - startedAt < 100, 'response work must not wait for the modeled 6000ms cache tail');
    assert.equal(normalized.answer, 'grounded answer');
    assert.equal(normalized.citations[0].sourceUrl, metadata.groundingChunks[0].web.uri);
    assert.equal(cacheCalls, 0, 'background cache begins on a later microtask');

    await Promise.resolve();
    assert.equal(cacheCalls, 1);
    finishCache('https://vbpl.vn/van-ban/chi-tiet/62-2010');
    assert.equal(await cacheTask, 'https://vbpl.vn/van-ban/chi-tiet/62-2010');
});

test('redirect timeout and SQL failure are isolated from the chatbot path', async () => {
    const timeoutTask = scheduleGroundedSourceCache('Luật 62/2010/QH12', {}, async () => {
        throw new Error('timeout of 6000ms exceeded');
    });
    const sqlTask = scheduleGroundedSourceCache('Luật 62/2010/QH12', {}, async () => {
        throw new Error('LawSources SQL upsert failed');
    });

    assert.equal(await timeoutTask, null);
    assert.equal(await sqlTask, null);
});

test('source cache task catches rejection and is scheduled once per grounded response', async () => {
    let calls = 0;
    let unhandled = null;
    const onUnhandled = error => { unhandled = error; };
    process.once('unhandledRejection', onUnhandled);

    const task = scheduleGroundedSourceCache('Luật 62/2010/QH12', {}, () => {
        calls += 1;
        return Promise.reject(new Error('fixture cache failure'));
    });
    assert.equal(await task, null);
    await new Promise(resolve => setImmediate(resolve));
    process.removeListener('unhandledRejection', onUnhandled);

    assert.equal(calls, 1);
    assert.equal(unhandled, null);
    const schedulingSite = source.match(/if \(enableGoogleSearch && groundingMetadata\) \{[\s\S]*?\n\s*\}/)?.[0] || '';
    assert.equal((schedulingSite.match(/scheduleGroundedSourceCache\(/g) || []).length, 1);
    assert.doesNotMatch(schedulingSite, /await\s+scheduleGroundedSourceCache/);
});

test('CASE_019 shape preserves Q1 and rescues only Q2 while CASE_005 rescues all issues', () => {
    const case019=buildGroundingRescuePlan({issues:[{id:'Q1',query:'54/2019/QH14'},{id:'Q2',query:'62/2010/QH12'}],missingIssueIds:['Q2'],targetMismatchedIssueIds:['Q2']},'forced');
    const case005=buildGroundingRescuePlan({issues:rescueIssues},'rag_irrelevant');
    assert.deepEqual(case019.preservedIssueIds,['Q1']);
    assert.deepEqual(case019.rescuedIssueIds,['Q2']);
    assert.deepEqual(case005.rescuedIssueIds,['Q1','Q2','Q3']);
});

test('Stage A grounded wrapper keeps only the Search-specific source contract', () => {
    assert.match(groundedWrapper, /\$\{enableGoogleSearch \? buildGroundingGapHint\(groundingContext\) : ''\}/);
    assert.match(groundedWrapper, /\$\{enableGoogleSearch \? buildGroundingRescueInstruction\(groundingRescue\) : ''\}/);
    assert.match(groundedWrapper, /1\. vbpl\.vn[\s\S]*2\. thuvienphapluat\.vn[\s\S]*3\. xaydungchinhsach\.chinhphu\.vn/);
    assert.match(groundedWrapper, /TOÀN VĂN[\s\S]*đúng tên, số hiệu và nội dung văn bản/);
    assert.match(groundedWrapper, /sourceUrl phải là chuỗi rỗng/);
    assert.doesNotMatch(groundedWrapper, /ZERO HALLUCINATION|TUYỆT ĐỐI BẢO TOÀN SỐ ĐIỀU/);
});

test('effective grounded request retains target, protected RAG, and final-answer contracts', () => {
    assert.match(groundedWrapper, /\$\{ragContext/);
    assert.match(groundedWrapper, /"\$\{userPrompt\}"/);
    assert.match(source, /const targetLawInstruction = options\.targetLaw/);
    assert.match(source, /Phải trả lời chủ yếu theo đúng văn bản này/);
    assert.match(source, /<protected_url DO_NOT_MODIFY="TRUE">\$\{documentGroup\.sourceUrl\}<\/protected_url>/);
});

test('rescue contract preserves supported IDs and limits Search to missing IDs', () => {
    const plan = buildGroundingRescuePlan({ issues: rescueIssues, missingIssueIds: ['Q3'] }, 'forced');
    const instruction = buildGroundingRescueInstruction(plan);
    assert.match(instruction, /Chỉ dùng Google Search để xác minh/);
    assert.match(instruction, /Q3: missing three/);
    assert.match(instruction, /phải được bảo toàn: Q1, Q2/);
    assert.match(instruction, /không tìm kiếm lại/);
    assert.match(instruction, /một câu trả lời cuối cùng/);
});

test('full miss remains one combined Grounding request', () => {
    const plan = buildGroundingRescuePlan({ issues: rescueIssues, missingIssueIds: ['Q1', 'Q2', 'Q3'] }, 'forced');
    const instruction = buildGroundingRescueInstruction(plan);
    assert.equal(plan.fullQueryMode, true);
    assert.match(instruction, /toàn bộ các vấn đề sau trong MỘT yêu cầu/);
    for (const issue of rescueIssues) assert.match(instruction, new RegExp(`${issue.id}: ${issue.query}`));
});

test('final chatbot path performs one synthesis call and permits at most one grounded attempt', () => {
    const finalAnswerFunction = source.match(/async function generateAnswerWithGemini[\s\S]*?^}/m)?.[0] || '';
    assert.equal((finalAnswerFunction.match(/await getActiveModel\(/g) || []).length, 1);
    assert.match(source, /if \(enableGoogleSearch\) \{[\s\S]*?return returnResponseDetails[\s\S]*?: fallbackText;/);
});

test('current canonical issueYear is not outdated', () => {
    const currentYear = new Date().getFullYear();
    assert.equal(isRagOutdated([{ issueYear: currentYear }], currentYear), false);
});

test('old canonical issueYear preserves outdated behavior', () => {
    const currentYear = new Date().getFullYear();
    assert.equal(isRagOutdated([{ issueYear: currentYear - 5 }], currentYear), true);
});

test('mixed old and current documents preserve every semantics', () => {
    const currentYear = new Date().getFullYear();
    assert.equal(isRagOutdated([{ issueYear: currentYear - 5 }, { issueYear: currentYear }], currentYear), false);
});

test('missing issueYear preserves the zero-year fallback', () => {
    const currentYear = new Date().getFullYear();
    assert.equal(isRagOutdated([{}], currentYear), true);
});

test('current issueYear does not add a Grounding condition', () => {
    const currentYear = new Date().getFullYear();
    const isSeekingNewInfo = true;
    const forceSearch = false;
    const isRagRelevant = true;
    assert.equal(forceSearch || !isRagRelevant || (isSeekingNewInfo && isRagOutdated([{ issueYear: currentYear }], currentYear)), false);
});

test('sufficient RAG keeps Grounding off for the normal final call', () => {
    assert.match(source, /if \(forceSearch \|\| !isRagRelevant \|\| \(isSeekingNewInfo && ragIsOutdated\)\)/);
    assert.match(source, /enableGoogleSearch = false;/);
});

test('empty RAG enables the one final Grounding call', () => {
    assert.match(source, /enableGoogleSearch = forceSearch;\s*\n\s*\n\s*if \(enableGoogleSearch\)/);
    assert.match(source, /documents\.length === 0 \|\| options\.allowGrounding === true,\s*\n\s*false,\s*\n\s*userQuestion/);
});

test('insufficient non-empty RAG enables Grounding', () => {
    assert.match(source, /forceSearch \|\| !isRagRelevant/);
});

test('Grounding failure enters internal-knowledge fallback only from a grounded attempt', () => {
    assert.match(source, /catch \(error\)[\s\S]*?if \(enableGoogleSearch\) \{[\s\S]*?\[CHẾ ĐỘ LLM FALLBACK\]/);
});

test('Grounding remains incompatible with JSON response MIME type', () => {
    assert.match(source, /if \(isJson && !enableGoogleSearch\) \{\s*generationConfig\.responseMimeType = "application\/json";/);
});

test('client-side Grounding timeout is distinguished from upstream timeout', () => {
    assert.equal(getTimeoutSource({ code: 'CLIENT_TIMEOUT', message: 'TIMEOUT_EXCEEDED' }), 'CLIENT');
    assert.equal(getTimeoutSource({ status: 504, message: 'Gateway Timeout' }), 'UPSTREAM');
    assert.equal(getTimeoutSource({ code: 'DEADLINE_EXCEEDED' }), 'UPSTREAM');
});

test('Grounding has a dedicated configurable timeout', () => {
    const previous = process.env.GEMINI_GROUNDING_TIMEOUT_MS;
    process.env.GEMINI_GROUNDING_TIMEOUT_MS = '123456';
    assert.equal(getGroundingTimeoutMs(), 123456);
    if (previous === undefined) delete process.env.GEMINI_GROUNDING_TIMEOUT_MS;
    else process.env.GEMINI_GROUNDING_TIMEOUT_MS = previous;
});

test('partial target coverage produces one consolidated Grounding gap hint', () => {
    const hint = buildGroundingGapHint({
        missingIssueIds: ['Q1'],
        targetMismatchedIssueIds: ['Q1']
    });
    assert.match(hint, /Q1/);
    assert.match(hint, /một lần Grounding tổng hợp/);
});

test('fallback retains compiled RAG context and explicit coverage state', () => {
    assert.match(source, /Trạng thái bao phủ: \$\{JSON\.stringify\(groundingContext\)\}/);
    assert.match(source, /\$\{compiledPrompt\}/);
    assert.match(source, /không được ghi rõ là chưa thể xác minh|phải được ghi rõ là chưa thể xác minh/);
});

test('Grounding failure does not continue through the model queue', () => {
    assert.match(source, /if \(enableGoogleSearch\) \{[\s\S]*?\[CHẾ ĐỘ LLM FALLBACK\]/);
});

test('final legal answer prompt enforces concise-completeness limits', () => {
    assert.match(source, /tối đa 3–5 gạch đầu dòng ngắn/);
    assert.match(source, /800–1\.800 ký tự/);
    assert.match(source, /2\.500–4\.000 ký tự/);
    assert.match(source, /Không tự tạo thành một “quyền” riêng/);
});

test('structured citations are deduplicated by law, provision, and source URL', () => {
    assert.match(source, /\[citation\.lawName, citation\.dieu, citation\.khoan, citation\.sourceUrl\]/);
    assert.match(source, /if \(seen\.has\(key\)\) return false/);
});
