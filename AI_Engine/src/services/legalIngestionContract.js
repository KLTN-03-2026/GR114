const REQUIRED_LEGAL_METADATA_FIELDS = Object.freeze([
    'doc_id',
    'law_name',
    'title',
    'source',
    'agency',
    'chuong',
    'dieu',
    'text',
    'text_preview',
    'chunk_length'
]);

const SYNC_STATUS = Object.freeze({
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed'
});

function toCanonicalDocumentId(value) {
    if (!value) return '';
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function getLegalDocumentId(document = {}) {
    const explicitId = document.doc_id ?? document.docId ?? document.Id ?? document.id;
    if (explicitId) return toCanonicalDocumentId(explicitId);

    const identitySource = document.documentNumber ?? document.DocumentNumber ??
        document.title ?? document.Title ?? document.law_name ?? document.lawName;
    return toCanonicalDocumentId(identitySource);
}

function getLegalVectorId(docId, chunkIndex) {
    const canonicalId = toCanonicalDocumentId(docId);
    if (!canonicalId) throw new Error('A canonical doc_id is required to build a legal vector ID.');
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
        throw new Error('chunkIndex must be a non-negative integer.');
    }
    return `${canonicalId}_chunk_${chunkIndex}`;
}

function pineconeScalar(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    return String(value);
}

function buildLegalVectorMetadata({ document = {}, chunk = {}, chunkIndex = 0 }) {
    const text = String(chunk.text ?? chunk.content ?? chunk ?? '').trim();
    const title = document.title ?? document.Title ?? document.law_name ?? document.lawName ?? 'Văn bản pháp luật';
    const docId = getLegalDocumentId(document);

    const metadata = {
        doc_id: docId,
        law_name: pineconeScalar(title),
        title: pineconeScalar(title),
        source: pineconeScalar(document.source ?? document.sourceUrl ?? document.SourceUrl),
        agency: pineconeScalar(document.agency ?? document.Agency),
        chuong: pineconeScalar(chunk.chuong ?? chunk.chapter, 'Unknown'),
        dieu: pineconeScalar(chunk.dieu ?? chunk.article ?? chunk.article_number, 'Unknown'),
        text,
        text_preview: text.substring(0, 300),
        chunk_length: text.length,
        chunk_index: chunkIndex
    };

    const optionalFields = {
        documentNumber: document.documentNumber ?? document.DocumentNumber,
        issueYear: document.issueYear ?? document.IssueYear,
        documentType: document.documentType ?? document.DocumentType,
        issueDate: document.issueDate ?? document.IssueDate,
        effectiveDate: document.effectiveDate ?? document.EffectiveDate,
        category: document.category ?? document.Category,
        status: document.status ?? document.Status
    };

    for (const [key, value] of Object.entries(optionalFields)) {
        if (value !== null && value !== undefined && value !== '') {
            metadata[key] = pineconeScalar(value);
        }
    }

    return metadata;
}

function buildLegalDocumentMetadata(document = {}) {
    const title = document.title ?? document.Title ?? document.law_name ?? document.lawName ?? 'Văn bản pháp luật';
    const metadata = {
        doc_id: getLegalDocumentId(document),
        law_name: pineconeScalar(title),
        title: pineconeScalar(title),
        source: pineconeScalar(document.source ?? document.sourceUrl ?? document.SourceUrl),
        agency: pineconeScalar(document.agency ?? document.Agency)
    };
    const optionalFields = {
        documentNumber: document.documentNumber ?? document.DocumentNumber,
        issueYear: document.issueYear ?? document.IssueYear,
        documentType: document.documentType ?? document.DocumentType,
        issueDate: document.issueDate ?? document.IssueDate,
        effectiveDate: document.effectiveDate ?? document.EffectiveDate,
        category: document.category ?? document.Category,
        status: document.status ?? document.Status
    };
    for (const [key, value] of Object.entries(optionalFields)) {
        if (value !== null && value !== undefined && value !== '') metadata[key] = pineconeScalar(value);
    }
    return metadata;
}

function buildLegalVectorRecord({ document, chunk, chunkIndex, values }) {
    const docId = getLegalDocumentId(document);
    return {
        id: getLegalVectorId(docId, chunkIndex),
        values: Array.from(values || []).map(Number),
        metadata: buildLegalVectorMetadata({ document: { ...document, doc_id: docId }, chunk, chunkIndex })
    };
}

function readLegalVectorMetadata(metadata = {}) {
    const title = metadata.title ?? metadata.law_name ?? metadata.lawName ?? 'Văn bản pháp luật';
    return {
        doc_id: metadata.doc_id ?? metadata.docId ?? metadata._id ?? '',
        title,
        law_name: metadata.law_name ?? metadata.lawName ?? title,
        source: metadata.source ?? metadata.sourceUrl ?? metadata.url ?? metadata.link ?? '',
        agency: metadata.agency ?? '',
        chuong: metadata.chuong ?? metadata.chapter ?? metadata.chapterNumber ?? 'Chương',
        dieu: metadata.dieu ?? metadata.article ?? metadata.articleNumber ?? metadata.article_number ?? metadata.article_num ?? 'Căn cứ/Mở đầu',
        text: metadata.text ?? metadata.content ?? 'Nội dung không khả dụng',
        documentNumber: metadata.documentNumber ?? metadata.document_number ?? metadata.lawNumber ?? '',
        issueYear: metadata.issueYear ?? metadata.issue_year ?? metadata.year ?? '',
        documentType: metadata.documentType ?? metadata.document_type ?? '',
        issueDate: metadata.issueDate ?? metadata.issue_date ?? '',
        effectiveDate: metadata.effectiveDate ?? metadata.effective_date ?? '',
        category: metadata.category ?? metadata.doc_type ?? '',
        status: metadata.status ?? ''
    };
}

module.exports = {
    REQUIRED_LEGAL_METADATA_FIELDS,
    SYNC_STATUS,
    toCanonicalDocumentId,
    getLegalDocumentId,
    getLegalVectorId,
    buildLegalDocumentMetadata,
    buildLegalVectorMetadata,
    buildLegalVectorRecord,
    readLegalVectorMetadata
};
