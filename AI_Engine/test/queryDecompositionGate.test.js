const test = require('node:test');
const assert = require('node:assert/strict');
const { detectComplexityCandidate, validateDecomposition } = require('../src/services/queryDecompositionService');

const candidate = question => detectComplexityCandidate(question).candidateComplex;

test('rights obligations and notice period is a decomposition candidate', () => {
    assert.equal(candidate('Người lao động có quyền gì, nghĩa vụ gì và thời hạn báo trước là bao lâu?'), true);
});

test('conditions dossier and fee is a decomposition candidate', () => {
    assert.equal(candidate('Cho biết điều kiện, hồ sơ và lệ phí để thực hiện thủ tục.'), true);
});

test('fine and supplementary sanction is a decomposition candidate', () => {
    assert.equal(candidate('Mức phạt và hình thức xử phạt bổ sung đối với hành vi này là gì?'), true);
});

test('rights and responsibilities of two parties is a decomposition candidate', () => {
    assert.equal(candidate('Quyền và trách nhiệm của hai bên trong hợp đồng được xác định thế nào?'), true);
});

test('messy multi-problem Vietnamese scenario is a decomposition candidate', () => {
    assert.equal(candidate('tôi ký hợp đồng rồi công ty nợ lương nhưng họ còn giữ bằng của tôi, tôi nghỉ luôn được không, đòi lương và giấy tờ thế nào?'), true);
});

test('one clear legal question remains simple', () => {
    assert.equal(candidate('Mức phạt cho hành vi vượt đèn đỏ là bao nhiêu?'), false);
});

test('long factual narrative with one requested outcome remains simple', () => {
    assert.equal(candidate('Tôi mua một căn nhà từ năm 2020, đã thanh toán nhiều đợt, hai bên đã bàn giao và sinh sống ổn định trong thời gian dài nhưng chưa sang tên vì người bán đi xa. Hợp đồng này có hiệu lực không?'), false);
});

test('one occurrence of and alone does not imply complexity', () => {
    assert.equal(candidate('Điều 5 và Điều 6 của Luật này quy định mức phạt nào?'), false);
});

test('explicit comparison of two legal documents is a candidate', () => {
    assert.equal(candidate('So sánh Luật 54/2019/QH14 với Luật 62/2010/QH12 về phạm vi điều chỉnh.'), true);
});

test('decomposition retains independent self-contained issues', () => {
    const result = validateDecomposition({ isComplex: true, issues: [
        { query: 'Quyền của người lao động khi đơn phương chấm dứt hợp đồng' },
        { query: 'Nghĩa vụ báo trước của người lao động khi chấm dứt hợp đồng' },
        { query: 'Trường hợp người lao động được nghỉ việc không cần báo trước' }
    ] });
    assert.equal(result.isComplex, true);
    assert.equal(result.issueCount, 3);
});

test('decomposition retains mechanism query and factual anchors in the same model result', () => {
    const result = validateDecomposition({ isComplex:true, issues:[
        { query:'Trách nhiệm hình sự khi cố ý đánh gây thương tích 12%', legalMechanismQuery:'trách nhiệm hình sự đối với tổn hại sức khỏe', factualAnchors:['cố ý đánh','thương tích 12%'] },
        { query:'Bồi thường viện phí và thu nhập bị mất', legalMechanismQuery:'bồi thường thiệt hại sức khỏe', factualAnchors:['viện phí','thu nhập bị mất'] }
    ]});
    assert.equal(result.issueCount,2);
    assert.deepEqual(result.issues[0].factualAnchors,['cố ý đánh','thương tích 12%']);
    assert.equal(result.issues[0].issueText,result.issues[0].query);
});

test('decomposition never exceeds the six issue cap', () => {
    const issues = Array.from({ length: 9 }, (_, index) => ({ query: `Quy định pháp luật độc lập cho vấn đề số ${index + 1}` }));
    assert.equal(validateDecomposition({ isComplex: true, issues }).issueCount, 6);
});

test('keyword micro-splits collapse instead of becoming legal issues', () => {
    const result = validateDecomposition({ isComplex: true, issues: [
        { query: 'Người lao động' }, { query: 'Hợp đồng' }, { query: 'Báo trước' }, { query: 'Nghỉ việc' }
    ] });
    assert.deepEqual(result, { isComplex: false, issueCount: 0, issues: [] });
});
