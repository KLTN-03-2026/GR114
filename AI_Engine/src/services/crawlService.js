const { sql, pool, poolConnect } = require('../config/db');
const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const geminiService = require('./geminiService');



// 1. Kiểm tra Key trước khi khởi tạo
if (!process.env.GEMINI_API_KEY || !process.env.PINECONE_API_KEY) {
    console.error("\n [CẢNH BÁO]: Thiếu API Key trong file .env!");
    console.error(" Vui lòng kiểm tra GEMINI_API_KEY và PINECONE_API_KEY.\n");
    process.exit(1);
}

// Khởi tạo Gemini cho embedding
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy-key");
const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

// Khởi tạo Pinecone client
const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || "dummy-key"
});

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Trạng thái crawl
let crawlStatus = { isRunning: false, current: 0, total: 0, title: '', step: '' };

const getCrawlStatus = () => crawlStatus;

const extremeDeepClean = (text) => {
    if (!text) return "";
    return text
        // 1. Hàn các từ bị chẻ đôi (nhà nư\nớc -> nhà nước)
        .replace(/([a-záàảãạâấầẩẫậăắằẳẵặéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ])[\s]*[\n\r]+[\s]*([a-záàảãạâấầẩẫậăắằẳẵặéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ])/gi, '$1$2')

        // 2. Nối các dòng thuộc cùng một câu (Dòng kết thúc không phải dấu chấm/hỏi/than)
        .replace(/([^.!?:\n])\n(?![A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝ])[\s]*/g, '$1 ')

        // 3. Fix cứng các cụm từ quan trọng
        .replace(/Qu\s+ốc hội/gi, 'Quốc hội')
        .replace(/Cộng\s+hòa/gi, 'Cộng hòa')
        .replace(/Xã\s+hội/gi, 'Xã hội')

        // 4. Thu gọn khoảng trắng và định dạng lại đoạn văn (\n\n)
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
};

