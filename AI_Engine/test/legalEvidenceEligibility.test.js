const test = require('node:test');
const assert = require('node:assert/strict');

const fixture = require('./fixtures/legalEvidenceEligibility/neighborAssault.synthetic.json');
const {
    AUTHORITY_ROLES,
    DOCUMENT_REGIMES,
    ISSUE_PURPOSES,
    inferIssueContext,
    inferDocumentRegime,
    evaluateLegalEvidence
} = require('../src/services/legalEvidenceEligibilityService');
const { retrieveForIssues } = require('../src/services/multiQueryRagService');
const { validateLegalAnswerIntegrity } = require('../src/services/legalAnswerIntegrityService');
const { prepareDeterministicEvidence } = require('../src/services/finalLegalStabilizationService');
const { buildComplexIssueContract } = require('../src/services/geminiService');

function passThroughSelector(_query, docs) {
    return {
        selectedDocs: docs,
        scores: docs.map(doc => ({ id: doc.id, finalScore: doc.score })),
        fallbackAll: true,
        reason: 'synthetic replay selector'
    };
}

function documentById(id) {
    return fixture.documents.find(document => document.id === id);
}

function replayEvidence(overrides = {}) {
    return Object.fromEntries(fixture.issues.map(issue => [
        issue.query,
        (overrides[issue.id] || fixture.evidenceByIssue[issue.id]).map(documentById)
    ]));
}

async function runReplay(overrides = {}) {
    const evidence = replayEvidence(overrides);
    return retrieveForIssues(fixture.issues, {
        statusQuery: fixture.userQuery,
        cap: 12,
        concurrency: 1,
        ragService: { query: async query => (evidence[query] || []).map(document => ({ ...document, articleTitle: document.dieu, dieu: `Điều ${fixture.documents.findIndex(item => item.id === document.id) + 1}` })) },
        selectRagChunks: passThroughSelector,
        rerankEvidence: async payload => ({ issues: payload.map(row => {
            const preferred = { Q1:'criminal-code-injury', Q2:'criminal-code-injury', Q3:'civil-health-damages', Q4:'criminal-procedure-victim-request' }[row.issueId];
            const core = row.candidates.find(candidate => candidate.candidateId === preferred);
            return { issueId: row.issueId, coreSelection: core ? { candidateId: core.candidateId, evidenceSpanIds: [`${core.candidateId}:S1`], reason: 'fixture' } : null, supportingSelection: null, confidence: core ? 'HIGH' : 'LOW', rejectedCandidates: [] };
        }) })
    });
}

test('synthetic fixture is explicitly non-historical and reproduces wrong-regime candidates', () => {
    assert.equal(fixture.synthetic_replay, true);
    assert.equal(fixture.historical_payload_reconstructed, false);
    assert.ok(documentById('state-compensation-health'));
    assert.ok(documentById('domestic-violence-reconciliation'));
});

test('neighbor assault rejects State compensation and domestic-violence scope mismatches', async () => {
    const result = await runReplay();
    const q3State = evaluateLegalEvidence({ issue: fixture.issues[2], userQuery: fixture.userQuery, document: documentById('state-compensation-health') });
    const q4Domestic = evaluateLegalEvidence({ issue: fixture.issues[3], userQuery: fixture.userQuery, document: documentById('domestic-violence-reconciliation') });

    assert.equal(q3State.authorityRole, AUTHORITY_ROLES.REJECTED);
    assert.deepEqual(q3State.reasons, ['state_compensation_scope_mismatch']);
    assert.equal(q4Domestic.authorityRole, AUTHORITY_ROLES.REJECTED);
    assert.deepEqual(q4Domestic.reasons, ['family_relationship_required']);
    assert.equal(result.forensicTrace.issues.find(item => item.issueId === 'Q3').candidates.some(item => item.candidateId === 'state-compensation-health'), false);
    assert.equal(result.forensicTrace.issues.find(item => item.issueId === 'Q4').candidates.some(item => item.candidateId === 'domestic-violence-reconciliation'), true);
    assert.equal(result.coverageComplete, true);
});

