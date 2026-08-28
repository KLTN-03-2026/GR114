const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeGeminiResponse,
    validateStructuredLegalResponse,
    buildComplexIssueContract,
    assembleLegalAnswer
} = require('../src/services/geminiService');
const { validateLegalAnswerIntegrity } = require('../src/services/legalAnswerIntegrityService');

const issues = count => Array.from({ length: count }, (_, index) => ({ id: `Q${index + 1}`, query: `Vấn đề ${index + 1}` }));
const payload = count => ({
    conclusion: 'Kết luận',
    analysis: issues(count).map(issue => ({ issueId: issue.id, content: `Phân tích ${issue.id}` })),
    legalBasis: ['Điều 1 Luật mẫu'],
    advice: 'Lời khuyên',
    citations: [{ evidenceId: 'E1', lawName: 'Bộ luật Hình sự', dieu: 'Trách nhiệm hình sự', sourceUrl: 'https://vbpl.vn/van-ban-mau', supportedIssueIds: issues(count).map(issue => issue.id) }]
});

const primaryDocs = count => [{
    id: 'E1',
    title: 'Bộ luật Hình sự',
    dieu: 'Trách nhiệm hình sự',
    content: 'Quy định trách nhiệm hình sự và tội phạm.',
    supportedIssueIds: issues(count).map(issue => issue.id),
    authorityRoles: Object.fromEntries(issues(count).map(issue => [issue.id, 'PRIMARY']))
}];

for (const count of [1, 2, 4]) {
    test(`${count} expected issue(s) are structurally complete`, () => {
        assert.doesNotThrow(() => validateStructuredLegalResponse(payload(count), issues(count)));
    });
}

test('generic one-paragraph multi-issue response fails structurally', () => {
    assert.throws(() => validateStructuredLegalResponse({ answer: 'Một đoạn chung.', citations: [] }, issues(2)), /Missing required/);
});

test('malformed output still fails when structured JSON is required', () => {
    assert.throws(() => normalizeGeminiResponse({ text: '**Kết luận** không phải JSON', grounded: false }, true, issues(1)), /STRUCTURED_LEGAL_RESPONSE_INVALID/);
});

test('four presentation sections are stable and citations are preserved', () => {
    const result = normalizeGeminiResponse({ text: JSON.stringify(payload(2)), grounded: false }, true, issues(2), { documents: primaryDocs(2), userQuery: 'trách nhiệm hình sự' });
    assert.match(result.answer, /^Kết luận:/);
    assert.match(result.answer, /\n\nPhân tích:/);
    assert.match(result.answer, /\n\nCơ sở pháp lý:/);
    assert.match(result.answer, /\n\nLời khuyên:/);
    assert.doesNotMatch(result.answer, /\*\*[1-4]\.|^\s*[1-4]\.\s+(?:Kết luận|Phân tích|Cơ sở pháp lý|Lời khuyên)/m);
    assert.doesNotMatch(result.answer, /\bQ\d+\s*:/);
    assert.equal(result.citations[0].sourceUrl, 'https://vbpl.vn/van-ban-mau');
    assert.match(result.answer, /\[Điều Trách nhiệm hình sự - Bộ luật Hình sự\]\(https:\/\/vbpl\.vn\/van-ban-mau\)/);
});

test('citation count and URLs survive normalization and four-section rendering', () => {
    const value = payload(1);
    value.citations.push({ evidenceId: 'E2', lawName: 'Bộ luật Hình sự', dieu: 'Tội phạm', sourceUrl: 'https://vbpl.vn/van-ban-thu-hai', supportedIssueIds: ['Q1'] });
    const docs = [...primaryDocs(1), { ...primaryDocs(1)[0], id: 'E2', dieu: 'Tội phạm' }];
    const result = normalizeGeminiResponse({ text: JSON.stringify(value), grounded: false }, true, issues(1), { documents: docs, userQuery: 'trách nhiệm hình sự' });
    assert.equal(result.citations.length, 2);
    assert.match(result.answer, /https:\/\/vbpl\.vn\/van-ban-mau/);
    assert.match(result.answer, /https:\/\/vbpl\.vn\/van-ban-thu-hai/);
    assert.deepEqual(result.citations.map(item => item.sourceUrl), ['https://vbpl.vn/van-ban-mau', 'https://vbpl.vn/van-ban-thu-hai']);
});

test('Điều Unknown is rejected and never rendered', () => {
    const value = payload(1);
    value.citations[0].dieu = 'Điều Unknown';
    assert.throws(() => normalizeGeminiResponse({ text: JSON.stringify(value), grounded: false }, true, issues(1), { documents: primaryDocs(1), userQuery: 'trách nhiệm hình sự' }), /INVALID_ARTICLE_IDENTIFIER/);
    assert.doesNotMatch(assembleLegalAnswer({ ...value, legalBasis: [] }, []), /Điều Unknown/);
});

test('escaped and nested markdown artifacts are removed while clickable links survive', () => {
    const value = payload(1);
    value.analysis[0].content = '\\*\\*Q1:\\*\\* xem [nguồn](https://vbpl.vn/van-ban-mau)';
    const result = normalizeGeminiResponse({ text: JSON.stringify(value), grounded: false }, true, issues(1), { documents: primaryDocs(1), userQuery: 'trách nhiệm hình sự' });
    assert.doesNotMatch(result.answer, /\\\*|\*{3,}|Q1:/);
    assert.match(result.answer, /\[nguồn\]\(https:\/\/vbpl\.vn\/van-ban-mau\)/);
});

test('citation absent from supplied evidence fails', () => {
    const value = payload(1);
    value.citations[0].evidenceId = 'missing';
    assert.throws(() => normalizeGeminiResponse({ text: JSON.stringify(value) }, true, issues(1), { documents: primaryDocs(1), userQuery: 'trách nhiệm hình sự' }), /UNSUPPORTED_CITATION/);
});

test('citation from rejected evidence fails', () => {
    const docs = primaryDocs(1);
    docs[0].authorityRoles.Q1 = 'REJECTED';
    assert.equal(validateLegalAnswerIntegrity({ structuredAnswer: payload(1), citations: payload(1).citations, expectedIssues: issues(1), documents: docs, userQuery: 'trách nhiệm hình sự' }).valid, false);
});

test('validated dynamic issues and compact issue-to-evidence mapping reach final prompt contract', () => {
    const docs = [{ id: 'E1', title: 'Luật A', dieu: 'Điều 2', content: 'BODY_ONCE', supportedIssueIds: ['Q1', 'Q2'], authorityRoles: { Q1: 'PRIMARY', Q2: 'SUPPORTING' } }];
    const contract = buildComplexIssueContract(issues(2), docs);
    assert.match(contract, /Q1: Vấn đề 1/);
    assert.match(contract, /Q2: Vấn đề 2/);
    assert.match(contract, /Q1 → E1 PRIMARY/);
    assert.match(contract, /Q2 → E1 SUPPORTING/);
    assert.equal(contract.includes('BODY_ONCE'), false);
    assert.equal((contract.match(/^- E1:/gm) || []).length, 1);
});

test('simple legal structured response remains valid without expected decomposed issues', () => {
    const result = normalizeGeminiResponse({ text: JSON.stringify(payload(1)), grounded: false }, true, [], { documents: primaryDocs(1), userQuery: 'trách nhiệm hình sự' });
    assert.match(result.answer, /Kết luận/);
    assert.equal(result.citations.length, 1);
});
