const crypto = require('crypto');
const { normalizeSqlDate } = require('../constants/legalMetadata');

const DOCUMENT_CHANGE_STATE = Object.freeze({
    NEW: 'NEW',
    UNCHANGED: 'UNCHANGED',
    METADATA_CHANGED: 'METADATA_CHANGED',
    CONTENT_CHANGED: 'CONTENT_CHANGED'
});

const LEGAL_METADATA_FIELDS = Object.freeze([
    ['title', 'Title'],
    ['documentNumber', 'DocumentNumber'],
    ['issueYear', 'IssueYear'],
    ['documentType', 'DocumentType'],
    ['issueDate', 'IssueDate'],
    ['effectiveDate', 'EffectiveDate'],
    ['status', 'Status'],
    ['category', 'Category'],
    ['sourceUrl', 'SourceUrl'],
    ['agency', 'Agency']
]);

function normalizeLegalContent(content) {
    return String(content || '')
        .normalize('NFC')
        .replace(/\r\n?/g, '\n')
        .replace(/\s+/gu, ' ')
        .trim();
}

function computeLegalContentHash(content) {
    return crypto.createHash('sha256').update(normalizeLegalContent(content), 'utf8').digest('hex');
}

function normalizeMetadataValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).normalize('NFC').trim();
}

function readMetadataValue(document, camelName, sqlName) {
    return document?.[camelName] ?? document?.[sqlName] ?? '';
}

function getChangedMetadataFields(storedDocument = {}, incomingDocument = {}) {
    return LEGAL_METADATA_FIELDS
        .filter(([camelName, sqlName]) => {
            const stored = readMetadataValue(storedDocument, camelName, sqlName);
            const incoming = readMetadataValue(incomingDocument, camelName, sqlName);
            if (camelName === 'issueDate' || camelName === 'effectiveDate') {
                return normalizeSqlDate(stored) !== normalizeSqlDate(incoming);
            }
            return normalizeMetadataValue(stored) !== normalizeMetadataValue(incoming);
        })
        .map(([camelName]) => camelName);
}

function classifyLegalDocumentChange(storedDocument, incomingDocument) {
    const incomingHash = computeLegalContentHash(incomingDocument?.content ?? incomingDocument?.Content);
    if (!storedDocument) {
        return {
            state: DOCUMENT_CHANGE_STATE.NEW,
            storedHash: null,
            incomingHash,
            contentHashChanged: true,
            metadataChanged: false,
            changedMetadataFields: [],
            embeddingRequired: true,
            pineconeMetadataOnly: false
        };
    }

    const storedHash = storedDocument.ContentHash || storedDocument.contentHash ||
        computeLegalContentHash(storedDocument.Content ?? storedDocument.content);
    const changedMetadataFields = getChangedMetadataFields(storedDocument, incomingDocument);
    const contentHashChanged = storedHash !== incomingHash;
    const metadataChanged = changedMetadataFields.length > 0;
    const state = contentHashChanged
        ? DOCUMENT_CHANGE_STATE.CONTENT_CHANGED
        : metadataChanged
            ? DOCUMENT_CHANGE_STATE.METADATA_CHANGED
            : DOCUMENT_CHANGE_STATE.UNCHANGED;

    return {
        state,
        storedHash,
        incomingHash,
        contentHashChanged,
        metadataChanged,
        changedMetadataFields,
        embeddingRequired: state === DOCUMENT_CHANGE_STATE.CONTENT_CHANGED,
        pineconeMetadataOnly: state === DOCUMENT_CHANGE_STATE.METADATA_CHANGED
    };
}

function requiresPineconeResync(storedDocument, classification) {
    return Boolean(storedDocument) && classification?.state !== DOCUMENT_CHANGE_STATE.NEW &&
        String(storedDocument?.SyncStatusPinecone || '').toLowerCase() !== 'success';
}

function logDocumentChange(docId, classification, staleVectorsRemoved = 0) {
    console.log('[DOCUMENT CHANGE]');
    console.log(`docId=${docId}`);
    console.log(`state=${classification.state}`);
    console.log(`contentHashChanged=${classification.contentHashChanged}`);
    console.log(`metadataChanged=${classification.metadataChanged}`);
    console.log(`embeddingRequired=${classification.embeddingRequired}`);
    console.log(`pineconeMetadataOnly=${classification.pineconeMetadataOnly}`);
    console.log(`staleVectorsRemoved=${staleVectorsRemoved}`);
}

module.exports = {
    DOCUMENT_CHANGE_STATE,
    LEGAL_METADATA_FIELDS,
    normalizeLegalContent,
    computeLegalContentHash,
    getChangedMetadataFields,
    classifyLegalDocumentChange,
    requiresPineconeResync,
    logDocumentChange
};
