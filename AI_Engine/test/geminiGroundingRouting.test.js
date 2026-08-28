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
    generateAnswerWithGemini,
    isRagOutdated,
    classifyGenerationFailure
} = require('../src/services/geminiService');

test('generation failures distinguish stream transport, rate limit, service availability, timeout, and API errors', () => {
    assert.equal(classifyGenerationFailure(new TypeError('response.body.pipeThrough is not a function')), 'STREAM_TRANSPORT_UNSUPPORTED');
    assert.equal(classifyGenerationFailure(new Error('429 quota exceeded')), 'RATE_LIMIT');
    assert.equal(classifyGenerationFailure(new Error('503 SERVICE_UNAVAILABLE')), 'SERVICE_UNAVAILABLE');
    assert.equal(classifyGenerationFailure(new Error('TIMEOUT_EXCEEDED')), 'TIMEOUT');
    assert.equal(classifyGenerationFailure(new Error('socket closed')), 'API_ERROR');
});

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

test('grounded Markdown is preserved and real source metadata is retained without JSON parsing', () => {
    const markdown = '**Kết luận**\n\nNội dung đã được kiểm tra.';
    const normalized=normalizeGeminiResponse({
        text:markdown,grounded:true,
        groundingRescue:{issueIds:['Q2']},
        groundingMetadata:{groundingChunks:[{web:{title:'VBPL',uri:'https://vbpl.vn/detail'}}],groundingSupports:[]}
    });
    assert.equal(normalized.answer,markdown);
    assert.equal(normalized.citations.length,1);
    assert.equal(normalized.citations[0].sourceUrl,'https://vbpl.vn/detail');
    assert.equal(normalized.citations[0].lawName,'VBPL');
});

test('grounded Markdown with no grounding chunks does not fabricate citations', () => {
    const normalized = normalizeGeminiResponse({ text: '**Kết luận** Không có nguồn.', grounded: true, groundingMetadata: null }, true);
    assert.equal(normalized.answer, '**Kết luận** Không có nguồn.');
    assert.deepEqual(normalized.citations, []);
});

test('successful grounded Markdown reaches the controller response shape without structured finalization', async () => {
    const markdown = '**Kết luận**\n\nCâu trả lời grounded.';
    const result = await generateAnswerWithGemini('Offline grounded response', [], [], true, {
        expectedIssues: [{ id: 'Q1', query: 'Vấn đề cần grounding' }],
        allowGrounding: true,
        ragAlreadySelected: true,
        logUsage: async () => {},
        getActiveModel: async () => ({
            text: markdown,
            grounded: true,
            groundingMetadata: { groundingChunks: [{ web: { title: 'Nguồn VBPL', uri: 'https://vbpl.vn/grounded' } }], groundingSupports: [] }
        })
    });
    assert.equal(result.answer, markdown);
    assert.deepEqual(result.citations.map(citation => citation.sourceUrl), ['https://vbpl.vn/grounded']);
    assert.equal(result.verifiedRagCount, 0);
    assert.equal(result.verifiedGroundingCount, 1);
});

test('grounding call success with empty metadata rejects a model-written valid VBPL ItemID URL', async () => {
    const modelUrl = 'https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=999999';
    await assert.rejects(generateAnswerWithGemini('Offline zero-source grounding', [], [], true, {
        expectedIssues: [{ id: 'Q1', query: 'Vấn đề chưa có nguồn' }],
        allowGrounding: true,
        ragAlreadySelected: true,
        logUsage: async () => {},
        getActiveModel: async () => ({
            text: `**Kết luận**\n\nPhân tích không được xác minh [VBPL](${modelUrl}).`,
            grounded: true,
            groundingMetadata: { groundingChunks: [], groundingSupports: [] }
        })
    }), error => error.code === 'SOURCE_UNAVAILABLE');
});

