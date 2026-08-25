const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    DOCUMENT_TYPES,
    LEGAL_STATUSES,
    inferDocumentType,
    normalizeLegalStatus,
    parseIssueDateString
} = require('../src/constants/legalMetadata');
const { computeLegalContentHash, classifyLegalDocumentChange, DOCUMENT_CHANGE_STATE } = require('../src/services/legalDocumentChangeService');
const { buildLegalVectorMetadata, readLegalVectorMetadata } = require('../src/services/legalIngestionContract');
const { backfillLegalMetadata, classifyDocumentTypeBackfillRow } = require('../scripts/backfillLegalMetadata');

const source = relative => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
const stored = {
    Id: '31-2024-qh15', Title: 'Luật Đất đai', DocumentNumber: '31/2024/QH15',
    DocumentType: 'Luật', IssueYear: 2024, IssueDate: '2024-01-18', EffectiveDate: '2024-08-01',
    Status: 'Còn hiệu lực', Category: 'Bất động sản', SourceUrl: 'https://example.test/law', Agency: 'Quốc hội',
    Content: 'Điều 1. Phạm vi điều chỉnh.'
};
const incoming = {
    title: stored.Title, documentNumber: stored.DocumentNumber, documentType: stored.DocumentType,
    issueYear: stored.IssueYear, issueDate: stored.IssueDate, effectiveDate: stored.EffectiveDate,
    status: stored.Status, category: stored.Category, sourceUrl: stored.SourceUrl,
    agency: stored.Agency, content: stored.Content
};

test('migration adds nullable structured metadata and preserves IssueDateString', () => {
    const migration = source('sql/alter_legal_documents_add_structured_metadata.sql');
    assert.match(migration, /DocumentType NVARCHAR\(100\) NULL/);
    assert.match(migration, /IssueDate DATE NULL/);
    assert.match(migration, /EffectiveDate DATE NULL/);
    assert.doesNotMatch(migration, /DROP\s+COLUMN|IssueDateString/i);
});

test('IssueDate parser accepts Vietnamese words, location prefix, and slash dates', () => {
    assert.equal(parseIssueDateString('Ngày 4 tháng 8 năm 2007'), '2007-08-04');
    assert.equal(parseIssueDateString('Hà Nội, ngày 11 tháng 11 năm 2011'), '2011-11-11');
    assert.equal(parseIssueDateString('Ngày 05/12/2025'), '2025-12-05');
    assert.equal(parseIssueDateString('05/12/2025'), '2025-12-05');
    assert.equal(parseIssueDateString('Ngày 31 tháng 2 năm 2025'), null);
});

test('DocumentType inference uses longest deterministic legal prefixes', () => {
    assert.equal(inferDocumentType({ title: 'Luật Đất đai 2024' }), 'Luật');
    assert.equal(inferDocumentType({ title: 'Bộ luật Dân sự 2015' }), 'Bộ luật');
    assert.equal(inferDocumentType({ title: 'Thông tư liên tịch hướng dẫn...' }), 'Thông tư liên tịch');
    assert.equal(inferDocumentType({ title: 'Nghị quyết liên tịch số 01' }), 'Nghị quyết liên tịch');
    assert.equal(inferDocumentType({ title: 'Tài liệu không rõ loại' }), 'Chưa xác định');
    assert.equal(DOCUMENT_TYPES.length, 26);
});

test('DocumentType inference prioritizes reliable number signatures over titles', () => {
    assert.equal(inferDocumentType({ documentNumber: '01/2016/QH14', title: 'Luật Đấu giá tài sản số 01/2016/QH14' }), 'Luật');
    assert.equal(inferDocumentType({ documentNumber: '04/2026/QH16', title: 'LUẬT  SỬA ĐỔI một số điều...' }), 'Luật');
    assert.equal(inferDocumentType({ documentNumber: '02/VBHN-BGDĐT', title: 'THÔNG TƯ quy định...' }), 'Văn bản hợp nhất');
    assert.equal(inferDocumentType({ documentNumber: '03/VBHN-BGDĐT', title: 'Nghị định quy định...' }), 'Văn bản hợp nhất');
    assert.equal(inferDocumentType({ documentNumber: '11/2026/QĐ-TTg', title: 'Về việc phê duyệt...' }), 'Quyết định');
    assert.equal(inferDocumentType({ documentNumber: '15382/TB-CHQ', title: 'Về kết quả xử lý...' }), 'Thông báo');
    assert.equal(inferDocumentType({ documentNumber: '04/2026/QH16', title: 'Nghị quyết về...' }), 'Nghị quyết');
    assert.equal(inferDocumentType({ documentNumber: 'không rõ', title: 'Tài liệu không xác định' }), 'Chưa xác định');
});

test('an existing valid canonical DocumentType is preserved over inferred evidence', () => {
    assert.equal(inferDocumentType({ documentType: 'Nghị quyết', documentNumber: '11/2026/QĐ-TTg', title: 'Quyết định...' }), 'Nghị quyết');
});

