const test = require('node:test');
const assert = require('node:assert/strict');
const {
    PRIMARY_MODEL,
    assessLegalAnswerRisk,
    verifyLegalDraft,
    applyRiskBasedVerification
} = require('../src/services/legalAnswerVerifierService');
const { createLatencyTracker, snapshot } = require('../src/utils/latencyTracker');
const { generateAnswerWithGemini } = require('../src/services/geminiService');

const issue = id => ({ id, query: `Vấn đề ${id}` });
const draft = {
    answer: 'Kết luận:\nHợp lệ',
    structuredAnswer: { analysis: [{ issueId: 'Q1', content: 'A' }, { issueId: 'Q2', content: 'B' }] },
    citations: []
};
const verdict = (value, extras = {}) => JSON.stringify({
    verdict: value,
    confidence: value === 'PASS' ? 'HIGH' : 'MEDIUM',
    failedIssueIds: [], unsupportedClaims: [], wrongRegimeClaims: [], factUncertainties: [], repairInstructions: [],
    ...extras
});

test('low-risk legal answer skips verifier', async () => {
    let calls = 0;
    const result = await applyRiskBasedVerification({ userQuestion: 'Thời hạn là gì?', expectedIssues: [issue('Q1')], documents: [], citations: [], integrity: { valid: true }, normalizedDraft: draft }, { generate: async () => { calls += 1; return verdict('PASS'); } });
    assert.equal(result.verifierSkipped, true);
    assert.equal(calls, 0);
});

test('high-risk correct draft passes unchanged', async () => {
    const result = await applyRiskBasedVerification({ userQuestion: 'Tranh chấp hợp đồng', expectedIssues: [issue('Q1')], documents: [], citations: [], integrity: { valid: true }, normalizedDraft: draft }, { generate: async () => verdict('PASS') });
    assert.strictEqual(result.answer, draft);
    assert.equal(result.verification.verdict, 'PASS');
});

test('supported law with missing facts returns WARN without repair', async () => {
    let repairs = 0;
    const result = await applyRiskBasedVerification({ userQuestion: 'Tranh chấp lao động', expectedIssues: [issue('Q1')], normalizedDraft: draft }, { generate: async () => verdict('WARN', { confidence: 'LOW', factUncertainties: ['Thiếu hợp đồng'] }), repair: async () => { repairs += 1; } });
    assert.equal(result.verification.verdict, 'WARN');
    assert.equal(result.verification.confidence, 'LOW');
    assert.equal(repairs, 0);
});

test('wrong-regime FAIL triggers exactly one repair', async () => {
    let repairs = 0;
    const repaired = { answer: 'repaired' };
    const result = await applyRiskBasedVerification({ userQuestion: 'Khởi tố hình sự', expectedIssues: [issue('Q1')], normalizedDraft: draft }, {
        generate: async () => verdict('FAIL', { failedIssueIds: ['Q1'], wrongRegimeClaims: ['Mediation is not procedure'], repairInstructions: ['Use criminal procedure evidence'] }),
        repair: async () => { repairs += 1; return repaired; }
    });
    assert.equal(result.repairTriggered, true);
    assert.equal(repairs, 1);
    assert.strictEqual(result.answer, repaired);
});

test('one failed issue preserves valid issue content through bounded repair input', async () => {
    const result = await applyRiskBasedVerification({ userQuestion: 'Tranh chấp hợp đồng nhiều vấn đề', expectedIssues: [issue('Q1'), issue('Q2')], normalizedDraft: draft }, {
        generate: async () => verdict('FAIL', { failedIssueIds: ['Q2'] }),
        repair: async ({ failedIssueIds }) => ({ ...draft, structuredAnswer: { analysis: [draft.structuredAnswer.analysis[0], { issueId: 'Q2', content: 'fixed' }] }, failedIssueIds })
    });
    assert.equal(result.answer.structuredAnswer.analysis[0].content, 'A');
    assert.deepEqual(result.answer.failedIssueIds, ['Q2']);
});

test('repair success is returned and metrics record one cycle', async () => {
    const latency = createLatencyTracker();
    const result = await applyRiskBasedVerification({ userQuestion: 'Tranh chấp đất đai', expectedIssues: [issue('Q1')], normalizedDraft: draft }, { latency, generate: async () => verdict('FAIL', { failedIssueIds: ['Q1'] }), repair: async () => ({ answer: 'fixed' }) });
    const metrics = snapshot(latency, 1);
    assert.equal(result.answer.answer, 'fixed');
    assert.equal(metrics.verifierCalls, 1);
    assert.equal(metrics.verifierVerdict, 'FAIL');
    assert.equal(metrics.repairTriggered, true);
    assert.equal(metrics.repairedIssueCount, 1);
});

