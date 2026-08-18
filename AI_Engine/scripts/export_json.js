// File: scripts/export_json.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool, poolConnect } = require('../src/config/db');

/**
 * Exports cleaned legal documents from SQL Server to a local JSON file.
 * Query criteria: SyncStatusPinecone = 'pending'
 */
async function exportSqlToJson() {
    try {
        await poolConnect;
        console.log("[DB] SQL Server connection established successfully.");

        console.log("[Query] Executing SQL query for pending legal documents...");
        const result = await pool.request().query(`
            SELECT 
                Id, 
                Title, 
                DocumentNumber, 
                IssueYear, 
                Status, 
                Category, 
                Content, 
                SourceUrl, 
                Agency
            FROM LegalDocuments
            WHERE SyncStatusPinecone = 'pending'
        `);

        const documents = result.recordset;
        console.log(`[Data] Successfully retrieved ${documents.length} records.`);

        const outputPath = path.join(__dirname, '../clean_data.json');
        
        console.log(`[FS] Writing records to ${outputPath}...`);
        fs.writeFileSync(outputPath, JSON.stringify(documents, null, 2), 'utf8');

        console.log(`[Success] Data export completed. Output file: ${outputPath}`);
        process.exit(0);

    } catch (error) {
        console.error("[Error] Export process failed:", error.message);
        process.exit(1);
    }
}

exportSqlToJson();