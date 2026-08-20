const assert = require('assert');
const { getLegalCategoryNormalization, normalizeLegalCategory } = require('../src/constants/legalCategories');
const {
    classifyDocument,
    applyHighConfidence,
    buildApplyHighPreview
} = require('./audit_other_legal_categories');

const run = async () => {
    assert.strictEqual(normalizeLegalCategory('Hành chính'), 'Bộ máy hành chính');
    assert.strictEqual(normalizeLegalCategory('Giao thông vận tải'), 'Giao thông - Vận tải');
    assert.strictEqual(normalizeLegalCategory('Khoa học công nghệ'), 'Khoa học - Công nghệ');
    assert.strictEqual(normalizeLegalCategory('Ngân hàng'), 'Tiền tệ - Ngân hàng');
    assert.strictEqual(normalizeLegalCategory('Quốc phòng'), 'Quốc phòng - An ninh');
    assert.strictEqual(normalizeLegalCategory('unknown category'), null);
    assert.strictEqual(normalizeLegalCategory('Giáo dục'), 'Giáo dục');
    assert.strictEqual(getLegalCategoryNormalization('Tài chính').status, 'NEEDS_RECLASSIFICATION');
    assert.strictEqual(getLegalCategoryNormalization('Quyền dân sự').status, 'NEEDS_RECLASSIFICATION');
    assert.strictEqual(getLegalCategoryNormalization('Quốc phòng').status, 'ALIASED');

    const auctionLaw = await classifyDocument(
        { Id: 'auction', Title: 'Luật Đấu giá tài sản', Category: 'Lĩnh vực khác' },
        async () => ({ suggestedCategory: 'Tư pháp', confidence: 'HIGH', reason: 'Điều chỉnh hoạt động đấu giá tài sản.' })
    );
    assert.strictEqual(auctionLaw.suggestedCategory, 'Tư pháp');
    assert.strictEqual(auctionLaw.confidence, 'HIGH');

    const ambiguous = await classifyDocument(
        { Id: 'ambiguous', Title: 'Văn bản quy định chung', Category: 'Lĩnh vực khác' },
        async () => ({ suggestedCategory: 'Lĩnh vực khác', confidence: 'LOW', reason: 'Không đủ căn cứ xác định lĩnh vực.' })
    );
    assert.strictEqual(ambiguous.confidence, 'LOW');

    const failed = await classifyDocument(
        { Id: 'failed', Title: 'Failure case', Category: 'Lĩnh vực khác' },
        async () => { throw new Error('Mock API failure'); }
    );
    assert.strictEqual(failed.status, 'ERROR');

    const report = [
        { id: '126-2025-qh15', status: 'OK', confidence: 'HIGH', suggestedCategory: 'Văn hóa - Xã hội' },
        { id: 'high', status: 'OK', confidence: 'HIGH', suggestedCategory: 'Tư pháp' },
        { id: 'medium', status: 'OK', confidence: 'MEDIUM', suggestedCategory: 'Tư pháp' },
        { id: '', status: 'OK', confidence: 'LOW', suggestedCategory: 'Lĩnh vực khác' }
    ];
    const updateCounts = { high: 1 };
    const applied = await applyHighConfidence(report, async item => updateCounts[item.id] || 0);
    assert.deepStrictEqual(applied, { attempted: 1, updated: 1, skipped: 0 });

    const preview = buildApplyHighPreview(report);
    assert.strictEqual(preview.automaticHighUpdateCount, 1);
    assert.deepStrictEqual(preview.excludedHighIds, ['126-2025-qh15']);
    assert.strictEqual(preview.mediumLowUntouchedCount, 2);
    assert.strictEqual(preview.expectedRemainingOther, 3);
    assert.strictEqual(preview.sqlGuard, "Category = N'Lĩnh vực khác'");
    console.log('Legal category audit tests passed.');
};

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
