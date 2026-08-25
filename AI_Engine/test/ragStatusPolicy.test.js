const test = require('node:test');
const assert = require('node:assert/strict');

const {
    applyRagStatusPolicy,
    hasHistoricalOrVersionIntent
} = require('../src/services/ragStatusPolicy');
const { extractLegalTarget, documentMatchesTarget } = require('../src/services/multiQueryRagService');

const doc = (id, status, extra = {}) => ({ id, status, score: 0.9, ...extra });
const apply = (query, docs, target = null) => applyRagStatusPolicy(query, docs, {
    target,
    documentMatchesTarget
});

test('current-law mode removes fully expired and not-yet-effective evidence', () => {
    const result = apply('Hiện nay quy định thế nào?', [
        doc('effective', 'Còn hiệu lực'),
        doc('expired', 'Hết hiệu lực'),
        doc('future', 'Chưa có hiệu lực')
    ]);
    assert.deepEqual(result.map(item => item.id), ['effective']);
});

test('explicit old-year target allows its fully expired version', () => {
    const query = 'Theo Luật An ninh mạng năm 2018, quy định thế nào?';
    const target = extractLegalTarget(query);
    const result = apply(query, [doc('old', 'Hết hiệu lực', { title: 'Luật An ninh mạng 2018' })], target);
    assert.deepEqual(result.map(item => item.id), ['old']);
});

test('explicit document number allows the targeted fully expired law', () => {
    const query = 'Theo Luật An ninh mạng số 24/2018/QH14, quy định thế nào?';
    const target = extractLegalTarget(query);
    const result = apply(query, [doc('old', 'Hết hiệu lực', {
        title: 'Luật An ninh mạng',
        documentNumber: '24/2018/QH14'
    })], target);
    assert.deepEqual(result.map(item => item.id), ['old']);
});

test('old-versus-new comparison keeps fully expired evidence available', () => {
    const result = apply('So sánh luật cũ và luật mới', [
        doc('old', 'Hết hiệu lực'),
        doc('new', 'Còn hiệu lực')
    ]);
    assert.deepEqual(result.map(item => item.id), ['old', 'new']);
    assert.equal(hasHistoricalOrVersionIntent('So sánh luật cũ và luật mới'), true);
});

test('both partial-effect statuses remain eligible', () => {
    const result = apply('Hiện nay quy định thế nào?', [
        doc('effective-part', 'Còn hiệu lực một phần'),
        doc('expired-part', 'Hết hiệu lực một phần')
    ]);
    assert.deepEqual(result.map(item => item.id), ['effective-part', 'expired-part']);
});

test('not-yet-effective evidence is available for an explicit future-law query', () => {
    const result = apply('Luật sắp có hiệu lực quy định thế nào?', [doc('future', 'Chưa có hiệu lực')]);
    assert.deepEqual(result.map(item => item.id), ['future']);
});

test('unknown status preserves current fallback eligibility', () => {
    const result = apply('Hiện nay quy định thế nào?', [doc('unknown', 'Không xác định')]);
    assert.deepEqual(result.map(item => item.id), ['unknown']);
});