test('backfill classifier consumes real SQL PascalCase row shapes', () => {
    const rows = [
        { Id: '01-2016-qh14', DocumentNumber: '01/2016/QH14', Title: 'Luật Đấu giá tài sản số 01/2016/QH14', DocumentType: 'Chưa xác định' },
        { Id: '04-2026-qh16', DocumentNumber: '04/2026/QH16', Title: 'LUẬT  SỬA ĐỔI, BỔ SUNG MỘT SỐ ĐIỀU', DocumentType: 'Chưa xác định' },
        { Id: '02-vbhn-bgdđt-2026', DocumentNumber: '02/VBHN-BGDĐT', Title: 'THÔNG TƯ BAN HÀNH QUY CHẾ', DocumentType: 'Chưa xác định' },
        { Id: '03-vbhn-bgdđt-2026', DocumentNumber: '03/VBHN-BGDĐT', Title: 'Nghị định quy định lộ trình', DocumentType: 'Chưa xác định' },
        { Id: '11-2026-qd-ttg', DocumentNumber: '11/2026/QĐ-TTg', Title: 'BAN HÀNH DANH MỤC', DocumentType: 'Chưa xác định' },
        { Id: '15382-tb-chq-2026', DocumentNumber: '15382/TB-CHQ', Title: 'Kết quả xác định trước mã số', DocumentType: 'Chưa xác định' }
    ];
    assert.deepEqual(rows.map(row => classifyDocumentTypeBackfillRow(row).inferredDocumentType),
        ['Luật', 'Luật', 'Văn bản hợp nhất', 'Văn bản hợp nhất', 'Quyết định', 'Thông báo']);
});

test('dry-run executes the backfill chain without issuing SQL UPDATE', async () => {
    const rows = [
        { Id: '01-2016-qh14', DocumentNumber: '01/2016/QH14', Title: 'Luật Đấu giá tài sản số 01/2016/QH14', DocumentType: 'Chưa xác định', IssueDate: new Date(), IssueDateString: '' },
        { Id: '31-cđ-ttg-2026', DocumentNumber: '31/CĐ-TTg', Title: 'CÔNG ĐIỆN', DocumentType: 'Chưa xác định', IssueDate: new Date(), IssueDateString: '' }
    ];
    let selectCalls = 0;
    const dbPool = {
        request: () => {
            const request = {
                input: () => request, query: async queryText => {
                    if (/UPDATE\s+dbo\.LegalDocuments/iu.test(queryText)) throw new Error('dry-run attempted SQL write');
                    selectCalls++;
                    return { recordset: selectCalls === 1 ? rows : [] };
                }
            };
            return request;
        }
    };
    const result = await backfillLegalMetadata({ dryRun: true, dbPool, connection: Promise.resolve() });
    assert.equal(result.totalDocuments, 2);
    assert.equal(result.wouldUpdate, 1);
    assert.equal(result.wouldRemainUnknown, 1);
});

test('legal status normalization is conservative and canonical', () => {
    assert.equal(normalizeLegalStatus(' Còn hiệu lực '), 'Còn hiệu lực');
    assert.equal(normalizeLegalStatus('CÒN HIỆU LỰC.'), 'Còn hiệu lực');
    assert.equal(normalizeLegalStatus('đã đăng công báo'), 'Không xác định');
    assert.deepEqual(LEGAL_STATUSES, ['Chưa có hiệu lực', 'Còn hiệu lực', 'Còn hiệu lực một phần', 'Hết hiệu lực một phần', 'Hết hiệu lực', 'Không xác định']);
});

for (const [field, value] of [
    ['status', 'Hết hiệu lực'],
    ['effectiveDate', '2024-09-01'],
    ['issueDate', '2024-01-19'],
    ['documentType', 'Bộ luật']
]) {
    test(`${field}-only correction is metadata-only with zero embedding`, () => {
        const result = classifyLegalDocumentChange(stored, { ...incoming, [field]: value });
        assert.equal(result.state, DOCUMENT_CHANGE_STATE.METADATA_CHANGED);
        assert.equal(result.embeddingRequired, false);
        assert.equal(result.pineconeMetadataOnly, true);
        assert.equal(computeLegalContentHash(incoming.content), result.incomingHash);
    });
}

test('canonical Pinecone metadata includes and reads structured legal metadata', () => {
    const metadata = buildLegalVectorMetadata({ document: incoming, chunk: { text: 'Điều 1.' }, chunkIndex: 0 });
    assert.equal(metadata.documentType, 'Luật');
    assert.equal(metadata.issueDate, '2024-01-18');
    assert.equal(metadata.effectiveDate, '2024-08-01');
    assert.equal(metadata.status, 'Còn hiệu lực');
    assert.equal(readLegalVectorMetadata(metadata).documentType, 'Luật');
});

test('admin and public APIs expose/filter structured metadata', () => {
    const service = source('src/services/legalDataService.js');
    const publicController = source('src/controllers/documentController.js');
    assert.match(service, /DocumentType = @documentType/);
    assert.match(service, /IssueDate = @issueDate/);
    assert.match(service, /EffectiveDate = @effectiveDate/);
    assert.match(publicController, /DocumentType = @documentType/);
    assert.match(publicController, /Status = @status/);
});

test('backfill is local SQL-only, idempotent, and reports required counters', () => {
    const backfill = source('scripts/backfillLegalMetadata.js');
    assert.match(backfill, /IssueDate = CASE WHEN IssueDate IS NULL/);
    assert.match(backfill, /DocumentType IS NULL OR DocumentType = N'Chưa xác định'/);
    assert.match(backfill, /normalizeDocumentType\(document\.DocumentType\)/);
    assert.match(backfill, /issueDateParseFailed/);
    assert.doesNotMatch(backfill, /Gemini|Pinecone|embedContent|generateContent/);
});

test('C1 adds no corpus rebuild and keeps retrieval architecture constants unchanged', () => {
    const crawler = source('src/services/crawlService.js');
    const rag = source('src/services/ragService.js');
    assert.doesNotMatch(crawler, /deleteAll|createIndex|rebuild/i);
    assert.match(rag, /queryText,\s*k\s*=\s*5/);
    assert.match(rag, /topK:\s*k/);
    assert.match(crawler, /gemini-embedding-2/);
    assert.match(crawler, /outputDimensionality:\s*768/);
});