test('reconciliation retrieval without criminal-procedure authority is retrieval-covered but authority-incomplete', async () => {
    const result = await runReplay({ Q4: ['domestic-violence-reconciliation'] });
    assert.equal(result.retrievalCoverageCounts.Q4, 1);
    assert.equal(result.coverageDetails.Q4.retrievalCovered, true);
    assert.equal(result.coverageDetails.Q4.authorityCovered, false);
    assert.equal(result.coverageDetails.Q4.validationState, 'MISSING_CORE');
    assert.equal(result.coverageComplete, false);
});

test('correct criminal-procedure evidence establishes reconciliation authority coverage', async () => {
    const result = await runReplay({ Q4: ['criminal-procedure-victim-request', 'domestic-violence-reconciliation'] });
    assert.equal(result.coverageDetails.Q4.retrievalCovered, true);
    assert.equal(result.coverageDetails.Q4.authorityCovered, true);
    assert.equal(result.coverageDetails.Q4.validationState, 'VALIDATED_CORE');
    assert.equal(result.coverageComplete, true);
});

test('rejected mediation citation fails final criminal-procedure integrity validation without duplicating coverage', async () => {
    const result = await runReplay({ Q4: ['domestic-violence-reconciliation'] });
    const issue = fixture.issues.find(item => item.id === 'Q4');
    const integrity = validateLegalAnswerIntegrity({
        structuredAnswer: { analysis: [{ issueId: 'Q4', content: 'Phân tích' }] },
        citations: [{ evidenceId: 'domestic-violence-reconciliation', lawName: 'Luật Phòng, chống bạo lực gia đình', dieu: '17', supportedIssueIds: ['Q4'] }],
        expectedIssues: [issue],
        documents: [...result.documents, { ...documentById('domestic-violence-reconciliation'), supportedIssueIds: ['Q4'], authorityRoles: { Q4: 'REJECTED' } }],
        userQuery: fixture.userQuery
    });
    assert.equal(integrity.valid, false);
    assert.ok(!integrity.failures.some(item => item.type === 'MISSING_PRIMARY_AUTHORITY'));
    assert.ok(integrity.failures.some(item => item.type === 'REJECTED_CITATION'));
});

test('correct regime-specific primary citation passes final integrity validation', async () => {
    const result = await runReplay();
    const citations = result.documents.flatMap(document => (document.supportedIssueIds || [])
        .filter(issueId => document.authorityRoles?.[issueId] === 'PRIMARY')
        .map(issueId => ({ evidenceId: document.id, lawName: document.title, dieu: document.dieu, supportedIssueIds: [issueId] })));
    const integrity = validateLegalAnswerIntegrity({
        structuredAnswer: { analysis: fixture.issues.map(issue => ({ issueId: issue.id, content: 'Phân tích' })) },
        citations,
        expectedIssues: fixture.issues,
        documents: result.documents,
        userQuery: fixture.userQuery
    });
    assert.equal(integrity.valid, true, JSON.stringify(integrity.failures));
});

test('State compensation authority remains primary for covered State wrongdoing', () => {
    const evaluation = evaluateLegalEvidence({
        issue: { id: 'Q1', query: 'Yêu cầu bồi thường thiệt hại do bị bắt giữ trái pháp luật' },
        userQuery: 'Tôi bị cơ quan nhà nước bắt giữ trái pháp luật và yêu cầu Nhà nước bồi thường chi phí chữa bệnh.',
        document: documentById('state-compensation-health')
    });
    assert.equal(evaluation.eligible, true);
    assert.equal(evaluation.authorityRole, AUTHORITY_ROLES.PRIMARY);
});

test('domestic-violence authority remains primary for violence between family members', () => {
    const evaluation = evaluateLegalEvidence({
        issue: { id: 'Q1', query: 'Biện pháp hòa giải và phòng ngừa bạo lực giữa vợ chồng' },
        userQuery: 'Vợ chồng xảy ra bạo lực gia đình và cần biện pháp bảo vệ, hòa giải.',
        document: documentById('domestic-violence-reconciliation')
    });
    assert.equal(evaluation.eligible, true);
    assert.equal(evaluation.authorityRole, AUTHORITY_ROLES.PRIMARY);
});