test('invalid repair can return safe partial without fabrication', async () => {
    const result = await applyRiskBasedVerification({ userQuestion: 'Khởi tố hình sự', expectedIssues: [issue('Q1'), issue('Q2')], normalizedDraft: draft }, {
        generate: async () => verdict('FAIL', { failedIssueIds: ['Q2'] }),
        repair: async () => ({ answer: 'Q1 verified; Q2 chưa đủ cơ sở', incomplete: true, unresolvedIssueIds: ['Q2'] })
    });
    assert.equal(result.answer.incomplete, true);
    assert.deepEqual(result.answer.unresolvedIssueIds, ['Q2']);
});

test('verifier API failure does not block a deterministically valid draft', async () => {
    const result = await applyRiskBasedVerification({ userQuestion: 'Tranh chấp hợp đồng', expectedIssues: [issue('Q1')], integrity: { valid: true }, normalizedDraft: draft }, { generate: async () => { throw new Error('offline failure'); } });
    assert.equal(result.verifierFailed, true);
    assert.strictEqual(result.answer, draft);
});

test('verifier requests contain no Search or Grounding tools', async () => {
    const calls = [];
    await verifyLegalDraft({ userQuestion: 'x', expectedIssues: [], draft: 'x', documents: [] }, { generate: async (model, _prompt, config) => { calls.push({ model, config }); return verdict('PASS'); } });
    assert.equal(calls[0].model, PRIMARY_MODEL);
    assert.deepEqual(calls[0].config, { search: false, grounding: false, tools: [] });
});

test('risk gate detects complex, multi-regime, Grounded and integrity-warning answers', () => {
    const risk = assessLegalAnswerRisk({ expectedIssues: [issue('Q1'), issue('Q2')], grounded: true, integrity: { valid: false }, documents: [{ title: 'Bộ luật Hình sự', content: 'tội phạm' }, { title: 'Bộ luật Dân sự', content: 'bồi thường thiệt hại ngoài hợp đồng' }] });
    assert.equal(risk.shouldVerify, true);
    assert.ok(risk.reasons.includes('complex_query'));
    assert.ok(risk.reasons.includes('multiple_regimes'));
    assert.ok(risk.reasons.includes('grounding_used'));
    assert.ok(risk.reasons.includes('integrity_warning'));
});

test('criminal-procedure issue with mediation-only integrity failure cannot remain PASS', async () => {
    let repaired = false;
    const result = await applyRiskBasedVerification({
        userQuestion: 'Hòa giải có làm chấm dứt khởi tố không?',
        expectedIssues: [{ id: 'Q1', query: 'Hòa giải và khởi tố theo tố tụng hình sự' }],
        documents: [{ id: 'M1', title: 'Luật Hòa giải', dieu: 'Hòa giải', content: 'Quy định hòa giải', supportedIssueIds: ['Q1'], authorityRoles: { Q1: 'SUPPORTING' } }],
        integrity: { valid: false, failures: [{ type: 'MISSING_PRIMARY_AUTHORITY', issueId: 'Q1' }] },
        normalizedDraft: draft
    }, {
        generate: async () => verdict('PASS'),
        repair: async ({ verification }) => { repaired = true; return { answer: 'repaired', verification }; }
    });
    assert.equal(result.verification.verdict, 'FAIL');
    assert.equal(repaired, true);
});

test('valid criminal-procedure PRIMARY evidence allows verifier PASS', async () => {
    const result = await applyRiskBasedVerification({
        userQuestion: 'Rút yêu cầu có ảnh hưởng khởi tố không?',
        expectedIssues: [{ id: 'Q1', query: 'Khởi tố theo yêu cầu của bị hại' }],
        documents: [{ id: 'P1', title: 'Bộ luật Tố tụng hình sự', dieu: 'Khởi tố theo yêu cầu của bị hại', content: 'Quy định việc rút yêu cầu.', supportedIssueIds: ['Q1'], authorityRoles: { Q1: 'PRIMARY' } }],
        integrity: { valid: true, failures: [] }, normalizedDraft: draft
    }, { generate: async () => verdict('PASS') });
    assert.equal(result.verification.verdict, 'PASS');
    assert.equal(result.repairTriggered, false);
});

