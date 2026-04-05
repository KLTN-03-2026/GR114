const { sql, pool, poolConnect } = require('../config/db');
const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Khởi tạo Gemini cho embedding
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

// Khởi tạo Pinecone client
const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});

const getSystemStats = async (req, res) => {
    try {
        // Đảm bảo kết nối database đã sẵn sàng
        await poolConnect;

        // 1. Thực hiện truy vấn SQL để lấy tổng số users
        const result = await pool.request().query('SELECT COUNT(*) as TotalUsers FROM dbo.Users');
        const totalUsers = result.recordset[0].TotalUsers;

        // 2. Đếm tổng số Hồ sơ pháp lý 
        const recordResult = await pool.request().query('SELECT COUNT(Id) as TotalRecords FROM dbo.ContractHistory');
        const realAiRecords = recordResult.recordset[0].TotalRecords;

        // 3. Lấy dung lượng Vector thực tế từ Pinecone
        let usedVectors = 0;
        const maxVectors = 100000; // Quota mặc định của gói Free
        try {

            const indexName = process.env.PINECONE_INDEX_NAME || 'legai-index';
            const index = pc.index(indexName);

            // Gọi hàm thống kê
            const stats = await index.describeIndexStats();
            usedVectors = stats.totalRecordCount || 0;
        } catch (pineconeError) {
            console.error('Lỗi khi lấy data từ Pinecone:', pineconeError);
            // Nếu lỗi mạng/key thì tạm để 0 chứ không cho crash sập toàn hệ thống
        }

        const vectorQuota = {
            used: usedVectors,
            total: maxVectors,
            // Tính phần trăm và làm tròn đến 1 chữ số thập phân
            percentage: Math.round((usedVectors / maxVectors) * 1000) / 10
        };

        res.json({
            success: true,
            data: {
                totalUsers: totalUsers,
                aiRecords: realAiRecords,
                vectorQuota: vectorQuota
            }
        });

    } catch (error) {
        console.error('Lỗi khi lấy thống kê hệ thống:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê hệ thống',
            error: error.message
        });
    }
};

// ============================================================
// HÀM CRAWL & SYNC LAW - API Pipeline 3 Bước
// ============================================================