test('multi-regime assault keeps criminal and civil primary authorities together', async () => {
    const result = await runReplay();
    const retained = new Set(result.documents.map(doc => doc.id));
    assert.equal(retained.has('criminal-code-injury'), true);
    assert.equal(retained.has('civil-health-damages'), true);
    assert.equal(retained.has('civil-fault'), false);
    assert.equal(result.coverageDetails.Q1.authorityCovered, true);
    assert.equal(result.coverageDetails.Q3.authorityCovered, true);
});

test('general Civil Code authority may support damages but cannot establish specific coverage alone', async () => {
    const result = await runReplay({ Q3: ['civil-general-compensation'] });
    const decision = evaluateLegalEvidence({ issue: fixture.issues[2], userQuery: fixture.userQuery, document: documentById('civil-general-compensation') });
    assert.equal(decision.eligible, true);
    assert.equal(decision.authorityRole, AUTHORITY_ROLES.SUPPORTING);
    assert.equal(result.coverageDetails.Q3.retrievalCovered, true);
    assert.equal(result.coverageDetails.Q3.authorityCovered, false);
    assert.equal(result.coverageComplete, false);
    assert.equal(result.documents.some(doc => doc.id === 'civil-general-compensation'), false);
});

test('high-score UNKNOWN regime remains available to the reranker but does not establish coverage', async () => {
    const issue = fixture.issues.find(item => item.id === 'Q1');
    const unknown = {
        id: 'high-score-unknown', title: 'Quy định kỹ thuật chuyên ngành', category: 'Lao động - Tiền lương',
        dieu: '35', content: 'Quy định chế độ đối với người lao động khi bị tai nạn lao động.', score: 0.999
    };
    const result = await retrieveForIssues([issue], {
        statusQuery: fixture.userQuery, cap: 12, concurrency: 1,
        ragService: { query: async () => [unknown] }, selectRagChunks: passThroughSelector
    });
    const evaluation = evaluateLegalEvidence({ issue: fixture.issues[0], userQuery: fixture.userQuery, document: unknown });
    assert.equal(evaluation.authorityRole, AUTHORITY_ROLES.REJECTED);
    assert.equal(evaluation.regimeFit, 'REJECT');
    assert.deepEqual(evaluation.reasons, ['unknown_legal_regime']);
    assert.equal(evaluation.scopeSignals.document.regime, DOCUMENT_REGIMES.UNKNOWN);
    assert.equal(result.documents.length, 0);
    assert.equal(prepareDeterministicEvidence(result.documents, [issue]).length, 0);
    assert.equal(result.coverageDetails.Q1.retrievalCovered, true);
    assert.equal(result.coverageDetails.Q1.authorityCovered, false);
    assert.equal(result.forensicTrace.issues[0].candidates.some(candidate => candidate.candidateId === unknown.id), true);
    assert.equal(result.coverageDetails.Q1.missingReason, 'reranker_returned_null');
});

test('generic amendment scope without a core proposition is rejected and cannot establish authority coverage', async () => {
    const issue = fixture.issues.find(item => item.id === 'Q1');
    const genericCriminalAmendment = {
        id: 'generic-criminal-amendment', title: 'Luật sửa đổi Bộ luật Hình sự', category: 'Hình sự',
        dieu: 'Điều 1', content: 'Sửa đổi quy định về hình phạt và bắt buộc chữa bệnh.', score: 0.99
    };
    const evaluation = evaluateLegalEvidence({ issue, userQuery: fixture.userQuery, document: genericCriminalAmendment });
    assert.equal(evaluation.authorityRole, AUTHORITY_ROLES.REJECTED);
    assert.equal(evaluation.coreAuthorityFit, false);
    const result = await retrieveForIssues([issue], {
        statusQuery: fixture.userQuery, concurrency: 1,
        ragService: { query: async () => [genericCriminalAmendment] }, selectRagChunks: passThroughSelector
    });
    assert.equal(result.coverageDetails.Q1.retrievalCovered, true);
    assert.equal(result.coverageDetails.Q1.authorityCovered, false);
    assert.equal(result.coverageDetails.Q1.missingReason, 'reranker_returned_null');
    const groundingAllowed = !result.coverageComplete || !result.targetVersionSatisfied;
    assert.equal(groundingAllowed, true);
});

