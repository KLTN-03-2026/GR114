const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { sql, pool, poolConnect } = require('../src/config/db');
const { computeLegalContentHash } = require('../src/services/legalDocumentChangeService');

const BATCH_SIZE = 200;

async function backfillContentHashes() {
    await poolConnect;
    let updated = 0;

    while (true) {
        const result = await pool.request()
            .input('batchSize', sql.Int, BATCH_SIZE)
            .query(`
                SELECT TOP (@batchSize) Id, Content
                FROM dbo.LegalDocuments
                WHERE ContentHash IS NULL
                ORDER BY Id
            `);

        if (result.recordset.length === 0) break;

        for (const document of result.recordset) {
            const contentHash = computeLegalContentHash(document.Content);
            await pool.request()
                .input('id', sql.NVarChar(500), document.Id)
                .input('contentHash', sql.NVarChar(64), contentHash)
                .query(`
                    UPDATE dbo.LegalDocuments
                    SET ContentHash = @contentHash
                    WHERE Id = @id AND ContentHash IS NULL
                `);
            updated += 1;
        }

        console.log(`[CONTENT HASH BACKFILL] updated=${updated}`);
    }

    console.log(`[CONTENT HASH BACKFILL COMPLETE] updated=${updated}`);
}

backfillContentHashes()
    .then(() => pool.close())
    .catch(async error => {
        console.error('[CONTENT HASH BACKFILL FAILED]', error);
        await pool.close().catch(() => {});
        process.exitCode = 1;
    });
