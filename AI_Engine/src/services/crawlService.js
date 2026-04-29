const { sql, pool, poolConnect } = require('../config/db');
const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const geminiService = require('./geminiService');

// 1. Kiểm tra Key trước khi khởi tạo (Đã thêm JINA_API_KEY)
if (!process.env.GEMINI_API_KEY || !process.env.PINECONE_API_KEY || !process.env.JINA_API_KEY) {
    console.error("\n [CẢNH BÁO]: Thiếu API Key trong file .env!");
    console.error(" Vui lòng kiểm tra GEMINI_API_KEY, PINECONE_API_KEY và JINA_API_KEY.\n");
    process.exit(1);
}

// Khởi tạo Gemini cho embedding
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

// Khởi tạo Pinecone client
const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
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
        // 2. Nối các dòng thuộc cùng một câu
        .replace(/([^.!?:\n])\n(?![A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝ])[\s]*/g, '$1 ')
        // 3. Fix cứng các cụm từ quan trọng
        .replace(/Qu\s+ốc hội/gi, 'Quốc hội')
        .replace(/Cộng\s+hòa/gi, 'Cộng hòa')
        .replace(/Xã\s+hội/gi, 'Xã hội')
        // 4. Thu gọn khoảng trắng và định dạng lại đoạn văn
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
};

