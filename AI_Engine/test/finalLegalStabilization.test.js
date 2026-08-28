const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getActiveModel, generateAnswerWithGemini, assembleLegalAnswer } = require('../src/services/geminiService');
const { createLatencyTracker } = require('../src/utils/latencyTracker');
const {
    FINAL_LEGAL_PRIMARY_MODEL, FINAL_LEGAL_FALLBACK_MODEL,
    prepareDeterministicEvidence, buildCacheKey, clearFinalAnswerCacheForTests, resolveModelPayload
} = require('../src/services/finalLegalStabilizationService');

const issues = [{ id: 'Q1', query: 'Vấn đề một' }, { id: 'Q2', query: 'Vấn đề hai' }];
const documents = () => [
    { id: 'doc-b', title: 'Luật B', category: 'Dân sự', dieu: 'Điều 2', content: 'Bộ luật dân sự B', score: 0.9, sourceUrl: 'https://vbpl.vn/luat-b', supportedIssueIds: ['Q1'], authorityRoles: { Q1: 'SUPPORTING' } },
    { id: 'doc-c', title: 'Luật C', category: 'Dân sự', dieu: 'Điều 3', content: 'Bộ luật dân sự C', score: 0.7, supportedIssueIds: ['Q2'], authorityRoles: { Q2: 'PRIMARY' } },
    { id: 'doc-a', title: 'Luật A', category: 'Dân sự', dieu: 'Điều 1', content: 'Bộ luật dân sự A', score: 0.8, sourceUrl: 'https://vbpl.vn/luat-a', supportedIssueIds: ['Q1'], authorityRoles: { Q1: 'PRIMARY' } },
    { id: 'bad', title: 'Sai chế độ', dieu: 'Điều 9', content: 'bad', score: 1, supportedIssueIds: ['Q1'], authorityRoles: { Q1: 'REJECTED' } }
];

function streamResult(text) {
    return { stream: (async function* () { yield { text: () => text }; })(), response: Promise.resolve({ text: () => text, candidates: [{}] }) };
}

test('final legal routing uses 3.1 lite primary and calls no fallback after success', async () => {
    const previous = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'offline';
    const calls = [];
    try {
        const result = await getActiveModel('prompt', true, [], false, false, '', null, true, false, {}, null, null, {
            finalLegalRouting: true,
            genAI: { getGenerativeModel: config => { calls.push(config.model); return { generateContentStream: async () => streamResult('{}') }; } }
        });
        assert.equal(result.model, FINAL_LEGAL_PRIMARY_MODEL);
        assert.deepEqual(calls, [FINAL_LEGAL_PRIMARY_MODEL]);
    } finally {
        if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous;
    }
});

test('final legal primary failure falls back only to 3.5 lite', async () => {
    const previous = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'offline';
    const calls = [];
    try {
        const result = await getActiveModel('prompt', true, [], false, false, '', null, true, false, {}, null, null, {
            finalLegalRouting: true,
            genAI: { getGenerativeModel: config => {
                calls.push(config.model);
                return config.model === FINAL_LEGAL_PRIMARY_MODEL
                    ? { generateContentStream: async () => { throw new Error('offline primary failure'); } }
                    : { generateContentStream: async () => streamResult('{}') };
            } }
        });
        assert.equal(result.model, FINAL_LEGAL_FALLBACK_MODEL);
        assert.deepEqual(calls, [FINAL_LEGAL_PRIMARY_MODEL, FINAL_LEGAL_FALLBACK_MODEL]);
    } finally {
        if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous;
    }
});

test('deterministic evidence order is role, score, stable identity and excludes REJECTED', () => {
    const first = prepareDeterministicEvidence(documents(), issues);
    const second = prepareDeterministicEvidence(documents().reverse(), issues);
    assert.deepEqual(first.map(item => [item.id, item.originalEvidenceId]), [['E1', 'doc-a'], ['E2', 'doc-b'], ['E3', 'doc-c']]);
    assert.deepEqual(second.map(item => [item.id, item.originalEvidenceId]), first.map(item => [item.id, item.originalEvidenceId]));
    assert.equal(first.some(item => item.originalEvidenceId === 'bad'), false);
});

