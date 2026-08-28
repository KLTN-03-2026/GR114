const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
    CONTENT_PREVIEW_LENGTH,
    buildPrompt,
    parseClassification,
    resolveDocumentCategory
} = require('../src/services/legalCategoryClassifierService');
const { computeLegalContentHash } = require('../src/services/legalDocumentChangeService');
const { buildLegalVectorMetadata } = require('../src/services/legalIngestionContract');

const root = path.join(__dirname, '..');
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const document = {
    Id: 'law-1', Title: 'Luật mẫu', DocumentNumber: '01/2025/QH15',
    IssuingAgency: 'QUỐC HỘI', ContentPreviewSource: 'Điều 1. Nội dung pháp luật.'
};

test('shared classifier imports without DB, file, exit, or startup side effects', () => {
    const script = `
        const Module = require('module');
        const original = Module._load;
        Module._load = function(request) {
            if (/config[\\/]db/.test(request) || request === 'mssql') throw new Error('DB import');
            return original.apply(this, arguments);
        };
        const before = process.exitCode;
        require('./src/services/legalCategoryClassifierService');
        if (process.exitCode !== before) throw new Error('exit state changed');
    `;
    const result = spawnSync(process.execPath, ['-e', script], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});

test('audit and production reference the same shared classification semantics', () => {
    const audit = source('scripts/audit_other_legal_categories.js');
    const production = source('src/services/legalDataService.js');
    assert.match(audit, /legalCategoryClassifierService/);
    assert.match(production, /legalCategoryClassifierService/);
    assert.equal(parseClassification('{"category":"Tư pháp","confidence":"high","reason":"Hợp lệ"}').confidence, 'HIGH');
    assert.match(buildPrompt({ ...document, ContentPreview: document.ContentPreviewSource }), /Trích đoạn nội dung: Điều 1/);
    assert.equal(CONTENT_PREVIEW_LENGTH, 800);
});

test('valid source category makes zero classifier calls', async () => {
    let calls = 0;
    const category = await resolveDocumentCategory({
        sourceCategory: 'Giáo dục', existing: null, document,
        classifier: async () => { calls += 1; }
    });
    assert.equal(category, 'Giáo dục');
    assert.equal(calls, 0);
});

test('unchanged content and valid stored category make zero classifier calls', async () => {
    let calls = 0;
    const existing = {
        Category: 'Tư pháp', Content: document.ContentPreviewSource,
        ContentHash: computeLegalContentHash(document.ContentPreviewSource)
    };
    const category = await resolveDocumentCategory({
        sourceCategory: 'Chưa phân loại', existing, document,
        classifier: async () => { calls += 1; }
    });
    assert.equal(category, 'Tư pháp');
    assert.equal(calls, 0);
});

test('placeholder category invokes the document classifier once', async () => {
    let calls = 0;
    const category = await resolveDocumentCategory({
        sourceCategory: 'Lĩnh vực khác', existing: null, document,
        classifier: async input => {
            calls += 1;
            assert.equal(input.ContentPreview, document.ContentPreviewSource);
            return { suggestedCategory: 'Doanh nghiệp', confidence: 'HIGH', reason: 'Phạm vi chính.' };
        }
    });
    assert.equal(category, 'Doanh nghiệp');
    assert.equal(calls, 1);
});

test('classifier failure is non-blocking and retains Lĩnh vực khác', async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        const category = await resolveDocumentCategory({
            sourceCategory: '', existing: null, document,
            classifier: async () => { throw new Error('quota exhausted'); }
        });
        assert.equal(category, 'Lĩnh vực khác');
    } finally {
        console.warn = originalWarn;
    }
});

test('canonical category uses existing SSMS field and unchanged Pinecone schema', () => {
    const metadata = buildLegalVectorMetadata({
        document: {
            doc_id: 'law-1', title: 'Luật mẫu', sourceUrl: 'https://example.test', agency: 'QUỐC HỘI',
            documentNumber: '01/2025/QH15', issueYear: 2025, documentType: 'Luật',
            issueDate: '2025-01-01', effectiveDate: '2025-02-01', category: 'Tư pháp', status: 'Còn hiệu lực'
        },
        chunk: { text: 'Điều 1.', chuong: 'Chương I', dieu: 'Điều 1', articleTitle: 'Phạm vi' },
        chunkIndex: 0
    });
    assert.equal(metadata.category, 'Tư pháp');
    assert.deepEqual(Object.keys(metadata).sort(), [
        'agency', 'articleTitle', 'category', 'chunk_index', 'chunk_length', 'chuong', 'dieu',
        'doc_id', 'documentNumber', 'documentType', 'effectiveDate', 'issueDate', 'issueYear',
        'law_name', 'source', 'status', 'text', 'text_preview', 'title'
    ].sort());
    const persistence = source('src/services/legalDataService.js');
    assert.match(persistence, /\.input\('category', sql\.NVarChar\(100\), incoming\.category\)/);
});
