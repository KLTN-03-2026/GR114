const { pool, poolConnect } = require('../config/db');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');
const { chunkText } = require('../utils/chunkingUtils');

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX || 'legai-index';
let genAI;
let embedModel;
let pineconeClient;
let pineconeIndex;

const initCloudServices = () => {
    if (!genAI) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    }
    if (!pineconeClient) {
        pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        pineconeIndex = pineconeClient.index(PINECONE_INDEX_NAME);
    }
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

const upsertLegalData = async (data, isUpdate = false) => {
    await poolConnect;
    initCloudServices();

    let documentId;
    let ssmsStatus = 'syncing';
    let pineconeStatus = 'syncing';

    try {
        const request = pool.request()
            .input('title', data.title)
            .input('documentNumber', data.documentNumber || null)
            .input('issueYear', data.issueYear || null)
            .input('status', data.status || 'Còn hiệu lực')
            .input('category', data.category || null)
            .input('content', data.content)
            .input('sourceUrl', data.sourceUrl || null);

        if (isUpdate) {
            request.input('id', data.id);
            await request.query(`
                UPDATE LegalDocuments
                SET Title = @title,
                    DocumentNumber = @documentNumber,
                    IssueYear = @issueYear,
                    Status = @status,
                    Category = @category,
                    Content = @content,
                    SourceUrl = @sourceUrl,
                    SyncStatusSsms = 'syncing',
                    SyncStatusPinecone = 'syncing'
                WHERE Id = @id
            `);
            documentId = data.id;
        } else {
            const result = await request.query(`
                INSERT INTO LegalDocuments
                    (Title, DocumentNumber, IssueYear, Status, Category, Content, CreatedAt, SourceUrl, SyncStatusSsms, SyncStatusPinecone)
                OUTPUT INSERTED.Id
                VALUES
                    (@title, @documentNumber, @issueYear, @status, @category, @content, GETDATE(), @sourceUrl, 'syncing', 'syncing')
            `);
            documentId = result.recordset[0].Id;
        }

        ssmsStatus = 'success';
        await updateSyncStatus(documentId, ssmsStatus, pineconeStatus);

        const chunks = chunkText(data.content, 1500, 200);
        const vectors = [];

        for (let index = 0; index < chunks.length; index += 1) {
            const chunk = chunks[index];
            const embeddingResult = await embedModel.embedContent(chunk);
            const vectorValues = Array.from(embeddingResult.embedding.values);

            vectors.push({
                id: `${documentId}_${index}`,
                values: vectorValues,
                metadata: {
                    title: data.title,
                    documentNumber: data.documentNumber || null,
                    issueYear: data.issueYear || null,
                    status: data.status || 'Còn hiệu lực',
                    category: data.category || null,
                    text: chunk
                }
            });
        }

        if (vectors.length > 0) {
            await pineconeIndex.upsert({ vectors });
        }

        pineconeStatus = 'success';
        await updateSyncStatus(documentId, ssmsStatus, pineconeStatus);

        return { success: true, documentId, syncStatus: { ssms: ssmsStatus, pinecone: pineconeStatus } };
    } catch (error) {
        console.error('[legalDataService] upsertLegalData error:', error.message || error);
        if (ssmsStatus !== 'success') ssmsStatus = 'error';
        pineconeStatus = 'error';

        if (documentId) {
            try {
                await updateSyncStatus(documentId, ssmsStatus, pineconeStatus);
            } catch (updateErr) {
                console.error('[legalDataService] failed to update sync status:', updateErr.message || updateErr);
            }
        }

        return { success: false, error: error.message || 'Failed to upsert legal data', syncStatus: { ssms: ssmsStatus, pinecone: pineconeStatus } };
    }
};

const deleteLegalData = async (documentId) => {
    await poolConnect;
    initCloudServices();

    let pineconeStatus = 'syncing';
    let ssmsStatus = 'syncing';

    try {
        await pineconeIndex.delete({ filter: { documentId: documentId.toString() } });
        pineconeStatus = 'success';

        await pool.request()
            .input('id', documentId)
            .query('DELETE FROM LegalDocuments WHERE Id = @id');
        ssmsStatus = 'success';

        return { success: true, syncStatus: { ssms: ssmsStatus, pinecone: pineconeStatus } };
    } catch (error) {
        console.error('[legalDataService] deleteLegalData error:', error.message || error);
        if (pineconeStatus !== 'success') pineconeStatus = 'error';
        if (ssmsStatus !== 'success') ssmsStatus = 'error';
        return { success: false, error: error.message || 'Failed to delete legal data', syncStatus: { ssms: ssmsStatus, pinecone: pineconeStatus } };
    }
};

const getLegalDocuments = async ({ page = 1, limit = 10, search = '', category = '', status = '' }) => {
    await poolConnect;

    let whereClauses = [];
    const request = pool.request();

    if (search) {
        request.input('search', `%${search}%`);
        whereClauses.push('(Title LIKE @search OR Content LIKE @search)');
    }
    if (category) {
        request.input('category', category);
        whereClauses.push('Category = @category');
    }
    if (status) {
        request.input('status', status);
        whereClauses.push('Status = @status');
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const query = `
        SELECT Id, Title, DocumentNumber, IssueYear, Status, Category, LEFT(Content, 240) AS ContentPreview,
               CreatedAt, SourceUrl, SyncStatusSsms, SyncStatusPinecone
        FROM LegalDocuments
        ${whereSql}
        ORDER BY CreatedAt DESC
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const countQuery = `SELECT COUNT(*) AS total FROM LegalDocuments ${whereSql}`;

    const [dataResult, countResult] = await Promise.all([
        request.query(query),
        request.query(countQuery)
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

    return chunkText(result.recordset[0].Content, 1500, 200);
};

module.exports = {
    upsertLegalData,
    deleteLegalData,
    getLegalDocuments,
    getDocumentChunks
};