test('same validated question/evidence caches, while evidence or schema version changes miss', async () => {
    clearFinalAnswerCacheForTests();
    let calls = 0;
    const payload = {
        conclusion: 'Kết luận ổn định',
        analysis: [{ issueId: 'Q1', text: 'Một', evidenceIds: ['E1'] }, { issueId: 'Q2', text: 'Hai', evidenceIds: ['E3'] }],
        legalBasisEvidenceIds: ['E1', 'E3'], advice: 'Thực hiện phù hợp.'
    };
    const run = (docs, promptSchemaVersion = 'schema-a') => generateAnswerWithGemini('  Cùng một CÂU hỏi  ', docs, [], true, {
        expectedIssues: issues, ragAlreadySelected: true, promptSchemaVersion, logUsage: async () => {},
        getActiveModel: async () => { calls += 1; return { text: JSON.stringify(payload), grounded: false }; }
    });
    const first = await run(documents());
    const hit = await run(documents().reverse());
    assert.equal(first.cacheHit, false);
    assert.equal(hit.cacheHit, true);
    assert.equal(hit.finalModelCalls, 0);
    assert.equal(calls, 1);
    assert.equal(first.answer, hit.answer);
    assert.match(hit.answer, /\[Điều 1 - Luật A\]\(https:\/\/vbpl\.vn\/luat-a\)/);
    const changed = documents(); changed[2] = { ...changed[2], content: 'A changed' };
    await run(changed);
    await run(changed, 'schema-b');
    assert.equal(calls, 3);
    assert.notEqual(buildCacheKey({ userQuestion: 'x', documents: prepareDeterministicEvidence(documents(), issues), promptSchemaVersion: 'a' }), buildCacheKey({ userQuestion: 'x', documents: prepareDeterministicEvidence(documents(), issues), promptSchemaVersion: 'b' }));
});

test('complex optimization uses one core-only canonical pack for prompt, validation, URLs and model call', async () => {
    clearFinalAnswerCacheForTests();
    const twelveIssues = Array.from({ length: 4 }, (_, index) => ({ id: `Q${index + 1}`, query: `Issue ${index + 1}` }));
    const twelveDocs = Array.from({ length: 12 }, (_, index) => {
        const issueId = `Q${(index % 4) + 1}`;
        return {
            id: `source-${index + 1}`, title: `Law ${index + 1}`, dieu: `Điều ${index + 1}`,
            content: `Bộ luật dân sự verified content ${index + 1}`, category: 'Dân sự', sourceUrl: `https://vbpl.vn/source-${index + 1}`,
            finalScore: 1 - index / 100, supportedIssueIds: [issueId], authorityRoles: { [issueId]: index < 4 ? 'PRIMARY' : 'SUPPORTING' }
        };
    });
    let calls = 0;
    let promptPack;
    let validationPack;
    const payload = {
        conclusion: 'Stable',
        analysis: twelveIssues.map((issue, index) => ({ issueId: issue.id, text: `Analysis ${issue.id}`, evidenceIds: [`E${index + 1}`] })),
        legalBasisEvidenceIds: Array.from({ length: 4 }, (_, index) => `E${index + 1}`), advice: 'Advice'
    };
    const result = await generateAnswerWithGemini('Twelve verified sources', twelveDocs, [], true, {
        expectedIssues: twelveIssues, ragAlreadySelected: true, logUsage: async () => {},
        getActiveModel: async (_prompt, _json, relatedDocs, _search, _pro, _question, _schema, _details, _selected, _grounding, _latency, _progress, dependencies) => {
            calls += 1;
            promptPack = relatedDocs;
            validationPack = dependencies.serializedEvidenceDocuments;
            return { text: JSON.stringify(payload), grounded: false };
        }
    });
    assert.equal(promptPack.length, 4);
    assert.strictEqual(promptPack, validationPack);
    assert.equal(result.validationDocuments.length, 4);
    assert.equal(result.citations.length, 4);
    assert.equal(result.citations[0].sourceUrl, promptPack[0].sourceUrl);
    assert.equal(calls, 1);
});