test('applicable recognized PRIMARY with core proposition fit establishes coverage', async () => {
    const issue = fixture.issues.find(item => item.id === 'Q1');
    const evaluation = evaluateLegalEvidence({ issue, userQuery: fixture.userQuery, document: documentById('criminal-code-injury') });
    assert.equal(evaluation.authorityRole, AUTHORITY_ROLES.PRIMARY);
    assert.equal(evaluation.coreAuthorityFit, true);
    const result = await runReplay({ Q1: ['criminal-code-injury'] });
    assert.equal(result.coverageDetails.Q1.authorityCovered, true);
});

test('eligibility implementation contains no individual statute-name blacklist', () => {
    const source = require('node:fs').readFileSync(require.resolve('../src/services/legalEvidenceEligibilityService'), 'utf8');
    assert.doesNotMatch(source, /An toàn, vệ sinh lao động|Hòa giải ở cơ sở|Hòa giải, đối thoại tại Tòa án/);
});

test('decomposed issue text controls purpose despite criminal parent-query signals', () => {
    const parent = fixture.userQuery;
    const contexts = Object.fromEntries(fixture.issues.map(issue => [issue.id, inferIssueContext(issue, parent)]));
    assert.equal(contexts.Q1.purpose, ISSUE_PURPOSES.CRIMINAL_LIABILITY);
    assert.equal(contexts.Q2.purpose, ISSUE_PURPOSES.CRIMINAL_LIABILITY);
    assert.equal(contexts.Q3.purpose, ISSUE_PURPOSES.CIVIL_DAMAGE);
    assert.equal(contexts.Q4.purpose, ISSUE_PURPOSES.CRIMINAL_PROCEDURE);
    assert.equal(contexts.Q3.criminalLiability, false);
    assert.ok(contexts.Q3.parentSignalsIgnoredForPurpose.some(signal => signal.startsWith('criminalLiability:')));
    assert.equal(contexts.Q4.bodilyInjury, false);
    assert.ok(contexts.Q4.parentSignalsIgnoredForPurpose.some(signal => signal.startsWith('bodilyInjury:')));
});

test('reconciliation affecting criminal liability is procedural without broadening civil mediation', () => {
    const exactQ3 = inferIssueContext({
        query: 'Điều kiện và hiệu lực của việc hòa giải giữa các bên trong vụ án cố ý gây thương tích đối với việc miễn truy cứu trách nhiệm hình sự.'
    });
    const liabilityOnly = inferIssueContext({ query: 'Trách nhiệm hình sự đối với hành vi cố ý gây thương tích.' });
    const civilMediation = inferIssueContext({ query: 'Hòa giải tranh chấp hợp đồng dân sự giữa các bên.' });
    const explicitProcedure = inferIssueContext({ query: 'Rút yêu cầu khởi tố vụ án hình sự của bị hại.' });

    assert.equal(exactQ3.reconciliation, true);
    assert.equal(exactQ3.criminalLiability, true);
    assert.equal(exactQ3.criminalProcedure, false);
    assert.equal(exactQ3.purpose, ISSUE_PURPOSES.CRIMINAL_PROCEDURE);
    assert.equal(liabilityOnly.purpose, ISSUE_PURPOSES.CRIMINAL_LIABILITY);
    assert.notEqual(civilMediation.purpose, ISSUE_PURPOSES.CRIMINAL_PROCEDURE);
    assert.equal(explicitProcedure.purpose, ISSUE_PURPOSES.CRIMINAL_PROCEDURE);
});

test('content-only criminal-procedure language cannot promote an unrelated document regime', () => {
    const unrelated = {
        title: 'Luật chuyên ngành về điều kiện lao động', documentType: 'Luật', category: 'Lao động - Tiền lương',
        dieu: 'Điều 35', content: 'Khi có dấu hiệu tội phạm, hồ sơ được chuyển để khởi tố vụ án hình sự.'
    };
    const procedureLaw = {
        title: 'Bộ luật Tố tụng hình sự', law_name: 'Bộ luật Tố tụng hình sự', documentType: 'Bộ luật', category: 'Hình sự',
        dieu: 'Khởi tố theo yêu cầu của bị hại', content: 'Chỉ được khởi tố vụ án hình sự theo yêu cầu của bị hại.'
    };
    assert.equal(inferDocumentRegime(unrelated).regime, DOCUMENT_REGIMES.UNKNOWN);
    assert.equal(inferDocumentRegime(procedureLaw).regime, DOCUMENT_REGIMES.CRIMINAL_PROCEDURE);
});

