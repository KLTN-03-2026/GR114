const { sql, pool, poolConnect } = require('../src/config/db');
const { inferDocumentType, normalizeDocumentType, parseIssueDateString } = require('../src/constants/legalMetadata');
const BATCH_SIZE = 200;
const UNKNOWN_DOCUMENT_TYPE = 'Chưa xác định';

function classifyDocumentTypeBackfillRow(document) {
    const existingType = normalizeDocumentType(document.DocumentType);
    const hasValidDocumentType = Boolean(document.DocumentType) && existingType !== UNKNOWN_DOCUMENT_TYPE;
    return { hasValidDocumentType, inferredDocumentType: hasValidDocumentType ? existingType : inferDocumentType(document) };
}

async function backfillLegalMetadata({ dryRun = false, dbPool = pool, connection = poolConnect } = {}) {
    await connection;
    const summary = {
        totalDocuments: 0, issueDateFilled: 0, issueDateAlreadyPresent: 0, issueDateParseFailed: 0,
        documentTypeFilled: 0, documentTypeAlreadyPresent: 0, documentTypeUnknown: 0,
        wouldUpdate: 0, wouldRemainUnknown: 0, distribution: {}, unknownSamples: []
    };
    let lastId = '';
    while (true) {
        const result = await dbPool.request().input('lastId', sql.NVarChar(500), lastId)
            .input('batchSize', sql.Int, BATCH_SIZE).query(`
                SELECT TOP (@batchSize) Id, Title, DocumentNumber, DocumentType, IssueDate, IssueDateString
                FROM dbo.LegalDocuments WHERE Id > @lastId ORDER BY Id`);
        if (!result.recordset.length) break;
        for (const document of result.recordset) {
            summary.totalDocuments++;
            lastId = String(document.Id);
            const issueDate = document.IssueDate ? null : parseIssueDateString(document.IssueDateString);
            const { hasValidDocumentType, inferredDocumentType } = classifyDocumentTypeBackfillRow(document);
            const documentType = hasValidDocumentType ? null : inferredDocumentType;
            if (document.IssueDate) summary.issueDateAlreadyPresent++;
            else if (issueDate) summary.issueDateFilled++;
            else summary.issueDateParseFailed++;
            if (hasValidDocumentType) summary.documentTypeAlreadyPresent++;
            else if (documentType !== UNKNOWN_DOCUMENT_TYPE) {
                summary.documentTypeFilled++;
                summary.wouldUpdate++;
                summary.distribution[documentType] = (summary.distribution[documentType] || 0) + 1;
            } else {
                summary.documentTypeUnknown++;
                summary.wouldRemainUnknown++;
                summary.distribution[UNKNOWN_DOCUMENT_TYPE] = (summary.distribution[UNKNOWN_DOCUMENT_TYPE] || 0) + 1;
                if (summary.unknownSamples.length < 20) summary.unknownSamples.push({ Id: document.Id, DocumentNumber: document.DocumentNumber, Title: document.Title });
            }
            if (dryRun) continue;
            try {
                await dbPool.request().input('id', sql.NVarChar(500), document.Id)
                    .input('issueDate', sql.Date, issueDate).input('documentType', sql.NVarChar(100), documentType)
                    .query(`UPDATE dbo.LegalDocuments SET
                        IssueDate = CASE WHEN IssueDate IS NULL THEN @issueDate ELSE IssueDate END,
                        DocumentType = CASE
                            WHEN DocumentType IS NULL OR DocumentType = N'Chưa xác định' THEN @documentType
                            ELSE DocumentType
                        END WHERE Id = @id`);
            } catch (error) { console.error(`[LEGAL METADATA BACKFILL] Id=${document.Id} failed: ${error.message}`); }
        }
    }
    console.log(dryRun ? '[LEGAL METADATA BACKFILL DRY RUN]' : '[LEGAL METADATA BACKFILL SUMMARY]', summary);
    return summary;
}

if (require.main === module) {
    const dryRun = process.argv.includes('--dry-run');
    backfillLegalMetadata({ dryRun }).then(() => pool.close()).catch(error => {
        console.error('[LEGAL METADATA BACKFILL] Fatal:', error);
        process.exitCode = 1;
    });
}

module.exports = { backfillLegalMetadata, classifyDocumentTypeBackfillRow };