test('final input telemetry reads the exact non-empty canonical evidence array', async () => {
    const previous = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'offline';
    const pack = Array.from({ length: 12 }, (_, index) => ({
        id: `E${index + 1}`, title: `Law ${index + 1}`, dieu: `Điều ${index + 1}`,
        content: `Verified ${index + 1}`, supportedIssueIds: ['Q1'], authorityRoles: { Q1: index === 0 ? 'PRIMARY' : 'SUPPORTING' }
    }));
    const latency = createLatencyTracker();
    try {
        await getActiveModel('prompt', true, pack, false, false, 'question', null, true, true, {}, latency, null, {
            finalLegalRouting: true, serializedEvidenceDocuments: pack,
            genAI: { getGenerativeModel: () => ({ generateContentStream: async () => streamResult('{}') }) }
        });
        const telemetry = latency.details.find(item => item.type === 'finalInputCost');
        assert.equal(telemetry.finalEvidenceCount, 12);
        assert.equal(telemetry.primaryEvidenceCount, 1);
        assert.equal(telemetry.supportingEvidenceCount, 11);
        assert.ok(telemetry.totalEvidenceChars > 0);
    } finally {
        if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous;
    }
});

test('mismatched non-empty handoff fails fast instead of calling Gemini without evidence', async () => {
    const previous = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'offline';
    let calls = 0;
    try {
        await assert.rejects(() => getActiveModel('prompt', true,
            [{ id: 'original', content: 'verified' }], false, false, 'question', null, true, true, {}, null, null, {
                finalLegalRouting: true,
                serializedEvidenceDocuments: [{ id: 'E1', content: 'verified', supportedIssueIds: ['Q1'], authorityRoles: { Q1: 'PRIMARY' } }],
                genAI: { getGenerativeModel: () => { calls += 1; return { generateContentStream: async () => streamResult('{}') }; } }
            }), error => error.code === 'FINAL_EVIDENCE_HANDOFF_INVALID');
        assert.equal(calls, 0);
    } finally {
        if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous;
    }
});

test('fallback prose containing kết luận does not create a fifth heading', () => {
    const answer = assembleLegalAnswer({
        conclusion: 'Chưa thể kết luận chung.',
        analysis: [{ issueId: 'Q1', content: 'Phần này chưa đủ căn cứ đã xác minh để kết luận chắc chắn; cần bổ sung dữ kiện hoặc nguồn pháp lý phù hợp.' }],
        legalBasis: [], advice: 'Bổ sung hồ sơ.'
    }, []);
    for (const heading of ['Kết luận:', 'Phân tích:', 'Cơ sở pháp lý:', 'Lời khuyên:']) {
        assert.equal(answer.split(heading).length - 1, 1);
    }
    assert.match(answer, /để kết luận chắc chắn/);
});