test('generic Article 1 injury mention is rejected for independent unrelated issues', async () => {
    const generic = {
        id: 'generic-article-1', title: 'Luật sửa đổi, bổ sung một số điều của Bộ luật Hình sự',
        law_name: 'Luật sửa đổi, bổ sung một số điều của Bộ luật Hình sự', category: 'Hình sự',
        dieu: 'Điều 1', content: 'Sửa đổi một số quy định có nhắc đến thương tích.', score: 0.99
    };
    const selectedIssues = [fixture.issues[0], fixture.issues[2], fixture.issues[3]];
    const result = await retrieveForIssues(selectedIssues, {
        statusQuery: fixture.userQuery, concurrency: 1,
        ragService: { query: async () => [{ ...generic }] }, selectRagChunks: passThroughSelector
    });
    for (const issueId of ['Q1', 'Q3', 'Q4']) {
        const evaluation = evaluateLegalEvidence({ issue: fixture.issues.find(item => item.id === issueId), userQuery: fixture.userQuery, document: generic });
        assert.equal(evaluation.authorityRole, AUTHORITY_ROLES.REJECTED);
        assert.equal(evaluation.coreAuthorityFit, false);
        assert.deepEqual(evaluation.reasons, ['non_specific_article_scope']);
    }
    assert.equal(result.documents.length, 0);
    assert.equal(result.retrievalCoverageCounts.Q1, 2);
    assert.equal(result.coverageDetails.Q1.authorityCovered, false);
    assert.equal(result.coverageDetails.Q1.missingReason, 'reranker_returned_null');
    assert.equal(result.coverageComplete, false);
    assert.equal(!result.coverageComplete || !result.targetVersionSatisfied, true);
});

test('generic amendment Article 1 cannot become core authority from embedded injury language', async () => {
    const generic = {
        id: '100-2015-qh13_chunk_13',
        title: 'Luật sửa đổi, bổ sung một số điều của Bộ luật Hình sự',
        law_name: 'Luật sửa đổi, bổ sung một số điều của Bộ luật Hình sự',
        category: 'Hình sự', dieu: 'Điều 1', score: 0.99,
        content: 'Sửa đổi, bổ sung một số điều. Người nào cố ý gây thương tích hoặc gây tổn hại cho sức khỏe của người khác thì bị phạt tù.'
    };
    const issues = [
        { id: 'Q1', query: 'Trách nhiệm hình sự đối với hành vi cố ý gây thương tích.' },
        { id: 'Q3', query: 'Điều kiện và hiệu lực của việc hòa giải giữa các bên trong vụ án cố ý gây thương tích đối với việc miễn truy cứu trách nhiệm hình sự.' },
        { id: 'Q4', query: 'Trách nhiệm hình sự khi gây tổn hại cho sức khỏe người khác.' }
    ];
    for (const issue of issues) {
        const evaluation = evaluateLegalEvidence({ issue, document: generic });
        assert.equal(evaluation.coreAuthorityFit, false, issue.id);
        assert.notEqual(evaluation.authorityRole, AUTHORITY_ROLES.PRIMARY, issue.id);
    }
    const result = await retrieveForIssues(issues, {
        concurrency: 1,
        ragService: { query: async () => [{ ...generic }] },
        selectRagChunks: passThroughSelector
    });
    assert.deepEqual(Object.fromEntries(issues.map(issue => [issue.id, result.coverageDetails[issue.id].authorityCovered])), { Q1: false, Q3: false, Q4: false });
    assert.equal(result.coverageComplete, false);

    const identityOnly = evaluateLegalEvidence({
        issue: issues[0],
        document: { title: 'Bộ luật Hình sự', category: 'Hình sự', dieu: 'Điều 2', content: 'Quy định chung.' }
    });
    assert.equal(identityOnly.coreAuthorityFit, false);

    const metadataOnly = evaluateLegalEvidence({
        issue: issues[0],
        document: { title: 'Bộ luật Hình sự về thương tích và tổn hại cho sức khỏe', category: 'Hình sự', dieu: 'Điều 2', content: 'Quy định chung.' }
    });
    assert.equal(metadataOnly.coreAuthorityFit, false);
    assert.equal(evaluateLegalEvidence({ issue: issues[0], document: documentById('criminal-code-injury') }).authorityRole, AUTHORITY_ROLES.PRIMARY);
});