const crawlAndSyncLaw = async (req, res) => {
    const crawlStartTime = Date.now();

    try {
        // ========== KIỂM TRA HỢP LỆ ==========
        const { url } = req.body;
        if (!url || !url.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Lỗi: Vui lòng cung cấp URL hợp lệ'
            });
        }

        console.log(`\n📡 [CRAWL START] URL: ${url}`);
        console.log(`👤 User: ${req.user.id} (${req.user.email})`);

        // Đảm bảo kết nối database đã sẵn sàng
        await poolConnect;

        // ========== GIAI ĐOẠN 1: BÓC TÁCH DỮ LIỆU (CRAWL) ==========
        console.log(`\n🔍 [GD1] Đang bóc tách text từ URL...`);

        // Kiểm tra CRAWLKIT_API_KEY
        const apiKey = process.env.CRAWLKIT_API_KEY ? process.env.CRAWLKIT_API_KEY.trim() : null;
        if (!apiKey) {
            throw new Error('Thiếu CRAWLKIT_API_KEY trong .env');
        }

        // Gọi API CrawlKit thực tế (giống hệt như module Video)
        const crawlResponse = await axios.post('https://api.crawlkit.org/v1/scrape',
            { url: url },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        const rawData = crawlResponse.data.data;
        const content = rawData.transcript || rawData.content || rawData.text;
        const title = rawData.title || `[LegAI Crawled] ${url.substring(0, 50)}...`;

        if (!content) {
            throw new Error('Không lấy được nội dung từ URL. CrawlKit có thể không hỗ trợ URL này.');
        }

        // Map dữ liệu vào object metadata
        const metadata = {
            title: title,
            url: url,
            content: content,
            source: 'CrawlKit',
            crawledAt: new Date().toISOString(),
            hash: `hash_${Math.random().toString(36).substr(2, 9)}`
        };

        console.log(`✅ [GD1] Bóc tách thành công. Title: "${metadata.title}"`);
        console.log(`📄 Độ dài nội dung: ${metadata.content.length} ký tự`);
        // ========== GIAI ĐOẠN 2: LƯU VÀO SQL SERVER (SSMS) ==========
        console.log(`\n💾 [GD2] Đang lưu metadata vào SQL Server...`);
        // TẠO ID CHUỖI NGẪU NHIÊN VÌ CỘT ID  LÀ NVARCHAR
        const documentId = `DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        //  cấu trúc bảng LegalDocuments 
        const insertQuery = `
            INSERT INTO dbo.LegalDocuments 
                (Id, Title, DocumentNumber, IssueYear, Status, Category, Content, CreatedAt)
            VALUES 
                (@id, @title, @documentNumber, @issueYear, @status, @category, @content, @createdAt);
        `;

        const request = pool.request();

        // Truyền thẳng cái ID vừa tạo vào câu query
        request.input('id', sql.NVarChar(100), documentId);

        request.input('title', sql.NVarChar(500), metadata.title);
        request.input('documentNumber', sql.VarChar(50), `CRAWL-${Date.now().toString().slice(-6)}`);
        request.input('issueYear', sql.Int, new Date().getFullYear());
        request.input('status', sql.NVarChar(50), 'Đang có hiệu lực');
        request.input('category', sql.NVarChar(100), 'Dữ liệu Thu thập tự động (Crawl)');
        request.input('content', sql.NVarChar(sql.MAX), `${metadata.content}\n\n[Nguồn bóc tách: ${metadata.url}]`);
        request.input('createdAt', sql.DateTime2, new Date());

        // Thực thi lệnh Insert 
        await request.query(insertQuery);

        console.log(`✅ [GD2] Lưu thành công. Document ID: ${documentId}`);
        const gd2Time = Date.now() - crawlStartTime - gd1Time;
        console.log(`⏱️  Giai đoạn 2 mất: ${gd2Time}ms`);


        // ========== GIAI ĐOẠN 3: NHÚNG VECTOR VÀO PINECONE ==========
        console.log(`\n🧠 [GD3] Đang nhúng vector vào Pinecone...`);

        // Tạo embedding thực tế từ Gemini API (3072 chiều)
        const embedResult = await embedModel.embedContent(metadata.content);
        const embedding = Array.from(embedResult.embedding.values);

        const indexName = process.env.PINECONE_INDEX_NAME || 'legai-index';
        const index = pc.index(indexName);

        // Upsert vector vào Pinecone
        const vectorId = `doc_${documentId}_${Date.now()}`;
        const vectors = [
            {
                id: vectorId,
                values: embedding,
                metadata: {
                    title: metadata.title,
                    url: metadata.url,
                    documentId: documentId,
                    source: metadata.source,
                    crawledAt: metadata.crawledAt
                }
            }
        ];

        await index.upsert(vectors);
        console.log(`✅ [GD3] Upsert thành công. Vector ID: ${vectorId}`);
        const gd3Time = Date.now() - crawlStartTime - gd1Time - gd2Time;
        console.log(`⏱️  Giai đoạn 3 mất: ${gd3Time}ms`);

        // ========== PHẢN HỒI THÀNH CÔNG ==========
        const totalTime = Date.now() - crawlStartTime;
        console.log(`\n🎉 [CRAWL SUCCESS] Tổng thời gian: ${totalTime}ms`);

        res.json({
            success: true,
            message: 'Thu thập & Đồng bộ thành công!',
            data: {
                documentId: documentId,
                vectorId: vectorId,
                url: metadata.url,
                title: metadata.title,
                processingTime: {
                    crawl: gd1Time,
                    sqlStorage: gd2Time,
                    pineconeSync: gd3Time,
                    total: totalTime
                }
            }
        });

    } catch (error) {
        console.error('❌ [CRAWL ERROR]', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi thu thập & đồng bộ',
            error: error.message
        });
    }
};
// ============================================================
// MODULE 3: LẤY DANH SÁCH NGƯỜI DÙNG (ADMIN)
// ============================================================
const getAllUsers = async (req, res) => {
    try {
        await poolConnect;
        // Lấy danh sách user mới nhất, tuyệt đối KHÔNG lấy Password
        const query = `
            SELECT TOP (50) Id, FullName, Email, Role, CreatedAt
            FROM dbo.Users 
            ORDER BY CreatedAt DESC
        `;
        const result = await pool.request().query(query);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('❌ Lỗi lấy danh sách User:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy dữ liệu người dùng' });
    }
};
module.exports = {
    getSystemStats,
    crawlAndSyncLaw,
    getAllUsers
};