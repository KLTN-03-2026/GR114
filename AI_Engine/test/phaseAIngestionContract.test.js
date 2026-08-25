const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    REQUIRED_LEGAL_METADATA_FIELDS,
    getLegalDocumentId,
    getLegalVectorId,
    buildLegalVectorRecord,
    readLegalVectorMetadata
} = require('../src/services/legalIngestionContract');
const {
    DEFAULT_LEGAL_PINECONE_INDEX,
    resolveLegalPineconeIndexName,
    getLegalPineconeIndex,
    resetLegalPineconeCacheForTests
} = require('../src/services/legalPineconeService');
const {
    uploadLegalVectorsAndSetStatus,
    syncLegalVectors
} = require('../src/services/legalVectorSyncService');

const root = path.join(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('all runtime services use the one canonical Pinecone resolver', () => {
    assert.equal(DEFAULT_LEGAL_PINECONE_INDEX, 'legai-index-v3');
    assert.equal(resolveLegalPineconeIndexName({ pineconeIndex: 'legai-index-v3' }, {}), 'legai-index-v3');

    for (const file of [
        'src/services/legalDataService.js',
        'src/services/ragService.js',
        'src/controllers/adminController.js'
    ]) {
        assert.match(source(file), /getLegalPineconeIndex/);
        assert.doesNotMatch(source(file), /legai-index-v2|['"]legai-index['"]/);
    }
    assert.match(source('src/services/crawlService.js'), /legalDataService\.upsertLegalData/);
    assert.doesNotMatch(source('src/services/crawlService.js'), /legai-index-v2|['"]legai-index['"]/);
});

test('central Pinecone access resolves the configured index and caches it', () => {
    const calls = [];
    class FakePinecone {
        constructor(options) { calls.push(['client', options.apiKey]); }
        index(name) { calls.push(['index', name]); return { name }; }
    }
    resetLegalPineconeCacheForTests();
    const options = {
        config: { pineconeApiKey: 'key', pineconeIndex: 'legai-index-v3' },
        env: {},
        PineconeClass: FakePinecone
    };
    assert.equal(getLegalPineconeIndex(options).name, 'legai-index-v3');
    assert.equal(getLegalPineconeIndex(options).name, 'legai-index-v3');
    assert.deepEqual(calls, [['client', 'key'], ['index', 'legai-index-v3']]);
    resetLegalPineconeCacheForTests();
});

test('crawler, admin, and importer identity inputs resolve to the same doc_id', () => {
    const expected = '116-2025-qh15';
    assert.equal(getLegalDocumentId({ documentNumber: '116/2025/QH15' }), expected);
    assert.equal(getLegalDocumentId({ DocumentNumber: '116/2025/QH15' }), expected);
    assert.equal(getLegalDocumentId({ id: '116-2025-qh15' }), expected);
});

test('canonical vector ID is doc_id_chunk_index', () => {
    assert.equal(getLegalVectorId('116/2025/QH15', 3), '116-2025-qh15_chunk_3');
});

test('V3 vector records preserve required metadata and useful Phase 3 fields', () => {
    const record = buildLegalVectorRecord({
        document: {
            documentNumber: '116/2025/QH15',
            title: 'Luật mẫu',
            sourceUrl: 'https://vbpl.vn/van-ban/chi-tiet/116',
            agency: 'QUỐC HỘI',
            issueYear: 2025,
            category: 'Quyền dân sự',
            status: 'Còn hiệu lực'
        },
        chunk: { text: 'Điều 1. Nội dung', chuong: 'Chương I', dieu: 'Điều 1' },
        chunkIndex: 0,
        values: [0.1, 0.2]
    });
    assert.equal(record.id, '116-2025-qh15_chunk_0');
    for (const field of REQUIRED_LEGAL_METADATA_FIELDS) {
        assert.ok(Object.hasOwn(record.metadata, field), `missing ${field}`);
    }
    assert.equal(record.metadata.documentNumber, '116/2025/QH15');
    assert.equal(record.metadata.issueYear, 2025);
    assert.equal(record.metadata.category, 'Quyền dân sự');
    assert.equal(record.metadata.status, 'Còn hiệu lực');
});

test('RAG metadata adapter reads deployed V3 fields and legacy aliases', () => {
    const deployed = readLegalVectorMetadata({
        doc_id: 'law-1', law_name: 'Luật V3', source: 'https://vbpl.vn/v3', dieu: 'Điều 2', chuong: 'Chương I', text: 'V3'
    });
    assert.equal(deployed.law_name, 'Luật V3');
    assert.equal(deployed.source, 'https://vbpl.vn/v3');

    const aliases = readLegalVectorMetadata({
        docId: 'law-2', lawName: 'Luật alias', sourceUrl: 'https://vbpl.vn/alias', articleNumber: 'Điều 3', chapter: 'Chương II', content: 'Alias'
    });
    assert.equal(aliases.doc_id, 'law-2');
    assert.equal(aliases.law_name, 'Luật alias');
    assert.equal(aliases.source, 'https://vbpl.vn/alias');
    assert.equal(aliases.chuong, 'Chương II');
});

test('crawler status success is written only after Pinecone upsert', async () => {
    const events = [];
    await uploadLegalVectorsAndSetStatus({
        index: { upsert: async () => { events.push('upsert'); } },
        vectors: [{ id: 'law_chunk_0' }],
        documentIds: ['law'],
        setStatus: async (_ids, status) => { events.push(status); }
    });
    assert.deepEqual(events, ['upsert', 'success']);
    assert.match(source('src/services/legalDataService.js'), /SyncStatusPinecone = 'pending'/);
});

test('Pinecone failure records failed and never records success', async () => {
    const statuses = [];
    await assert.rejects(uploadLegalVectorsAndSetStatus({
        index: { upsert: async () => { throw new Error('Pinecone unavailable'); } },
        vectors: [{ id: 'law_chunk_0' }],
        documentIds: ['law'],
        setStatus: async (_ids, status) => { statuses.push(status); }
    }), /Pinecone unavailable/);
    assert.deepEqual(statuses, ['failed']);
});

test('admin metadata-only update reuses values and does not invoke embedding', async () => {
    let embeddingCalls = 0;
    const updates = [];
    const result = await syncLegalVectors({
        index: { update: async update => { updates.push(update); } },
        embeddingModel: { embedContent: async () => { embeddingCalls += 1; } },
        document: { doc_id: '116-2025-qh15', title: 'Luật mẫu', sourceUrl: 'https://vbpl.vn/116' },
        chunks: ['Điều 1', 'Điều 2'],
        shouldReVectorize: false
    });
    assert.equal(embeddingCalls, 0);
    assert.equal(updates.length, 2);
    assert.deepEqual(updates.map(item => item.id), ['116-2025-qh15_chunk_0', '116-2025-qh15_chunk_1']);
    assert.deepEqual(result, { embeddedChunks: 0, metadataOnly: true });
});

test('Phase A does not add a bulk execution path or change embedding model/dimension/Top 5', () => {
    for (const file of ['scripts/import_json_data.js', 'scripts/import_json_data_optimized.js']) {
        assert.match(source(file), /gemini-embedding-2/);
        assert.match(source(file), /slice\(0, 768\)/);
        assert.match(source(file), /getLegalPineconeIndex/);
    }
    const rag = source('src/services/ragService.js');
    assert.match(rag, /const query = async \(queryText, k = 5\)/);
    assert.match(rag, /topK: k/);
});
