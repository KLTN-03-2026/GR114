const { sql, pool, poolConnect } = require('../config/db');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { chunkLegalArticles } = require('./articleAwareChunkingService');
const { embedChunkBatches, createRollingItemLimiter } = require('./legalEmbeddingBatchService');
const { normalizeLegalCategory } = require('../constants/legalCategories');
const {
    DEFAULT_MODEL,
    createClassifier,
    resolveDocumentCategory
} = require('./legalCategoryClassifierService');
const {
    inferDocumentType,
    normalizeLegalStatus,
    normalizeSqlDate,
    resolveIssueDatePersistence
} = require('../constants/legalMetadata');
const SystemConfig = require('../config/SystemConfig');
const { getLegalPineconeIndex } = require('./legalPineconeService');
const {
    SYNC_STATUS,
    getLegalDocumentId
} = require('./legalIngestionContract');
const {
    listLegalDocumentVectorIds,
    updateLegalDocumentMetadata,
    replaceLegalDocumentVectors
} = require('./legalVectorSyncService');
const {
    DOCUMENT_CHANGE_STATE,
    classifyLegalDocumentChange,
    requiresPineconeResync,
    logDocumentChange
} = require('./legalDocumentChangeService');

let genAI;
let embedModel;
let currentGeminiKey = '';
let categoryClassifier;
let currentClassifierKey = '';
const legalEmbeddingItemLimiter = createRollingItemLimiter({
    itemLimit: Number(process.env.LEGAL_EMBED_ITEM_LIMIT) || 80,
    windowMs: 60000
});

const initCloudServices = ({ embeddingRequired = true } = {}) => {
    if (embeddingRequired) {
        const activeKey = SystemConfig.geminiApiKey || process.env.GEMINI_API_KEY;
        if (!activeKey) throw new Error('Missing canonical Gemini API key.');
        if (!genAI || currentGeminiKey !== activeKey) {
            genAI = new GoogleGenerativeAI(activeKey);
            embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });
            currentGeminiKey = activeKey;
        }
    }
    return { embedModel, pineconeIndex: getLegalPineconeIndex() };
};

