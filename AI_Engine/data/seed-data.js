const fs = require('fs');

function escapeAndChunk(text) {
    if (!text) return "N''";
    const safeText = text.replace(/'/g, "''");
    const chunks = safeText.match(/[\s\S]{1,2000}/g);
    if (!chunks) return "N''";
    return chunks.map(c => `N'${c}'`).join(' + \n');
}

async function generateSqlScript() {
    try {
        console.log("⏳ Bắt đầu phân tích JSON và tạo mã SQL (Đã fix lỗi Truncate)...");

        const dataPath = 'D:/01_Projects/KLTN_DTU_2026/Repo_thamkhao/legal-ai-agent/data/uts_vlc_processed.json';
        const lawsArray = JSON.parse(fs.readFileSync(dataPath, 'utf8')); 
        const statusMap = JSON.parse(fs.readFileSync('law_status_map.json', 'utf8'));

        let sqlContent = `USE [LegalBotDB];\nGO\n\n`;
        sqlContent += `PRINT N'🧹 Đang dọn dẹp bảng cũ...';\n`;
        sqlContent += `DELETE FROM [dbo].[LegalDocuments];\nGO\n\n`;
        sqlContent += `PRINT N'⏳ Bắt đầu bơm data mới...';\nGO\n\n`;

        let count = 0;

        for (const law of lawsArray) {
            const mapKey = law.id.replace('code-', 'law-'); 
            const status = statusMap[mapKey] || statusMap[law.id]; 

            if (status === "Còn hiệu lực") {
                
                // 👇 [ĐÃ FIX] Bắt buộc dừng lại khi gặp dấu xuống dòng
                const soHieuMatch = law.content.match(/\*\*Số hiệu:\*\*\s*([^\r\n]+)/);
                let documentNumber = soHieuMatch ? soHieuMatch[1].trim() : "Đang cập nhật";
                
                // Lớp bảo vệ 2: Ép độ dài tối đa để SSMS không bao giờ bị nghẹn
                if (documentNumber.length > 90) {
                    documentNumber = documentNumber.substring(0, 90);
                }

                const yearMatch = law.id.match(/-(\d{4})-/);
                const issueYear = yearMatch ? parseInt(yearMatch[1]) : 'NULL';

                const safeTitle = escapeAndChunk(law.title);
                const safeContent = escapeAndChunk(law.content);

                sqlContent += `INSERT INTO [dbo].[LegalDocuments] ([Id], [Title], [DocumentNumber], [IssueYear], [Status], [Category], [Content], [CreatedAt]) \n`;
                sqlContent += `VALUES ('${law.id}', ${safeTitle}, N'${documentNumber}', ${issueYear}, N'${status}', N'Chưa phân loại', ${safeContent}, GETDATE());\nGO\n\n`;
                
                count++;
            }
        }

        sqlContent += `PRINT N'🎉 XUẤT SẮC! Đã bơm thành công ${count} văn bản!';\nGO\n`;

        fs.writeFileSync('insert_data.sql', sqlContent, 'utf8');
        
        console.log(`✅ ĐÃ XONG! Hãy kéo file 'insert_data.sql' mới đẻ ra này vào SSMS và bấm F5 lại lần nữa.`);
    } catch (err) {
        console.error("❌ LỖI RỒI:", err);
    }
}

generateSqlScript();