const test = require('node:test');
const assert = require('node:assert/strict');
const { optimizeFinalEvidence, getFinalEvidenceCap } = require('../src/services/finalEvidenceOptimizer');

const issue = id => ({ id, query: `Issue ${id}` });
const doc = (id, roles, extra = {}) => ({
    id, title: `Law ${id}`, content: extra.content || `${id}-content`, score: extra.score ?? 0.5,
    supportedIssueIds: Object.keys(roles), authorityRoles: roles, ...extra
});

test('all PRIMARY evidence is preserved even when PRIMARY count exceeds cap', () => {
    const input = [doc('P1', { Q1: 'PRIMARY' }), doc('P2', { Q2: 'PRIMARY' }), doc('P3', { Q3: 'PRIMARY' })];
    const result = optimizeFinalEvidence(input, [issue('Q1'), issue('Q2'), issue('Q3')], { cap: 2 });
    assert.deepEqual(result.documents.map(item => item.id), ['P1', 'P2', 'P3']);
    assert.equal(result.telemetry.primaryKept, 3);
});

test('at most one best supporting-only evidence is kept per issue', () => {
    const input = [
        doc('P1', { Q1: 'PRIMARY' }),
        doc('S1', { Q1: 'SUPPORTING' }, { score: 0.9 }), doc('S2', { Q1: 'SUPPORTING' }, { score: 0.2 }),
        doc('S3', { Q2: 'SUPPORTING' }, { score: 0.8 }), doc('S4', { Q2: 'SUPPORTING' }, { score: 0.1 })
    ];
    const result = optimizeFinalEvidence(input, [issue('Q1'), issue('Q2')], { cap: 8 });
    assert.deepEqual(result.documents.map(item => item.id), ['P1', 'S3', 'S1']);
    assert.equal(result.documents.filter(item => item.authorityRoles.Q1 === 'SUPPORTING').length, 1);
    assert.equal(result.documents.filter(item => item.authorityRoles.Q2 === 'SUPPORTING').length, 1);
});

test('no issue loses its only eligible evidence and REJECTED evidence is excluded', () => {
    const input = [
        doc('P1', { Q1: 'PRIMARY' }),
        doc('S2', { Q2: 'SUPPORTING' }),
        doc('R3', { Q3: 'REJECTED' })
    ];
    const result = optimizeFinalEvidence(input, [issue('Q1'), issue('Q2'), issue('Q3')], { cap: 1 });
    assert.ok(result.documents.some(item => item.id === 'P1'));
    assert.ok(result.documents.some(item => item.id === 'S2'));
    assert.equal(result.documents.some(item => item.id === 'R3'), false);
});

test('duplicate evidence is globally merged with PRIMARY role winning', () => {
    const input = [doc('D1', { Q1: 'SUPPORTING' }, { score: 0.9 }), doc('D1', { Q1: 'PRIMARY', Q2: 'SUPPORTING' }, { score: 0.8 })];
    const result = optimizeFinalEvidence(input, [issue('Q1'), issue('Q2')]);
    assert.equal(result.documents.length, 1);
    assert.equal(result.documents[0].authorityRoles.Q1, 'PRIMARY');
    assert.deepEqual(new Set(result.documents[0].supportedIssueIds), new Set(['Q1', 'Q2']));
});

test('default cap is eight and optional supporting evidence respects it', () => {
    const input = Array.from({ length: 12 }, (_, index) => doc(`S${index + 1}`, { [`Q${index + 1}`]: 'SUPPORTING' }, { score: 1 - index / 20 }));
    const issues = Array.from({ length: 8 }, (_, index) => issue(`Q${index + 1}`));
    const result = optimizeFinalEvidence(input, issues);
    assert.equal(getFinalEvidenceCap(), 8);
    assert.equal(result.documents.length, 8);
    assert.equal(result.telemetry.beforeEvidenceCount, 12);
    assert.equal(result.telemetry.afterEvidenceCount, 8);
    assert.ok(result.telemetry.estimatedReductionPercent > 0);
});

test('complex final optimization keeps verified cores and removes optional supporting evidence', () => {
    const input = Array.from({ length: 12 }, (_, index) => ({
        id: `E${index + 1}`, content: `evidence ${index + 1}`,
        supportedIssueIds: [`Q${(index % 4) + 1}`],
        authorityRoles: { [`Q${(index % 4) + 1}`]: index < 4 ? 'PRIMARY' : 'SUPPORTING' }
    }));
    input.push({ ...input[0] });
    input.push({ id: 'REJECTED', content: 'bad', supportedIssueIds: ['Q1'], authorityRoles: { Q1: 'REJECTED' } });
    const result = optimizeFinalEvidence(input, [issue('Q1'), issue('Q2'), issue('Q3'), issue('Q4')], { cap: 8, preserveVerifiedEvidence: true });
    assert.equal(result.documents.length, 4);
    assert.equal(result.telemetry.cap, 8);
    assert.equal(result.telemetry.supportingKept, 0);
    assert.ok(result.documents.every(document => Object.values(document.authorityRoles).includes('PRIMARY')));
    assert.ok(!result.documents.some(document => document.id === 'REJECTED'));
});
