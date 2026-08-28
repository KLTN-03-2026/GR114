const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { chunkLegalArticles } = require('../src/services/articleAwareChunkingService');
const { createTokenBatches, embedChunkBatches } = require('../src/services/legalEmbeddingBatchService');
const { buildLegalVectorRecord } = require('../src/services/legalIngestionContract');
const {
    classifyLegalDocumentChange,
    requiresPineconeResync
} = require('../src/services/legalDocumentChangeService');

const root = path.join(__dirname, '..');
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const longBody = Array.from({ length: 80 }, (_, index) => `${index + 1}. Nội dung quy định về hành vi và trách nhiệm.`).join('\n');
const fixture = [
    'LỜI NÓI ĐẦU',
    'Văn bản mẫu phục vụ kiểm thử ngoại tuyến.',
    '',
    'CHƯƠNG I',
    'QUY ĐỊNH CHUNG',
    'Điều 1. Phạm vi điều chỉnh',
    'Văn bản này quy định phạm vi áp dụng.',
    '',
    'CHƯƠNG II',
    'TRÁCH NHIỆM HÌNH SỰ',
    'ĐIỀU 155',
    'Khởi tố vụ án theo yêu cầu của bị hại',
    longBody,
    'Việc áp dụng Điều 51 chỉ là một dẫn chiếu trong nội dung.'
].join('\n');

test('shared chunker keeps preamble Unknown and parses Điều 1/155 without following cross-references', () => {
    const chunks = chunkLegalArticles(fixture, { maxChars: 500 });
    assert.equal(chunks[0].dieu, 'Unknown');
    assert.equal(chunks.find(chunk => chunk.dieu === 'Điều 1').articleTitle, 'Phạm vi điều chỉnh');
    const article155 = chunks.filter(chunk => chunk.dieu === 'Điều 155');
    assert.ok(article155.length > 1);
    assert.ok(article155.every(chunk => chunk.chuong === 'CHƯƠNG II'));
    assert.ok(article155.every(chunk => chunk.articleTitle === 'Khởi tố vụ án theo yêu cầu của bị hại'));
    assert.equal(chunks.some(chunk => chunk.dieu === 'Điều 51'), false);
    assert.match(article155.map(chunk => chunk.text).join('\n'), /Điều 51/u);
});

test('common Điều forms and line-broken title are parsed only as line headings', () => {
    const chunks = chunkLegalArticles('Điều 1a: Phạm vi bổ sung\nNội dung.\n\nĐIỀU 155\nTên điều\nNội dung.', { maxChars: 1000 });
    assert.deepEqual(chunks.map(chunk => chunk.dieu), ['Điều 1a', 'Điều 155']);
    assert.deepEqual(chunks.map(chunk => chunk.articleTitle), ['Phạm vi bổ sung', 'Tên điều']);
});

test('final partial token batch retains complete chunk objects and ordering', async () => {
    const chunks = chunkLegalArticles(fixture, { maxChars: 500 });
    const batches = createTokenBatches(chunks, { maxTokens: 300, charsPerToken: 2.5 });
    assert.ok(batches.length > 1);
    assert.ok(batches.at(-1).length < chunks.length);
    const seen = [];
    const embeddings = await embedChunkBatches(chunks, async batch => {
        seen.push(...batch);
        return batch.map((_, index) => [index, 0]);
    }, { maxTokens: 300, charsPerToken: 2.5, maxRetries: 0 });
    assert.equal(embeddings.length, chunks.length);
    assert.deepEqual(seen, chunks);
    assert.deepEqual(seen.at(-1), chunks.at(-1));
});

test('Admin and import script use the same shared chunker and no old Admin string chunk path', () => {
    const admin = source('src/services/legalDataService.js');
    const importer = source('scripts/import_json_data.js');
    assert.match(admin, /chunkLegalArticles\(incoming\.content/u);
    assert.match(importer, /chunkLegalArticles\(cleanContent/u);
    assert.doesNotMatch(admin, /chunkText\(incoming\.content/u);
    assert.doesNotMatch(importer, /const smartChunk\s*=/u);
    assert.doesNotMatch(importer, /correspondingChunkData|chuong:\s*"Unknown",\s*dieu:\s*"Unknown"/u);
});

test('vector contract receives and writes article metadata', () => {
    const article = chunkLegalArticles('Chương I\nĐiều 155. Khởi tố theo yêu cầu\nNội dung.', { maxChars: 1000 })
        .find(chunk => chunk.dieu === 'Điều 155');
    const record = buildLegalVectorRecord({
        document: { doc_id: '123-2026-qh16', title: 'Bộ luật mẫu' },
        chunk: article,
        chunkIndex: 0,
        values: [0.1, 0.2]
    });
    assert.equal(record.metadata.dieu, 'Điều 155');
    assert.equal(record.metadata.chuong, 'Chương I');
    assert.equal(record.metadata.articleTitle, 'Khởi tố theo yêu cầu');
});

test('unchanged failed or pending SQL documents remain eligible for Pinecone resync', () => {
    const content = 'Điều 1. Nội dung.';
    const incoming = { content, title: 'Luật mẫu' };
    for (const status of ['failed', 'pending']) {
        const stored = { Content: content, Title: 'Luật mẫu', SyncStatusPinecone: status };
        const classification = classifyLegalDocumentChange(stored, incoming);
        assert.equal(classification.state, 'UNCHANGED');
        assert.equal(requiresPineconeResync(stored, classification), true);
    }
    const success = { Content: content, Title: 'Luật mẫu', SyncStatusPinecone: 'success' };
    assert.equal(requiresPineconeResync(success, classifyLegalDocumentChange(success, incoming)), false);
});

test('offline ingestion tests inject embedding and contain no network clients', () => {
    const localServices = source('src/services/articleAwareChunkingService.js') +
        source('src/services/legalEmbeddingBatchService.js');
    assert.doesNotMatch(localServices, /@google\/generative-ai|@pinecone-database|axios|fetch\(/u);
});