test('complex non-Grounded production generation uses one final call and zero verifier or repair calls', async () => {
    const originalQuestion = 'Tôi có bị khởi tố hình sự không?';
    const expectedIssues = [{ id: 'Q1', query: 'Trách nhiệm hình sự và khởi tố' }];
    const documents = [{
        id: 'E1', title: 'Bộ luật Hình sự', dieu: 'Trách nhiệm hình sự',
        content: 'Quy định về trách nhiệm hình sự và tội phạm.',
        supportedIssueIds: ['Q1'], authorityRoles: { Q1: 'PRIMARY' }
    }];
    const finalPayload = {
        conclusion: 'Có thể phát sinh trách nhiệm khi đủ dấu hiệu.',
        analysis: [{ issueId: 'Q1', text: 'Cần đối chiếu các dấu hiệu trong chứng cứ.', evidenceIds: ['E1'] }],
        legalBasisEvidenceIds: ['E1'], advice: 'Cung cấp đầy đủ hồ sơ.'
    };
    let finalCalls = 0;
    let verifierCalls = 0;
    const latency = createLatencyTracker();
    const result = await generateAnswerWithGemini(originalQuestion, documents, [], true, {
        expectedIssues,
        latency,
        ragAlreadySelected: true,
        logUsage: async () => {},
        getActiveModel: async () => { finalCalls += 1; return { text: JSON.stringify(finalPayload), grounded: false, groundingMetadata: null }; },
        verifierGenerate: async () => { verifierCalls += 1; throw new Error('must not run'); }
    });
    assert.equal(finalCalls, 1);
    assert.equal(verifierCalls, 0);
    assert.equal(result.verifierCalls, 0);
    assert.equal(result.repairCalls, 0);
    assert.equal(result.repairTriggered, false);
    const metrics = snapshot(latency, 1);
    assert.equal(metrics.verifierCalls, 0);
    assert.equal(metrics.repairTriggered, false);
    assert.equal(latency.counts.repairCalls || 0, 0);
    assert.equal(result.structuredAnswer.analysis[0].issueId, 'Q1');
    assert.match(result.answer, /^Kết luận:/);
});

test('invalid evidence ID is removed without rewriting model analysis or making a second generation', async () => {
    const expectedIssues = ['Q1', 'Q2', 'Q3', 'Q4'].map(id => ({ id, query: `ISSUE_TEXT_${id}` }));
    const documents = expectedIssues.map((item, index) => ({
        id: `E${index + 1}`, title: `Law ${item.id}`, dieu: `Điều ${index + 1}`,
        content: `Verified rule for ${item.id}`, supportedIssueIds: [item.id], authorityRoles: { [item.id]: 'PRIMARY' }
    }));
    const finalPayload = {
        conclusion: 'Conclusion',
        analysis: expectedIssues.map(item => ({ issueId: item.id, text: `DRAFT_CONTENT_${item.id}`, evidenceIds: [`E${Number(item.id.slice(1))}`] })),
        legalBasisEvidenceIds: ['E1', 'E2', 'E3', 'E4'], advice: 'Advice'
    };
    let modelCalls = 0;
    const result = await generateAnswerWithGemini('Tranh chấp có bốn vấn đề', documents, [], true, {
        expectedIssues, ragAlreadySelected: true, logUsage: async () => {},
        getActiveModel: async (prompt) => {
            modelCalls += 1;
            const invalid = structuredClone(finalPayload);
            invalid.analysis[3].evidenceIds = ['E999'];
            invalid.legalBasisEvidenceIds[3] = 'E999';
            return { text: JSON.stringify(invalid), grounded: false };
        },
        verifierGenerate: async () => { throw new Error('must not run'); }
    });
    assert.equal(modelCalls, 1);
    assert.equal(result.structuredAnswer.analysis.find(item => item.issueId === 'Q1').content, 'DRAFT_CONTENT_Q1');
    assert.equal(result.structuredAnswer.analysis.find(item => item.issueId === 'Q3').content, 'DRAFT_CONTENT_Q3');
    assert.equal(result.structuredAnswer.analysis.find(item => item.issueId === 'Q4').content, 'DRAFT_CONTENT_Q4');
    assert.doesNotMatch(result.answer, /Unknown|null|undefined/);
    assert.ok(!result.citations.some(citation => citation.evidenceId === 'E4'));
    assert.ok(!result.citations.some(citation => citation.evidenceId === 'E999'));
    for (const heading of ['Kết luận:', 'Phân tích:', 'Cơ sở pháp lý:', 'Lời khuyên:']) {
        assert.equal(result.answer.split(heading).length - 1, 1);
    }
});
