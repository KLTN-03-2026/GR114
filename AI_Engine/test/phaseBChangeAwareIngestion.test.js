const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    DOCUMENT_CHANGE_STATE,
    normalizeLegalContent,
    computeLegalContentHash,
    classifyLegalDocumentChange
} = require('../src/services/legalDocumentChangeService');
const {
    listLegalDocumentVectorIds,
    updateLegalDocumentMetadata,
    replaceLegalDocumentVectors
} = require('../src/services/legalVectorSyncService');
const { getLegalDocumentId } = require('../src/services/legalIngestionContract');

const root = path.join(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const stored = {
    Id: '116-2025-qh15',
    Title: 'Luật mẫu',
    DocumentNumber: '116/2025/QH15',
    IssueYear: 2025,
    Status: 'Còn hiệu lực',
    Category: 'Quyền dân sự',
    Content: 'Điều 1. Nội dung pháp luật.',
    SourceUrl: 'https://vbpl.vn/law-116',
    Agency: 'QUỐC HỘI'
};

const incoming = {
    doc_id: '116-2025-qh15',
    title: stored.Title,
    documentNumber: stored.DocumentNumber,
    issueYear: stored.IssueYear,
    status: stored.Status,
    category: stored.Category,
    content: stored.Content,
    sourceUrl: stored.SourceUrl,
    agency: stored.Agency
};

test('normalization ignores formatting whitespace but preserves text case and punctuation', () => {
    assert.equal(normalizeLegalContent('  Điều 1.\r\n\r\n  Nội   dung  '), 'Điều 1. Nội dung');
    assert.notEqual(computeLegalContentHash('LUẬT.'), computeLegalContentHash('luật.'));
    assert.notEqual(computeLegalContentHash('Điều 1.'), computeLegalContentHash('Điều 1'));
});

test('same content with NULL stored hash is unchanged and derives the backfill hash locally', () => {
    const result = classifyLegalDocumentChange({ ...stored, ContentHash: null }, incoming);
    assert.equal(result.state, DOCUMENT_CHANGE_STATE.UNCHANGED);
    assert.equal(result.incomingHash, computeLegalContentHash(stored.Content));
    assert.equal(result.embeddingRequired, false);
});

test('same hash and same metadata is UNCHANGED with no Pinecone write requirement', () => {
    const result = classifyLegalDocumentChange({ ...stored, ContentHash: computeLegalContentHash(stored.Content) }, incoming);
    assert.equal(result.state, DOCUMENT_CHANGE_STATE.UNCHANGED);
    assert.equal(result.embeddingRequired, false);
    assert.equal(result.pineconeMetadataOnly, false);
});

test('status-only change is METADATA_CHANGED and requires zero embedding calls', async () => {
    const changed = { ...incoming, status: 'Hết hiệu lực' };
    const result = classifyLegalDocumentChange(stored, changed);
    assert.equal(result.state, DOCUMENT_CHANGE_STATE.METADATA_CHANGED);
    assert.deepEqual(result.changedMetadataFields, ['status']);
    assert.equal(result.embeddingRequired, false);

    let embeddingCalls = 0;
    const updates = [];
    await updateLegalDocumentMetadata({ update: async value => updates.push(value) }, changed, [
        '116-2025-qh15_chunk_0', '116-2025-qh15_chunk_1'
    ]);
    assert.equal(embeddingCalls, 0);
    assert.equal(updates.length, 2);
    assert.equal(updates[0].metadata.status, 'Hết hiệu lực');
});

test('source-only change is METADATA_CHANGED with no embedding', () => {
    const result = classifyLegalDocumentChange(stored, { ...incoming, sourceUrl: 'https://vbpl.vn/new-source' });
    assert.equal(result.state, DOCUMENT_CHANGE_STATE.METADATA_CHANGED);
    assert.deepEqual(result.changedMetadataFields, ['sourceUrl']);
    assert.equal(result.embeddingRequired, false);
});

test('different legal text is CONTENT_CHANGED and embeds only supplied chunks', async () => {
    const result = classifyLegalDocumentChange(stored, { ...incoming, content: 'Điều 1. Nội dung đã sửa đổi.' });
    assert.equal(result.state, DOCUMENT_CHANGE_STATE.CONTENT_CHANGED);
    assert.equal(result.embeddingRequired, true);

    let embeddingCalls = 0;
    await replaceLegalDocumentVectors({
        index: { upsert: async () => {}, deleteMany: async () => {} },
        document: incoming,
        chunks: ['chunk 1', 'chunk 2'],
        existingVectorIds: [],
        embedChunks: async chunks => {
            embeddingCalls += chunks.length;
            return chunks.map(() => [0.1, 0.2]);
        }
    });
    assert.equal(embeddingCalls, 2);
});

test('five-to-three chunk replacement upserts before deleting only stale higher chunks', async () => {
    const events = [];
    const result = await replaceLegalDocumentVectors({
        index: {
            upsert: async vectors => events.push(['upsert', vectors.map(vector => vector.id)]),
            deleteMany: async ids => events.push(['delete', ids])
        },
        document: incoming,
        chunks: ['0', '1', '2'],
        existingVectorIds: [0, 1, 2, 3, 4].map(index => `116-2025-qh15_chunk_${index}`),
        embedChunks: async chunks => chunks.map(() => [0.1, 0.2])
    });
    assert.equal(events[0][0], 'upsert');
    assert.deepEqual(events[1], ['delete', ['116-2025-qh15_chunk_3', '116-2025-qh15_chunk_4']]);
    assert.equal(result.staleVectorsRemoved, 2);
});

test('upsert failure never deletes old vectors', async () => {
    let deleteCalls = 0;
    await assert.rejects(replaceLegalDocumentVectors({
        index: {
            upsert: async () => { throw new Error('upsert failed'); },
            deleteMany: async () => { deleteCalls += 1; }
        },
        document: incoming,
        chunks: ['new'],
        existingVectorIds: ['116-2025-qh15_chunk_0', '116-2025-qh15_chunk_1'],
        embedChunks: async () => [[0.1, 0.2]]
    }), /upsert failed/);
    assert.equal(deleteCalls, 0);
});

test('canonical listing separates legacy vector families without deleting them', async () => {
    const result = await listLegalDocumentVectorIds({
        listPaginated: async () => ({
            vectors: [
                { id: '116-2025-qh15_chunk_0' },
                { id: '116-2025-qh15_0' }
            ]
        })
    }, '116-2025-qh15');
    assert.deepEqual(result.canonicalIds, ['116-2025-qh15_chunk_0']);
    assert.deepEqual(result.legacyIds, ['116-2025-qh15_0']);
});

test('different official document numbers remain distinct identities', () => {
    assert.notEqual(
        getLegalDocumentId({ documentNumber: '24/2018/QH14' }),
        getLegalDocumentId({ documentNumber: '116/2025/QH15' })
    );
});

test('crawler does not pre-skip an existing SourceUrl before change comparison', () => {
    const crawler = source('src/services/crawlService.js');
    assert.doesNotMatch(crawler, /existingUrls\.has/);
    assert.match(crawler, /Đang so sánh thay đổi/);
    assert.match(crawler, /legalDataService\.upsertLegalData/);
});

test('admin update uses shared classifier and does not delete vectors before replacement', () => {
    const admin = source('src/services/legalDataService.js');
    assert.match(admin, /classifyLegalDocumentChange/);
    assert.doesNotMatch(admin, /pineconeIndex\.deleteMany\(\{ doc_id/);
});

test('embedding call matrix is NEW/content only', () => {
    const newResult = classifyLegalDocumentChange(null, incoming);
    const unchanged = classifyLegalDocumentChange(stored, incoming);
    const metadata = classifyLegalDocumentChange(stored, { ...incoming, status: 'Hết hiệu lực' });
    const content = classifyLegalDocumentChange(stored, { ...incoming, content: 'Nội dung mới' });
    assert.deepEqual({
        NEW: newResult.embeddingRequired,
        UNCHANGED: unchanged.embeddingRequired,
        METADATA_CHANGED: metadata.embeddingRequired,
        CONTENT_CHANGED: content.embeddingRequired
    }, {
        NEW: true,
        UNCHANGED: false,
        METADATA_CHANGED: false,
        CONTENT_CHANGED: true
    });
});

test('Phase B has a nullable migration and SQL-only optional backfill', () => {
    const migration = source('sql/alter_legal_documents_add_content_hash.sql');
    assert.match(migration, /ContentHash NVARCHAR\(64\) NULL/);
    const backfill = source('scripts/backfillContentHashFromSql.js');
    assert.match(backfill, /WHERE ContentHash IS NULL/);
    assert.doesNotMatch(backfill, /GoogleGenerativeAI|Pinecone|embedContent/);
});

test('no bulk re-embedding trigger and chatbot retrieval architecture remains unchanged', () => {
    const rag = source('src/services/ragService.js');
    assert.match(rag, /const query = async \(queryText, k = 5\)/);
    assert.match(rag, /topK: k/);
    assert.doesNotMatch(source('src/services/legalDocumentChangeService.js'), /GoogleGenerativeAI|generateContent|embedContent/);
});
