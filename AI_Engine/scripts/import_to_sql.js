const fs = require('fs');
const path = require('path');

const { sql, poolConnect, pool } = require('../src/config/db');


const jsonFiles = ['data3.json'];

async function importLawsToSQL() {
    try {
        console.log(" Đang khởi động tiến trình nạp dữ liệu phẳng vào SQL Server (SSMS)...");
        await poolConnect;

        let totalInserted = 0;
        let totalSkipped = 0;

        for (const fileName of jsonFiles) {
            const filePath = path.resolve(__dirname, fileName);

            if (!fs.existsSync(filePath)) {
                console.log(` Không tìm thấy file: ${fileName} tại đường dẫn, bỏ qua.`);
                continue;
            }

            console.log(`\n Đang đọc dữ liệu từ file: ${fileName}...`);
            const rawData = fs.readFileSync(filePath, 'utf-8');
            const lawsArray = JSON.parse(rawData);

            console.log(` Tìm thấy ${lawsArray.length} văn bản luật. Bắt đầu ánh xạ vào DB...`);

            for (let i = 0; i < lawsArray.length; i++) {
                const law = lawsArray[i];

                // 1. check duplicate 
                const checkDuplicate = await pool.request()
                    .input('id', sql.NVarChar(100), law.id)
                    .query("SELECT Id FROM LegalDocuments WHERE Id = @id");

                if (checkDuplicate.recordset.length > 0) {
                    totalSkipped++;
                    continue;
                }

                // 2. INSERT  SSMS
                await pool.request()
                    .input('Id', sql.NVarChar(100), law.id)
                    .input('Title', sql.NVarChar(500), law.title || 'Văn bản pháp luật')
                    .input('DocumentNumber', sql.NVarChar(100), law.documentNumber || 'N/A')
                    .input('IssueYear', sql.Int, law.issueYear || new Date().getFullYear())
                    .input('Status', sql.NVarChar(100), law.status || 'Còn hiệu lực')
                    .input('Category', sql.NVarChar(200), law.category || 'Lĩnh vực khác')
                    .input('Content', sql.NVarChar(sql.MAX), law.content || '')
                    .input('CreatedAt', sql.DateTime, law.createdAt ? new Date(law.createdAt) : new Date())
                    .input('SourceUrl', sql.NVarChar(500), law.sourceUrl || law.source_url || '')
                    .input('SyncStatusSsms', sql.NVarChar(50), 'success')
                    .input('SyncStatusPinecone', sql.NVarChar(50), 'pending')
                    .input('Agency', sql.NVarChar(200), law.agency || 'Cơ quan ban hành')
                    .input('IssueDateString', sql.NVarChar(100), law.issueDateString || law.issue_date || '')
                    .query(`
                        INSERT INTO LegalDocuments (
                            Id, Title, DocumentNumber, IssueYear, Status, Category, Content, 
                            CreatedAt, SourceUrl, SyncStatusSsms, SyncStatusPinecone, Agency, IssueDateString
                        ) VALUES (
                            @Id, @Title, @DocumentNumber, @IssueYear, @Status, @Category, @Content, 
                            @CreatedAt, @SourceUrl, @SyncStatusSsms, @SyncStatusPinecone, @Agency, @IssueDateString
                        )
                    `);

                totalInserted++;


                if (totalInserted % 10 === 0) {
                    console.log(`    Đã nạp thành công thêm ${totalInserted} luật vào SQL Server...`);
                }
            }
        }



        console.log(` Tổng số luật mới đã chèn thành công vào SSMS: ${totalInserted}`);
        console.log(` Số luật bị bỏ qua (do trùng lặp khóa chính Id): ${totalSkipped}`);
        process.exit(0);

    } catch (error) {
        console.error("\nLỗi khi thực thi truy vấn INSERT SSMS:", error.message);
        process.exit(1);
    }
}


importLawsToSQL();