const updateSyncStatus = async (documentId, ssmsStatus, pineconeStatus) => {
    await poolConnect;
    return pool.request()
        .input('id', documentId)
        .input('ssms', ssmsStatus)
        .input('pinecone', pineconeStatus)
        .query(`
            UPDATE LegalDocuments
            SET SyncStatusSsms = @ssms,
                SyncStatusPinecone = @pinecone
            WHERE Id = @id
        `);
};
const getCategoryClassifier = () => {
    const activeKey = SystemConfig.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!activeKey) throw new Error('Missing canonical Gemini API key.');
    if (!categoryClassifier || currentClassifierKey !== activeKey) {
        categoryClassifier = createClassifier({
            apiKey: activeKey,
            modelName: process.env.CLASSIFICATION_MODEL || DEFAULT_MODEL
        });
        currentClassifierKey = activeKey;
    }
    return categoryClassifier;
};
const upsertLegalData = async (data, isUpdate = false, options = {}) => {
    await poolConnect;
    let documentId = isUpdate && data.id
        ? getLegalDocumentId({ id: data.id })
        : getLegalDocumentId({ documentNumber: data.documentNumber || data.title });
    let sqlPersisted = false;
    let classification;
    try {
        const existingResult = await pool.request()
            .input('id', sql.NVarChar(500), documentId)
            .query(`
                SELECT Id, Title, DocumentNumber, DocumentType, IssueYear, IssueDate,
                       IssueDateString, EffectiveDate, Status, Category, Content,
                       SourceUrl, Agency, ContentHash, SyncStatusSsms, SyncStatusPinecone
                FROM dbo.LegalDocuments WHERE Id = @id
            `);
        const existing = existingResult.recordset[0] || null;
        const resolvedIssueDate = resolveIssueDatePersistence(data, existing);
        const issueDateString = resolvedIssueDate.issueDateString;
        const hasEffectiveDate = Object.prototype.hasOwnProperty.call(data, 'effectiveDate');
        const issueDate = resolvedIssueDate.issueDate;
        const explicitIssueYear = Number(data.issueYear ?? existing?.IssueYear);
        const issueYear = Number.isInteger(explicitIssueYear) && explicitIssueYear > 0
            ? explicitIssueYear
            : issueDate ? Number(issueDate.slice(0, 4)) : null;
        const content = data.content && data.content.trim() !== '' ? data.content : existing?.Content || '';
        const requestedCategory = data.category ?? '';
        const category = await resolveDocumentCategory({
            sourceCategory: requestedCategory,
            existing,
            document: {
                Id: documentId,
                Title: data.title ?? existing?.Title ?? 'Văn bản pháp luật',
                DocumentNumber: data.documentNumber ?? existing?.DocumentNumber ?? null,
                IssuingAgency: data.agency ?? existing?.Agency ?? '',
                ContentPreviewSource: content
            },
            classifier: options.classifyDocument || (document => getCategoryClassifier()(document))
        });
        const normalizedCategory = normalizeLegalCategory(category) || 'Lĩnh vực khác';
        const incoming = {
            doc_id: documentId,
            title: data.title ?? existing?.Title ?? 'Văn bản pháp luật',
            documentNumber: data.documentNumber ?? existing?.DocumentNumber ?? null,
            documentType: inferDocumentType({
                documentType: data.documentType ?? existing?.DocumentType,
                title: data.title ?? existing?.Title,
                documentNumber: data.documentNumber ?? existing?.DocumentNumber
            }),
            issueYear,
            issueDate,
            issueDateString,
            effectiveDate: hasEffectiveDate
                ? normalizeSqlDate(data.effectiveDate)
                : normalizeSqlDate(existing?.EffectiveDate),
            status: normalizeLegalStatus(data.status ?? existing?.Status),
            category: normalizedCategory,
            content,
            sourceUrl: data.sourceUrl ?? existing?.SourceUrl ?? null,
            agency: data.agency ?? existing?.Agency ?? ''
        };
        classification = classifyLegalDocumentChange(existing, incoming);
        logDocumentChange(documentId, classification);

        const shouldResyncPinecone = requiresPineconeResync(existing, classification);
        if (classification.state === DOCUMENT_CHANGE_STATE.UNCHANGED && !shouldResyncPinecone) {
            if (!existing.ContentHash) {
                await pool.request()
                    .input('id', sql.NVarChar(500), documentId)
                    .input('contentHash', sql.NVarChar(64), classification.incomingHash)
                    .query('UPDATE dbo.LegalDocuments SET ContentHash = @contentHash WHERE Id = @id AND ContentHash IS NULL');
            }
            return {
                success: true,
                documentId,
                changeState: classification.state,
                embeddingDocuments: 0,
                syncStatus: { ssms: existing.SyncStatusSsms, pinecone: existing.SyncStatusPinecone }
            };
        }

        const isNew = classification.state === DOCUMENT_CHANGE_STATE.NEW;
        const isMetadataOnly = classification.state === DOCUMENT_CHANGE_STATE.METADATA_CHANGED && !shouldResyncPinecone;
        if (isNew) {
            await pool.request()
                .input('id', sql.NVarChar(500), documentId)
                .input('title', sql.NVarChar(500), incoming.title)
                .input('documentNumber', sql.NVarChar(100), incoming.documentNumber)
                .input('documentType', sql.NVarChar(100), incoming.documentType)
                .input('issueYear', sql.Int, incoming.issueYear)
                .input('issueDate', sql.Date, incoming.issueDate)
                .input('issueDateString', sql.NVarChar(500), incoming.issueDateString)
                .input('effectiveDate', sql.Date, incoming.effectiveDate)
                .input('status', sql.NVarChar(50), incoming.status)
                .input('category', sql.NVarChar(100), incoming.category)
                .input('content', sql.NVarChar(sql.MAX), incoming.content)
                .input('sourceUrl', sql.NVarChar(1000), incoming.sourceUrl)
                .input('agency', sql.NVarChar(500), incoming.agency)
                .query(`
                    INSERT INTO dbo.LegalDocuments
                        (Id, Title, DocumentNumber, DocumentType, IssueYear, IssueDate, IssueDateString,
                         EffectiveDate, Status, Category, Content, CreatedAt,
                         SourceUrl, Agency, ContentHash, SyncStatusSsms, SyncStatusPinecone)
                    VALUES
                        (@id, @title, @documentNumber, @documentType, @issueYear, @issueDate,
                         @issueDateString, @effectiveDate, @status, @category, @content,
                         GETDATE(), @sourceUrl, @agency, NULL, 'success', 'pending')
                `);
        } else {
            await pool.request()
                .input('id', sql.NVarChar(500), documentId)
                .input('title', sql.NVarChar(500), incoming.title)
                .input('documentNumber', sql.NVarChar(100), incoming.documentNumber)
                .input('documentType', sql.NVarChar(100), incoming.documentType)
                .input('issueYear', sql.Int, incoming.issueYear)
                .input('issueDate', sql.Date, incoming.issueDate)
                .input('issueDateString', sql.NVarChar(500), incoming.issueDateString)
                .input('effectiveDate', sql.Date, incoming.effectiveDate)
                .input('status', sql.NVarChar(50), incoming.status)
                .input('category', sql.NVarChar(100), incoming.category)
                .input('content', sql.NVarChar(sql.MAX), incoming.content)
                .input('sourceUrl', sql.NVarChar(1000), incoming.sourceUrl)
                .input('agency', sql.NVarChar(500), incoming.agency)
                .input('contentHash', sql.NVarChar(64), classification.incomingHash)
                .input('metadataOnly', sql.Bit, isMetadataOnly)
                .query(`
                    UPDATE dbo.LegalDocuments
                    SET Title = @title, DocumentNumber = @documentNumber, DocumentType = @documentType,
                        IssueYear = @issueYear, IssueDate = @issueDate,
                        IssueDateString = @issueDateString, EffectiveDate = @effectiveDate,
                        Status = @status, Category = @category, Content = @content,
                        SourceUrl = @sourceUrl, Agency = @agency,
                        ContentHash = CASE WHEN @metadataOnly = 1 THEN @contentHash ELSE ContentHash END,
                        SyncStatusSsms = 'success', SyncStatusPinecone = 'pending'
                    WHERE Id = @id
                `);
        }
        sqlPersisted = true;

        const cloud = initCloudServices({ embeddingRequired: !isMetadataOnly });
        const listed = await listLegalDocumentVectorIds(cloud.pineconeIndex, documentId);
        let staleVectorsRemoved = 0;
        if (isMetadataOnly) {
            await updateLegalDocumentMetadata(cloud.pineconeIndex, incoming, listed.canonicalIds);
        } else {
            const chunks = chunkLegalArticles(incoming.content, { maxChars: 1500 });
            const replacement = await replaceLegalDocumentVectors({
                index: cloud.pineconeIndex,
                document: incoming,
                chunks,
                existingVectorIds: listed.canonicalIds,
                embedChunks: options.embedChunks || (chunksToEmbed => embedChunkBatches(
                    chunksToEmbed,
                    async batch => {
                        const result = await cloud.embedModel.batchEmbedContents({
                            requests: batch.map(chunk => ({
                                content: { role: 'user', parts: [{ text: chunk.text }] },
                                outputDimensionality: 768
                            }))
                        });
                        return (result.embeddings || []).map(embedding => Array.from(embedding.values).slice(0, 768));
                    },
                    {
                        maxTokens: Number(process.env.LEGAL_EMBED_MAX_TOKENS) || 7000,
                        maxItemsPerBatch: Number(process.env.LEGAL_EMBED_MAX_ITEMS) || 20,
                        itemLimiter: legalEmbeddingItemLimiter
                    }
                ))
            });
            staleVectorsRemoved = replacement.staleVectorsRemoved;
        }

        await pool.request()
            .input('id', sql.NVarChar(500), documentId)
            .input('contentHash', sql.NVarChar(64), classification.incomingHash)
            .input('status', sql.NVarChar(50), SYNC_STATUS.SUCCESS)
            .query('UPDATE dbo.LegalDocuments SET ContentHash = @contentHash, SyncStatusPinecone = @status WHERE Id = @id');
        logDocumentChange(documentId, classification, staleVectorsRemoved);
        return {
            success: true,
            documentId,
            changeState: classification.state,
            embeddingDocuments: classification.embeddingRequired || isNew || shouldResyncPinecone ? 1 : 0,
            staleVectorsRemoved,
            syncStatus: { ssms: SYNC_STATUS.SUCCESS, pinecone: SYNC_STATUS.SUCCESS }
        };
    } catch (error) {
        console.error('[legalDataService] upsertLegalData error:', error.message || error);
        if (documentId && sqlPersisted) {
            try { await updateSyncStatus(documentId, SYNC_STATUS.SUCCESS, SYNC_STATUS.FAILED); } catch (updateErr) { }
        }
        return {
            success: false,
            error: error.message,
            changeState: classification?.state,
            staleCleanupFailed: Boolean(error.staleCleanupFailed),
            syncStatus: {
                ssms: sqlPersisted ? SYNC_STATUS.SUCCESS : SYNC_STATUS.FAILED,
                pinecone: SYNC_STATUS.FAILED
            }
        };
    }
};
const deleteLegalData = async (documentId) => {
    await poolConnect;
    const { pineconeIndex } = initCloudServices();

    let pineconeStatus = 'syncing';
    let ssmsStatus = 'syncing';

    try {
        // 1. XÓA TRÊN PINECONE ĐẦU TIÊN


        try {
            // Bỏ $eq, dùng object trực tiếp - Đây là cách "cứu cánh" khi $eq bị lỗi illegal
            await pineconeIndex.deleteMany({
                doc_id: documentId.toString()
            });
            pineconeStatus = 'success';
            console.log(` Đã xóa các vector của ID: ${documentId}`);
        } catch (pcError) {
            // Nếu vẫn lỗi illegal condition, có nghĩa là bản ghi này không có Metadata doc_id
            console.warn(' Pinecone không tìm thấy vector để xóa hoặc lỗi Filter:', pcError.message);
            pineconeStatus = 'success'; // Vẫn cho qua để xóa nốt ở SQL
        }

        // 2. XÓA TRONG SQL SERVER (SSMS)
        await pool.request()
            .input('id', documentId)
            .query('DELETE FROM LegalDocuments WHERE Id = @id');
        ssmsStatus = 'success';

        // Nếu SQL xóa thành công thì xem như thành công, Pinecone lỗi thì báo trạng thái vàng
        return { success: true, syncStatus: { ssms: ssmsStatus, pinecone: pineconeStatus } };

    } catch (error) {
        console.error(' [legalDataService] deleteLegalData error:', error.message || error);
        ssmsStatus = 'error';
        return {
            success: false,
            error: error.message || 'Failed to delete legal data from SQL',
            syncStatus: { ssms: ssmsStatus, pinecone: pineconeStatus }
        };
    }
};
const getLegalDocuments = async ({ page = 1, limit = 10, search = '', category = '', status = '', documentType = '' }) => {
    await poolConnect;

    const whereClauses = [];
    const dataRequest = pool.request();
    const countRequest = pool.request();
    const normalizedSearch = String(search).replace(/\s+/g, ' ').trim();

    if (normalizedSearch) {
        const searchPattern = `%${normalizedSearch.replace(/[\\%_[\]]/g, '\\$&')}%`;
        dataRequest.input('search', sql.NVarChar, searchPattern);
        countRequest.input('search', sql.NVarChar, searchPattern);
        whereClauses.push(`(
            Title COLLATE Vietnamese_100_CI_AI LIKE @search ESCAPE '\\'
            OR DocumentNumber COLLATE Vietnamese_100_CI_AI LIKE @search ESCAPE '\\'
        )`);
    }
    if (category) {
        dataRequest.input('category', sql.NVarChar, category);
        countRequest.input('category', sql.NVarChar, category);
        whereClauses.push('Category = @category');
    }
    if (status) {
        dataRequest.input('status', sql.NVarChar, status);
        countRequest.input('status', sql.NVarChar, status);
        whereClauses.push('Status = @status');
    }
    if (documentType) {
        dataRequest.input('documentType', sql.NVarChar, documentType);
        countRequest.input('documentType', sql.NVarChar, documentType);
        whereClauses.push('DocumentType = @documentType');
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const query = `
        SELECT Id, Title, DocumentNumber, DocumentType, IssueYear, IssueDate, EffectiveDate,
               Status, Category, LEFT(Content, 240) AS ContentPreview,
               CreatedAt, SourceUrl, SyncStatusSsms, SyncStatusPinecone
        FROM LegalDocuments
        ${whereSql}
        ORDER BY CreatedAt DESC
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const countQuery = `SELECT COUNT(*) AS total FROM LegalDocuments ${whereSql}`;

    const [dataResult, countResult] = await Promise.all([
        dataRequest.query(query),
        countRequest.query(countQuery)
    ]);

    const totalItems = countResult.recordset[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);

    return {
        data: dataResult.recordset,
        currentPage: page,
        totalPages,
        totalItems
    };
};

const getDocumentChunks = async (documentId) => {
    await poolConnect;
    const result = await pool.request()
        .input('id', documentId)
        .query('SELECT Content FROM LegalDocuments WHERE Id = @id');

    if (!result.recordset.length) {
        throw new Error('Document not found');
    }

    return chunkLegalArticles(result.recordset[0].Content, { maxChars: 1500 });
};

/**
 * Chuyển đổi tiêu đề luật phức tạp thành slug chuyên nghiệp
 * Ví dụ: "LUẬT ĐẤT ĐAI SỐ 31/2024/QH15, LUẬT NHÀ Ở..." -> "luat-dat-dai-so-31-2024-qh15-luat-nha-o-..."
 */
const convertLegalStringToSlug = (str) => {
    return getLegalDocumentId({ documentNumber: str });
};

module.exports = {
    upsertLegalData,
    deleteLegalData,
    getLegalDocuments,
    getDocumentChunks,
    _test: { convertLegalStringToSlug }
};