test('real complex path preserves 4 analyses with core-only citations without frontend prose rewriting', async () => {
    clearFinalAnswerCacheForTests();
    const expectedIssues = Array.from({ length: 4 }, (_, index) => ({ id: `Q${index + 1}`, query: `Issue ${index + 1}` }));
    const sourceDocuments = expectedIssues.flatMap(issue => [
        {
            id: `primary-${issue.id}`, title: `Primary ${issue.id}`, dieu: `Điều P${issue.id.slice(1)}`,
            content: `Bộ luật dân sự primary rule ${issue.id}`, category: 'Dân sự', sourceUrl: `https://vbpl.vn/primary-${issue.id.toLowerCase()}`, supportedIssueIds: [issue.id], authorityRoles: { [issue.id]: 'PRIMARY' }
        },
        ...Array.from({ length: issue.id === 'Q4' ? 2 : 3 }, (_, index) => ({
            id: `support-${issue.id}-${index + 1}`, title: `Supporting ${issue.id}-${index + 1}`,
            dieu: `Điều S${issue.id.slice(1)}${index + 1}`, content: `Bộ luật dân sự supporting rule ${issue.id}-${index + 1}`, category: 'Dân sự',
            sourceUrl: `https://vbpl.vn/support-${issue.id.toLowerCase()}-${index + 1}`,
            supportedIssueIds: [issue.id], authorityRoles: { [issue.id]: 'SUPPORTING' }
        }))
    ]);
    const canonical = prepareDeterministicEvidence(sourceDocuments, expectedIssues);
    const supportingIds = canonical.filter(document => Object.values(document.authorityRoles).includes('SUPPORTING')).map(document => document.id);
    const primaryIds = canonical.filter(document => Object.values(document.authorityRoles).includes('PRIMARY')).map(document => document.id);
    assert.equal(supportingIds.length, 11);
    assert.equal(primaryIds.length, 4);
    const analysisText = Object.fromEntries(expectedIssues.map(issue => [issue.id, `Chưa đủ căn cứ để kết luận chắc chắn. ${issue.id}`]));
    let payload;
    let modelCalls = 0;
    const result = await generateAnswerWithGemini('Neighbor assault offline replay', sourceDocuments, [], true, {
        expectedIssues, ragAlreadySelected: true, logUsage: async () => {},
        getActiveModel: async (_prompt, _json, relatedDocs) => {
            modelCalls += 1;
            payload = {
                conclusion: 'Kết luận chung từ chứng cứ đã xác minh.',
                analysis: expectedIssues.map(issue => ({ issueId: issue.id, text: analysisText[issue.id], evidenceIds: relatedDocs.filter(document => document.authorityRoles[issue.id] === 'PRIMARY').map(document => document.id) })),
                legalBasisEvidenceIds: relatedDocs.map(document => document.id), advice: 'Lưu giữ hồ sơ liên quan.'
            };
            return { text: JSON.stringify(payload), grounded: false };
        }
    });

    assert.equal(modelCalls, 1);
    assert.equal(result.citations.length, 4);
    assert.deepEqual(result.structuredAnswer.analysis.map(item => [item.issueId, item.content]), expectedIssues.map(issue => [issue.id, analysisText[issue.id]]));
    assert.equal(result.integrity.valid, true);
    assert.equal(result.verifierCalls, 0);
    assert.equal(result.repairCalls, 0);
    assert.equal(result.repairTriggered, false);
    assert.doesNotMatch(result.answer, /Phần này chưa đủ căn cứ đã xác minh/);
    for (const heading of ['Kết luận:', 'Phân tích:', 'Cơ sở pháp lý:', 'Lời khuyên:']) {
        assert.equal(result.answer.split(heading).length - 1, 1);
    }
    assert.match(result.answer, /Chưa đủ căn cứ để kết luận chắc chắn\./);

    const frontendSource = fs.readFileSync(path.join(__dirname, '../../Frontend/src/components/ChatbotAI.jsx'), 'utf8');
    assert.doesNotMatch(frontendSource, /titles\.forEach|new RegExp\(`\(\[\\\\s/);

    const invalidPayload = structuredClone(payload);
    invalidPayload.analysis[0].evidenceIds.push('E999');
    const resolved = resolveModelPayload(invalidPayload, canonical, expectedIssues);
    const invalidCitation = resolved.citations.find(citation => citation.evidenceId === 'E999');
    assert.equal(invalidCitation.invalidEvidenceId, true);
});

test('UNKNOWN evidence cannot become a canonical or rendered citation', async () => {
    clearFinalAnswerCacheForTests();
    const expectedIssues = [{ id: 'Q1', query: 'Trách nhiệm hình sự do gây thương tích' }];
    const rejectedUnknown = [{
        id: 'unknown-source', title: 'Quy định kỹ thuật', dieu: '35', content: 'Nội dung kỹ thuật',
        supportedIssueIds: ['Q1'], authorityRoles: { Q1: 'REJECTED' },
        eligibilityByIssue: { Q1: { eligible: false, authorityRole: 'REJECTED', coreAuthorityFit: false, reasons: ['unknown_legal_regime'] } }
    }];
    let promptPack;
    await assert.rejects(generateAnswerWithGemini('Offline unknown citation', rejectedUnknown, [], true, {
        expectedIssues, ragAlreadySelected: true, logUsage: async () => {},
        getActiveModel: async (_prompt, _json, documents) => {
            promptPack = documents;
            return { text: JSON.stringify({
                conclusion: 'Không dùng nguồn không xác định.',
                analysis: [{ issueId: 'Q1', text: 'Phân tích giữ nguyên.', evidenceIds: ['E1'] }],
                legalBasisEvidenceIds: ['E1'], advice: 'Bổ sung nguồn phù hợp.'
            }), grounded: false };
        }
    }), error => error.code === 'SOURCE_UNAVAILABLE');
    assert.equal(promptPack.length, 0);
});

test('invalid article metadata is defensively excluded from the canonical model pack', () => {
    const malformed = [{
        id: 'upstream-primary', title: 'Bộ luật Hình sự', dieu: ' unknown ', content: 'Nội dung',
        supportedIssueIds: ['Q1'], authorityRoles: { Q1: 'PRIMARY' }
    }];
    assert.deepEqual(prepareDeterministicEvidence(malformed, [{ id: 'Q1', query: 'Vấn đề' }]), []);
});