test('grounded text keeps only exact normalized URLs from genuine metadata', async () => {
    const verifiedUrl = 'https://vbpl.vn/van-ban/chi-tiet/verified';
    const inventedUrl = 'https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=123456';
    const result = await generateAnswerWithGemini('Offline exact provenance', [], [], true, {
        expectedIssues: [{ id: 'Q1', query: 'Vấn đề có nguồn' }],
        allowGrounding: true,
        ragAlreadySelected: true,
        logUsage: async () => {},
        getActiveModel: async () => ({
            text: `Nguồn thật [A](${verifiedUrl}) và nguồn tự viết [B](${inventedUrl}).`,
            grounded: true,
            groundingMetadata: { groundingChunks: [{ web: { title: 'Nguồn thật', uri: `${verifiedUrl}#fragment` } }], groundingSupports: [] }
        })
    });
    assert.match(result.answer, /\[A\]\(https:\/\/vbpl\.vn\/van-ban\/chi-tiet\/verified\)/u);
    assert.doesNotMatch(result.answer, /ItemID=123456/u);
    assert.equal(result.verifiedGroundingCount, 1);
});

test('partial verified RAG survives zero-citation Grounding and unsupported URLs do not', async () => {
    const document = { id: 'rag-1', title: 'Luật mẫu', dieu: 'Điều 10', content: 'Điều 10. Nghĩa vụ đã được xác minh.', sourceUrl: 'https://vbpl.vn/van-ban/chi-tiet/rag-1', supportedIssueIds: ['Q1'], authorityRoles: { Q1: 'PRIMARY' } };
    const result = await generateAnswerWithGemini('Offline partial rescue', [document], [], true, {
        expectedIssues: [{ id: 'Q1', query: 'Vấn đề có RAG' }, { id: 'Q2', query: 'Vấn đề thiếu nguồn' }],
        allowGrounding: true,
        ragAlreadySelected: true,
        logUsage: async () => {},
        getActiveModel: async () => ({
            text: 'Q1 được hỗ trợ. Q2 chưa thể xác minh. [RAG](https://vbpl.vn/van-ban/chi-tiet/rag-1) [Bịa](https://vbpl.vn/fake)',
            grounded: true,
            groundingMetadata: { groundingChunks: [], groundingSupports: [] }
        })
    });
    assert.equal(result.verifiedRagCount, 1);
    assert.equal(result.verifiedGroundingCount, 0);
    assert.equal(result.groundingCallSucceeded, true);
    assert.match(result.answer, /chi-tiet\/rag-1/u);
    assert.doesNotMatch(result.answer, /vbpl\.vn\/fake/u);
});

test('final integrity rejects broadening a verified bounded percentage range', async () => {
    const document = { id: 'range-1', title: 'Luật mẫu', dieu: 'Điều 10', content: 'Tỷ lệ từ 11% đến 30% thì áp dụng quy định.', sourceUrl: 'https://vbpl.vn/van-ban/chi-tiet/range-1', supportedIssueIds: ['Q1'], authorityRoles: { Q1: 'PRIMARY' } };
    await assert.rejects(generateAnswerWithGemini('Offline numeric boundary', [document], [], false, {
        expectedIssues: [{ id: 'Q1', query: 'Ngưỡng tỷ lệ' }],
        ragAlreadySelected: true,
        logUsage: async () => {},
        getActiveModel: async () => ({ text: 'Áp dụng cho tỷ lệ từ 11% trở lên.', grounded: false, groundingMetadata: null })
    }), error => error.code === 'FINAL_RESPONSE_INTEGRITY_INVALID');
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
    assert.match(normalized.answer, /grounded answer/);
    assert.equal(normalized.citations.length, 1);
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

test('final chatbot path permits only one synthesis and has no verifier or repair call', () => {
    const finalAnswerFunction = source.match(/async function generateAnswerWithGemini[\s\S]*?^}/m)?.[0] || '';
    assert.equal((finalAnswerFunction.match(/await activeModelCall\(/g) || []).length, 1);
    assert.doesNotMatch(finalAnswerFunction, /applyRiskBasedVerification|repairPrompt|verifierGenerate|costStage:\s*['"]repair['"]/i);
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

test('Grounding failure with zero verified RAG fails closed before ungrounded fallback', () => {
    assert.match(source, /if \(!ungroundedFallbackAllowed\) \{[\s\S]*?SOURCE_UNAVAILABLE[\s\S]*?throw sourceError/);
    assert.match(source, /verifiedRagCount > 0/);
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

test('only preserved verified RAG permits a non-grounded synthesis after Grounding failure', () => {
    assert.match(source, /decision: ungroundedFallbackAllowed \? 'PRESERVED_RAG_ONLY' : 'SOURCE_UNAVAILABLE'/);
    assert.match(source, /Chỉ được tổng hợp những phần đã có bằng chứng RAG được bảo toàn/);
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