const processLegalCrawl = async (urlArray, io) => {
    try {
        crawlStatus = { isRunning: true, current: 0, total: urlArray.length, title: '', step: '' };

        const apiKey = process.env.CRAWLKIT_API_KEY ? process.env.CRAWLKIT_API_KEY.trim() : null;
        if (!apiKey) throw new Error('Thiếu CRAWLKIT_API_KEY trong .env');

        await poolConnect;

        let successCount = 0;
        let duplicateCount = 0;
        let failCount = 0;

        for (let i = 0; i < urlArray.length; i++) {
            const url = String(urlArray[i] || '').trim();
            if (!url) continue;

            try {
                // Emit progress: Bắt đầu cào
                crawlStatus = { ...crawlStatus, current: i + 1, title: 'Đang kiểm tra trùng lặp...', step: 'check' };
                if (io) io.emit('crawl-progress', crawlStatus);

                // --- BƯỚC 1: CHECK TRÙNG ---
                const checkRequest = pool.request();
                checkRequest.input('url', sql.NVarChar(1000), url);
                const checkResult = await checkRequest.query('SELECT Id FROM dbo.LegalDocuments WHERE SourceUrl = @url');

                if (checkResult.recordset.length > 0) {
                    duplicateCount++;
                    crawlStatus = { ...crawlStatus, title: 'URL đã tồn tại, bỏ qua', step: 'duplicate' };
                    if (io) io.emit('crawl-progress', crawlStatus);
                    continue;
                }

                // Emit: Đang cào data
                crawlStatus = { ...crawlStatus, title: 'Đang thu thập dữ liệu...', step: 'crawl' };
                if (io) io.emit('crawl-progress', crawlStatus);

                // --- BƯỚC 2: CÀO DATA ---
                const crawlResponse = await axios.post('https://api.crawlkit.org/v1/scrape',
                    { url },
                    { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 }
                );

                const rawData = crawlResponse.data.data;
                const content = rawData.transcript || rawData.content || rawData.text || "";
                const title = rawData.title || `[LegAI Crawled] ${url.substring(0, 50)}...`;

                if (!content) {
                    failCount++;
                    crawlStatus = { ...crawlStatus, title: 'Không lấy được nội dung, bỏ qua', step: 'fail' };
                    if (io) io.emit('crawl-progress', crawlStatus);
                    continue;
                }

                // Emit: Đang phân loại
                crawlStatus = { ...crawlStatus, title: `Đang phân loại: ${title.substring(0, 30)}...`, step: 'classify' };
                if (io) io.emit('crawl-progress', crawlStatus);

                // --- BƯỚC 3: MAPPING & AI CLASSIFY ---
                let documentNumber = rawData.documentNumber || null;
                let issueYear = rawData.issueYear || null;
                const upperContent = content.toUpperCase();

                // 1. Regex bóc tách số hiệu
                if (!documentNumber) {
                    const docNumMatch = content.match(/(?:Số hiệu|Số)\s*:?\s*([0-9\/\.\-]+[A-ZĐ\-]+)/i);
                    const backupMatch = content.match(/([0-9]{1,4}\/[0-9]{4}\/[A-ZĐ0-9\-]{2,10})/);

                    if (docNumMatch) documentNumber = docNumMatch[1].trim();
                    else if (backupMatch) documentNumber = backupMatch[1].trim();
                    else if (upperContent.includes("DỰ THẢO")) documentNumber = "Văn bản Dự thảo";
                }

                // 2. Bóc tách năm ban hành
                if (!issueYear) {
                    const yearInNo = documentNumber ? documentNumber.match(/\d{4}/) : null;
                    const yearInContent = content.match(/năm\s+(20\d{2})/i);
                    issueYear = yearInNo ? parseInt(yearInNo[0]) : (yearInContent ? parseInt(yearInContent[1]) : new Date().getFullYear());
                }

                // 3. AI PHÂN LOẠI
                let finalCategory = "Lĩnh vực khác";
                try {
                    finalCategory = await geminiService.classifyCategoryWithAI(title);
                } catch (aiErr) {
                    console.error(" AI Phân loại thất bại, dùng mặc định:", aiErr.message);
                }

                // Emit: Đang lưu vào DB
                crawlStatus = { ...crawlStatus, title: `Đang lưu: ${title.substring(0, 30)}...`, step: 'sql' };
                if (io) io.emit('crawl-progress', crawlStatus);

                // --- BƯỚC 4: INSERT VÀO DB ---
                const documentId = `DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                const insertRequest = pool.request();

                insertRequest.input('id', sql.NVarChar(100), documentId);
                insertRequest.input('title', sql.NVarChar(500), title);
                insertRequest.input('documentNumber', sql.NVarChar(100), documentNumber || "Chưa xác định");
                insertRequest.input('issueYear', sql.Int, issueYear);
                insertRequest.input('status', sql.NVarChar(100), 'Còn hiệu lực');
                insertRequest.input('category', sql.NVarChar(100), finalCategory);
                insertRequest.input('content', sql.NVarChar(sql.MAX), extremeDeepClean(content));
                insertRequest.input('sourceUrl', sql.NVarChar(1000), url);

                await insertRequest.query(`
                    INSERT INTO dbo.LegalDocuments
                    (Id, Title, DocumentNumber, IssueYear, Status, Category, Content, SourceUrl, CreatedAt)
                    VALUES
                    (@id, @title, @documentNumber, @issueYear, @status, @category, @content, @sourceUrl, GETDATE());
                `);

                // Emit: Đang sync Pinecone
                crawlStatus = { ...crawlStatus, title: `Đang đồng bộ vector: ${title.substring(0, 30)}...`, step: 'pinecone' };
                if (io) io.emit('crawl-progress', crawlStatus);

                // --- BƯỚC 5: SYNC PINECONE ---
                const embedResult = await embedModel.embedContent(content);
                const embedding = Array.from(embedResult.embedding.values);

                const indexName = process.env.PINECONE_INDEX_NAME || 'legai-index';
                const index = pc.index(indexName);

                const vectorId = `doc_${documentId}_${Date.now()}`;
                const vectors = [{
                    id: vectorId,
                    values: embedding,
                    metadata: {
                        title: title,
                        url: url,
                        documentId: documentId,
                        source: 'CrawlKit',
                        crawledAt: new Date().toISOString()
                    }
                }];

                await index.upsert(vectors);

                successCount++;
                console.log(`✅ Đã cào & phân loại: ${title.substring(0, 30)}... -> ${finalCategory}`);
                await wait(1000); // Nghỉ 1 giây giữa các URL

            } catch (urlError) {
                console.error(`❌ Lỗi URL ${url}:`, urlError.message);
                failCount++;
                crawlStatus = { ...crawlStatus, title: `Lỗi: ${urlError.message}`, step: 'error' };
                if (io) io.emit('crawl-progress', crawlStatus);
            }
        }

        // --- BƯỚC 6: UPDATE THỐNG KÊ ---
        if (successCount > 0) {
            const usageRequest = pool.request();
            usageRequest.input('fName', sql.NVarChar(100), 'CRAWL_DATA');
            usageRequest.input('inc', sql.Int, successCount);

            const updateRes = await usageRequest.query(`
                UPDATE dbo.AIFeatureUsage SET UsageCount = UsageCount + @inc, LastUsed = SYSUTCDATETIME()
                WHERE FeatureName = @fName;
            `);

            if (updateRes.rowsAffected[0] === 0) {
                await pool.request().input('fn', sql.NVarChar(100), 'CRAWL_DATA').input('ic', sql.Int, successCount)
                    .query(`INSERT INTO dbo.AIFeatureUsage (FeatureName, UsageCount) VALUES (@fn, @ic);`);
            }
        }

        // Emit hoàn thành
        crawlStatus = { isRunning: false, current: urlArray.length, total: urlArray.length, title: 'Hoàn thành thu thập', step: 'done' };
        if (io) io.emit('crawl-progress', crawlStatus);

        return { successCount, duplicateCount, failCount };

    } catch (error) {
        console.error('❌ [CRITICAL ERROR in processLegalCrawl]', error);
        crawlStatus = { isRunning: false, current: 0, total: urlArray.length, title: `Lỗi hệ thống: ${error.message}`, step: 'error' };
        if (io) io.emit('crawl-progress', crawlStatus);
        throw error;
    }
};

module.exports = {
    processLegalCrawl,
    getCrawlStatus
};