test('production-shaped amendment wrapper chunk is rejected despite operative embedded phrases', async () => {
    const issue = { id: 'Q1', query: 'Trách nhiệm hình sự đối với hành vi cố ý gây thương tích.' };
    const productionDocument = {
        id: '100-2015-qh13_chunk_13',
        doc_id: '100-2015-qh13',
        title: 'Luật Sửa đổi, bổ sung một số điều của Bộ luật Hình sự số 100/2015/QH13 số 12/2017/QH14',
        law_name: 'Luật Sửa đổi, bổ sung một số điều của Bộ luật Hình sự số 100/2015/QH13 số 12/2017/QH14',
        documentNumber: '100/2015/QH13', issueYear: 2015, documentType: '', category: 'Hình sự', status: 'Còn hiệu lực',
        dieu: 'Điều 1', chuong: 'Unknown', score: 0.99,
        content: 'ặc thủ đoạn có khả năng gây nguy hại cho nhiều người; h) Thuê gây thương tích hoặc gây tổn hại cho sức khỏe của người khác. 2. Phạm tội thuộc một trong các trường hợp sau đây, thì bị phạt tù từ 02 năm đến 06 năm.'
    };
    assert.equal('articleTitle' in productionDocument, false);
    assert.equal('text' in productionDocument, false);
    const evaluation = evaluateLegalEvidence({ issue, document: productionDocument });
    assert.equal(evaluation.coreAuthorityFit, false);
    assert.equal(evaluation.authorityRole, AUTHORITY_ROLES.REJECTED);
    assert.equal(evaluation.eligible, false);
    assert.deepEqual(evaluation.reasons, ['non_specific_article_scope']);

    const result = await retrieveForIssues([issue], {
        concurrency: 1,
        ragService: { query: async () => [productionDocument] },
        selectRagChunks: passThroughSelector
    });
    assert.equal(result.coverageDetails.Q1.authorityCovered, false);
    assert.equal(result.documents.length, 0);
    assert.equal(prepareDeterministicEvidence(result.documents, [issue]).length, 0);
});

test('invalid article metadata is rejected before coverage, final packing and Gemini context', async () => {
    const issue = { id: 'Q1', query: 'Trách nhiệm hình sự đối với hành vi cố ý gây thương tích.' };
    for (const article of [undefined, '', 'Unknown', ' unknown ', 'N/A', null]) {
        const document = {
            id: `invalid-${String(article)}`, title: 'Bộ luật Hình sự', category: 'Hình sự', dieu: article,
            content: 'Người nào cố ý gây thương tích hoặc gây tổn hại cho sức khỏe của người khác thì bị phạt tù.'
        };
        const evaluation = evaluateLegalEvidence({ issue, document });
        assert.equal(evaluation.eligible, false, String(article));
        assert.equal(evaluation.authorityRole, AUTHORITY_ROLES.REJECTED, String(article));
        assert.equal(evaluation.coreAuthorityFit, false, String(article));
    }

    const unknown = {
        id: '100-2015-qh13_chunk_12', title: 'Bộ luật Hình sự', category: 'Hình sự', dieu: 'Unknown', score: 0.999,
        content: 'Người nào cố ý gây thương tích hoặc gây tổn hại cho sức khỏe của người khác thì bị phạt tù.'
    };
    const result = await retrieveForIssues([issue], {
        concurrency: 1, ragService: { query: async () => [unknown] }, selectRagChunks: passThroughSelector
    });
    assert.equal(result.coverageDetails.Q1.authorityCovered, false);
    assert.equal(result.documents.length, 0);

    const malformedUpstream = [{ ...unknown, supportedIssueIds: ['Q1'], authorityRoles: { Q1: 'PRIMARY' } }];
    const finalPack = prepareDeterministicEvidence(malformedUpstream, [issue]);
    assert.equal(finalPack.length, 0);
    assert.doesNotMatch(buildComplexIssueContract([issue], finalPack), /Unknown|100-2015-qh13_chunk_12/);

    const valid = { ...documentById('criminal-code-injury'), supportedIssueIds: ['Q1'], authorityRoles: { Q1: 'PRIMARY' } };
    assert.equal(prepareDeterministicEvidence([valid], [issue]).length, 1);
});

