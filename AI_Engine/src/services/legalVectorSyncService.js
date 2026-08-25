const {
    SYNC_STATUS,
    buildLegalDocumentMetadata,
    buildLegalVectorMetadata,
    buildLegalVectorRecord,
    getLegalVectorId
} = require('./legalIngestionContract');

async function listLegalDocumentVectorIds(index, docId) {
    if (!index || typeof index.listPaginated !== 'function') {
        throw new Error('The configured Pinecone index does not support canonical vector ID listing.');
    }
    const prefix = `${docId}_`;
    const canonicalPattern = new RegExp(`^${docId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_chunk_\\d+$`);
    const canonicalIds = [];
    const legacyIds = [];
    let paginationToken;

    do {
        const page = await index.listPaginated({ prefix, ...(paginationToken ? { paginationToken } : {}) });
        for (const vector of page.vectors || []) {
            const id = typeof vector === 'string' ? vector : vector.id;
            if (!id) continue;
            if (canonicalPattern.test(id)) canonicalIds.push(id);
            else legacyIds.push(id);
        }
        paginationToken = page.pagination?.next;
    } while (paginationToken);

    if (legacyIds.length > 0) {
        console.warn(`[LEGAL VECTOR LEGACY IDS] docId=${docId} count=${legacyIds.length} ids=${legacyIds.join(',')}`);
    }
    return { canonicalIds, legacyIds };
}

async function uploadLegalVectorsAndSetStatus({ index, vectors, documentIds, setStatus, batchSize = 50 }) {
    try {
        for (let offset = 0; offset < vectors.length; offset += batchSize) {
            await index.upsert(vectors.slice(offset, offset + batchSize));
        }
        await setStatus(documentIds, SYNC_STATUS.SUCCESS);
    } catch (error) {
        await setStatus(documentIds, SYNC_STATUS.FAILED);
        throw error;
    }
}

async function updateLegalVectorMetadata(index, document, chunks) {
    if (!index || typeof index.update !== 'function') {
        throw new Error('The configured Pinecone SDK does not support metadata-only vector updates.');
    }
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        await index.update({
            id: getLegalVectorId(document.doc_id, chunkIndex),
            metadata: buildLegalVectorMetadata({ document, chunk: { text: chunks[chunkIndex] }, chunkIndex })
        });
    }
}

async function updateLegalDocumentMetadata(index, document, vectorIds) {
    if (!index || typeof index.update !== 'function') {
        throw new Error('The configured Pinecone SDK does not support metadata-only vector updates.');
    }
    if (!vectorIds || vectorIds.length === 0) {
        throw new Error(`No canonical Pinecone vectors found for metadata update: ${document.doc_id}`);
    }
    const metadata = buildLegalDocumentMetadata(document);
    for (const id of vectorIds) await index.update({ id, metadata });
    return { updatedVectors: vectorIds.length };
}

async function replaceLegalDocumentVectors({
    index,
    document,
    chunks,
    embedChunks,
    existingVectorIds = [],
    batchSize = 50
}) {
    const embeddings = await embedChunks(chunks);
    if (!Array.isArray(embeddings) || embeddings.length !== chunks.length) {
        throw new Error(`Embedding count mismatch for ${document.doc_id}: expected ${chunks.length}, received ${embeddings?.length || 0}`);
    }

    const vectors = chunks.map((chunk, chunkIndex) => buildLegalVectorRecord({
        document,
        chunk: typeof chunk === 'string' ? { text: chunk } : chunk,
        chunkIndex,
        values: embeddings[chunkIndex]
    }));

    for (let offset = 0; offset < vectors.length; offset += batchSize) {
        await index.upsert(vectors.slice(offset, offset + batchSize));
    }

    const newIds = new Set(vectors.map(vector => vector.id));
    const staleIds = existingVectorIds.filter(id => !newIds.has(id));
    if (staleIds.length > 0) {
        try {
            await index.deleteMany(staleIds);
        } catch (error) {
            error.staleCleanupFailed = true;
            error.staleVectorIds = staleIds;
            throw error;
        }
    }

    return { vectors, staleVectorsRemoved: staleIds.length };
}

async function syncLegalVectors({ index, embeddingModel, document, chunks, shouldReVectorize }) {
    if (!shouldReVectorize) {
        await updateLegalVectorMetadata(index, document, chunks);
        return { embeddedChunks: 0, metadataOnly: true };
    }

    const vectors = [];
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const embeddingResult = await embeddingModel.embedContent(chunks[chunkIndex]);
        vectors.push(buildLegalVectorRecord({
            document,
            chunk: { text: chunks[chunkIndex] },
            chunkIndex,
            values: embeddingResult.embedding.values
        }));
    }
    if (vectors.length > 0) await index.upsert(vectors);
    return { embeddedChunks: vectors.length, metadataOnly: false };
}

module.exports = {
    listLegalDocumentVectorIds,
    uploadLegalVectorsAndSetStatus,
    updateLegalVectorMetadata,
    updateLegalDocumentMetadata,
    replaceLegalDocumentVectors,
    syncLegalVectors
};