const processLegalCrawl = async (urlArray, io) => {
    try {
        // Thêm let để tránh lỗi ReferenceError
        let crawlStatus = { isRunning: true, current: 0, total: urlArray.length, title: '', step: '' };
        await poolConnect;

        let successCount = 0; let duplicateCount = 0; let failCount = 0;

        // 1. Hàm băm nhỏ văn bản (Giữ nguyên thuật toán của Duy)
        function smartChunk(content) {
            if (!content || typeof content !== 'string' || content.length === 0) return [];
            const chunks = [];
            const chunkSize = 1500; const overlap = 200;
            let start = 0; const max = content.length;
            while (start < max) {
                const end = Math.min(start + chunkSize, max);
                if (end <= start) break;
                const text = String(content.slice(start, end)).trim();
                if (text.length > 0) chunks.push({ text });
                if (end === max) break;
                start = end - overlap;
                if (start < 0) start = 0;
                if (start >= end) start = end;
            }
            return chunks;
        }

        for (let i = 0; i < urlArray.length; i++) {
            const url = String(urlArray[i] || '').trim();
            if (!url) continue;

            try {
                // --- BƯỚC 1: CHECK TRÙNG ---
                const checkResult = await pool.request()
                    .input('url', sql.NVarChar(1000), url)
                    .query('SELECT Id FROM dbo.LegalDocuments WHERE SourceUrl = @url');

                if (checkResult.recordset.length > 0) {
                    duplicateCount++; continue;
                }

                // --- BƯỚC 2: CÀO DATA 
                if (io) io.emit('crawl-progress', { ...crawlStatus, current: i + 1, title: 'Đang bóc tách dữ liệu...', step: 'crawl' });

                let crawlResponse;
                let content = "";
                let title = "";
                let retryCount = 0;
                const maxRetries = 3;

                while (retryCount < maxRetries && content.length < 200) {
                    try {
                        crawlResponse = await axios.get(`https://r.jina.ai/${url}`, {
                            headers: {
                                'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
                                'X-Return-Format': 'markdown', // Sử dụng markdown để ít lỗi hơn với Cloudflare
                                'X-No-Cache': 'true',
                                'X-Target-Selector': '#divContentDoc, article, .content, .main-content, .document-content', // Thêm selector dự phòng
                                'X-Wait-For-Selector': '#divContentDoc',
                                'X-Timeout': '120000' // Tăng timeout lên 2 phút để chờ Cloudflare ban đêm
                            },
                            timeout: 125000 // Timeout axios lớn hơn header Jina
                        });

                        const rawData = crawlResponse.data?.data || {};
                        let rawContent = rawData.content || "";
                        title = rawData.title || "";

                        // Hàm clean markdown ngắn gọn
                        const cleanMarkdown = (md) => {
                            if (!md) return "";
                            return md
                                .replace(/\*\*([^*]+)\*\*/g, '$1') // Xóa **bold**
                                .replace(/\*([^*]+)\*/g, '$1')     // Xóa *italic*
                                .replace(/^#+\s*/gm, '')           // Xóa # headers
                                .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Chuyển [text](url) thành text
                                .trim();
                        };

                        content = cleanMarkdown(rawContent);

                        console.log(`[Crawl] Retry ${retryCount + 1}/${maxRetries} | URL: ${url.substring(0, 50)}... | Length: ${content.length}`);

                        if (content.length < 200) {
                            console.warn(` Nội dung quá ngắn (length: ${content.length}), thử lại sau 10s...`);
                            await wait(10000);
                            retryCount++;
                        } else {
                            break; // Thành công
                        }

                    } catch (crawlError) {
                        console.error(` Lỗi crawl tại retry ${retryCount + 1}:`, crawlError.message);
                        if (crawlError.code === 'ECONNABORTED' || crawlError.message.includes('timeout')) {
                            console.log(` Timeout, thử lại sau 15s...`);
                            await wait(15000);
                        } else {
                            // Lỗi khác, không retry
                            break;
                        }
                        retryCount++;
                    }
                }

                if (content.length < 200) {
                    console.error(` Sau ${maxRetries} lần thử, nội dung vẫn quá ngắn. Web có thể đã chặn hoặc selector sai.`);
                    failCount++;
                    continue;
                }
                // --- BƯỚC 3: PHÂN LOẠI & TRÍCH XUẤT ---
                const finalCategory = getCategoryFromUrl(url);
                console.log(` Phân loại: ${finalCategory}`);

                const docNumMatch = content.match(/([0-9]{1,4}\/[0-9]{4}\/[A-ZĐ0-9\-]{2,10})/);
                const documentNumber = docNumMatch ? docNumMatch[1] : "Đang cập nhật";
                const yearMatch = documentNumber.match(/\d{4}/) || content.match(/năm\s+(20\d{2})/i);
                const issueYear = yearMatch ? parseInt(yearMatch[0] || yearMatch[1]) : new Date().getFullYear();

                // --- BƯỚC 4: LƯU SQL SERVER (Đã vá lỗi thiếu cột) ---
                const documentId = `DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                await pool.request()
                    .input('id', sql.NVarChar(100), documentId)
                    .input('title', sql.NVarChar(500), title)
                    .input('docNum', sql.NVarChar(100), documentNumber)
                    .input('year', sql.Int, issueYear)
                    .input('category', sql.NVarChar(100), finalCategory)
                    .input('content', sql.NVarChar(sql.MAX), content)
                    .input('sourceUrl', sql.NVarChar(1000), url)
                    .input('syncSsms', sql.NVarChar(50), 'success')
                    .input('syncPinecone', sql.NVarChar(50), 'pending')
                    .query(`
                        INSERT INTO dbo.LegalDocuments 
                        (Id, Title, DocumentNumber, IssueYear, Status, Category, Content, SourceUrl, CreatedAt, SyncStatusSsms, SyncStatusPinecone) 
                        VALUES 
                        (@id, @title, @docNum, @year, N'Còn hiệu lực', @category, @content, @sourceUrl, GETDATE(), @syncSsms, @syncPinecone)
                    `);

                // --- BƯỚC 5: NHÚNG VECTOR ---
                if (io) io.emit('crawl-progress', { ...crawlStatus, current: i + 1, title: 'Đang tạo vector...', step: 'pinecone' });

                const chunkData = smartChunk(content);
                const index = pc.index(process.env.PINECONE_INDEX_NAME || 'legai-index');
                const vectors = [];

                for (let chunkIdx = 0; chunkIdx < chunkData.length; chunkIdx++) {
                    // Đã thêm try...catch chống 429
                    try {
                        const embedResult = await embedModel.embedContent(chunkData[chunkIdx].text);
                        vectors.push({
                            id: `${documentId}_chunk_${chunkIdx}`,
                            values: Array.from(embedResult.embedding.values).map(Number),
                            metadata: {
                                doc_id: documentId,
                                title: title,
                                doc_type: 'law',
                                text: chunkData[chunkIdx].text,
                                chunk_length: chunkData[chunkIdx].text.length,
                                text_preview: chunkData[chunkIdx].text.substring(0, 300),
                                source: url
                            }
                        });
                        await new Promise(r => setTimeout(r, 400));
                    } catch (chunkError) {
                        if (chunkError.message && chunkError.message.includes('429')) {
                            console.log(`⏳ Quá tải API Gemini, nghỉ 30 giây...`);
                            await new Promise(r => setTimeout(r, 30000));
                            chunkIdx--; // Lùi lại để thử lại
                            continue;
                        } else {
                            console.error(` Lỗi vector chunk ${chunkIdx}:`, chunkError.message);
                        }
                    }
                }

                for (let j = 0; j < vectors.length; j += 50) {
                    await index.upsert(vectors.slice(j, j + 50));
                }

                await pool.request()
                    .input('id', sql.NVarChar(100), documentId)
                    .query("UPDATE LegalDocuments SET SyncStatusPinecone = 'success' WHERE Id = @id");

                successCount++;
                console.log(` Thành công: ${title.substring(0, 40)}`);
                await new Promise(r => setTimeout(r, 2000));

            } catch (urlError) {
                console.error(` Lỗi tại URL ${url}:`, urlError.message);
                failCount++;
            }
        }

        if (io) io.emit('crawl-progress', { isRunning: false, title: 'Hoàn thành!' });
        return { successCount, duplicateCount, failCount };

    } catch (error) {
        console.error(' Lỗi hệ thống:', error);
        throw error;
    }
};
// Hàm map URL sang Category 
const getCategoryFromUrl = (url) => {
    // Danh sách map từ URL sang tên hiển thị 
    const categoryMap = {
        'Bo-may-hanh-chinh': 'Bộ máy hành chính',
        'Van-hoa-Xa-hoi': 'Văn hóa - Xã hội',
        'Tai-chinh-nha-nuoc': 'Tài chính nhà nước',
        'The-thao-Y-te': 'Thể thao - Y tế',
        'Tai-nguyen-Moi-truong': 'Tài nguyên - Môi trường',
        'Thuong-mai': 'Thương mại',
        'Bat-dong-san': 'Bất động sản',
        'Xay-dung-Do-thi': 'Xây dựng - Đô thị',
        'Giao-duc': 'Giáo dục',
        'Dau-tu': 'Đầu tư',
        'Lao-dong-Tien-luong': 'Lao động - Tiền lương',
        'Cong-nghe-thong-tin': 'Công nghệ thông tin',
        'Giao-thong-Van-tai': 'Giao thông - Vận tải',
        'Doanh-nghiep': 'Doanh nghiệp',
        'Thue-Phi-Le-Phi': 'Thuế - Phí - Lệ phí',
        'Bao-hiem': 'Bảo hiểm',
        'Tien-te-Ngan-hang': 'Tiền tệ - Ngân hàng',
        'Xuat-nhap-khau': 'Xuất nhập khẩu',
        'Quyen-dan-su': 'Quyền dân sự',
        'Vi-pham-hanh-chinh': 'Vi phạm hành chính',
        'Thu-tuc-To-tung': 'Thủ tục Tố tụng',
        'Trach-nhiem-hinh-su': 'Trách nhiệm hình sự',
        'Ke-toan-Kiem-toan': 'Kế toán - Kiểm toán',
        'Dich-vu-phap-ly': 'Dịch vụ pháp lý',
        'So-huu-tri-tue': 'Sở hữu trí tuệ',
        'Chung-khoan': 'Chứng khoán'
    };

    // Bóc tách slug từ URL: /van-ban/Linh-Vuc/...
    const match = url.match(/\/van-ban\/([^\/]+)\//);
    const slug = match ? match[1] : null;

    return categoryMap[slug] || 'Lĩnh vực khác';
};
module.exports = {
    processLegalCrawl,
    getCrawlStatus,
    getCategoryFromUrl
};