test('four-issue broken-evidence replay cannot report complete authority coverage', async () => {
    const issues = [
        { id: 'Q1', query: 'Trách nhiệm hình sự đối với hành vi cố ý gây thương tích.' },
        { id: 'Q2', query: 'Một vấn đề độc lập chưa có chứng cứ xác định.' },
        { id: 'Q3', query: 'Điều kiện và hiệu lực của việc hòa giải giữa các bên trong vụ án cố ý gây thương tích đối với việc miễn truy cứu trách nhiệm hình sự.' },
        { id: 'Q4', query: 'Trách nhiệm hình sự khi gây tổn hại cho sức khỏe người khác.' }
    ];
    const generic = {
        id: '100-2015-qh13_chunk_13', title: 'Luật sửa đổi, bổ sung một số điều của Bộ luật Hình sự', category: 'Hình sự',
        dieu: 'Điều 1', score: 0.99,
        content: 'Sửa đổi, bổ sung một số điều. Người nào cố ý gây thương tích hoặc gây tổn hại cho sức khỏe của người khác thì bị phạt tù.'
    };
    const unknown = { ...generic, id: '100-2015-qh13_chunk_12', dieu: 'Unknown' };
    const result = await retrieveForIssues(issues, {
        concurrency: 1,
        ragService: { query: async () => [{ ...generic }, { ...unknown }] },
        selectRagChunks: passThroughSelector
    });
    assert.equal(inferIssueContext(issues[2]).purpose, ISSUE_PURPOSES.CRIMINAL_PROCEDURE);
    for (const issueId of ['Q1', 'Q3', 'Q4']) assert.equal(result.coverageDetails[issueId].authorityCovered, false);
    assert.equal(result.coverageComplete, false);
    const finalPack = prepareDeterministicEvidence(result.documents, issues);
    assert.equal(finalPack.some(document => document.originalEvidenceId === unknown.id), false);
    assert.equal(finalPack.some(document => Object.values(document.authorityRoles || {}).includes(AUTHORITY_ROLES.PRIMARY)), false);
});

test('one genuine offense authority may remain PRIMARY for two truly related issues', async () => {
    const related = fixture.issues.slice(0, 2);
    const evidence = documentById('criminal-code-injury');
    const result = await retrieveForIssues(related, {
        statusQuery: fixture.userQuery, concurrency: 1,
        ragService: { query: async () => [{ ...evidence, articleTitle:evidence.dieu, dieu:'Điều 1' }] },
        rerankEvidence: async payload => ({issues:payload.map(row=>({issueId:row.issueId,coreSelection:{candidateId:evidence.id,evidenceSpanIds:[`${evidence.id}:S1`],reason:'fixture'},supportingSelection:null,confidence:'HIGH'}))})
    });
    assert.equal(result.documents.length, 1);
    assert.deepEqual(result.documents[0].supportedIssueIds, ['Q1', 'Q2']);
    assert.equal(result.documents[0].authorityRoles.Q1, AUTHORITY_ROLES.PRIMARY);
    assert.equal(result.documents[0].authorityRoles.Q2, AUTHORITY_ROLES.PRIMARY);
    assert.equal(result.coverageComplete, true);
});

test('merged evidence retains issue-specific retrieval scores without changing canonical score', async () => {
    const related = fixture.issues.slice(0, 2);
    let call = 0;
    const result = await retrieveForIssues(related, {
        statusQuery: fixture.userQuery, concurrency: 1,
        ragService: { query: async () => [{ ...documentById('criminal-code-injury'), articleTitle:'Tội cố ý gây thương tích', dieu:'Điều 1', score: call++ === 0 ? 0.81 : 0.72 }] },
        rerankEvidence: async payload => ({issues:payload.map(row=>({issueId:row.issueId,coreSelection:{candidateId:'criminal-code-injury',evidenceSpanIds:['criminal-code-injury:S1'],reason:'fixture'},supportingSelection:null,confidence:'HIGH'}))})
    });
    const merged = result.documents[0];
    assert.equal(merged.score, 0.81);
    assert.equal(merged.retrievalDiagnostics.length, 4);
});
