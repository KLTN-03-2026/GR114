const { sql, pool, poolConnect } = require('../config/db');
const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const bcrypt = require('bcryptjs');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// Khởi tạo Gemini cho embedding
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
const geminiService = require('../services/geminiService');
const crawlService = require('../services/crawlService');
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
// HÀM LẤY CẤU HÌNH HỆ THỐNG
// ============================================================

const getSystemSettings = async () => {
    try {
        // LẤY CẢ pool VÀ poolConnect ra (giống hệt crawlService.js)
        const { pool, poolConnect } = require('../config/db');

        // Chờ kết nối mở xong
        await poolConnect;

        // Dùng biến pool đã lấy ở trên để query
        const result = await pool.request().query(`SELECT TOP 1 * FROM dbo.SystemSettings ORDER BY UpdatedAt DESC`);

        return result.recordset[0];
    } catch (error) {
        console.error("Lỗi SQL khi lấy Settings:", error.message);
        return null;
    }
};

// ============================================================
// HÀM LẤY CẤU HÌNH CRAWLER
// ============================================================



const getCrawlerSettings = async (req, res) => {
    try {
        await poolConnect;

        const result = await pool.request().query('SELECT * FROM SystemSettings WHERE Id = 1');

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy cấu hình hệ thống'
            });
        }

        const settings = result.recordset[0];


        res.json({
            success: true,
            data: settings
        });

    } catch (error) {
        console.error('Lỗi khi lấy cấu hình crawler:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy cấu hình crawler',
            error: error.message
        });
    }
};

// ============================================================
// HÀM CẬP NHẬT CẤU HÌNH CRAWLER
// ============================================================

const updateCrawlerSettings = async (req, res) => {
    try {
        const { isAutoCrawlOn, crawlTime, targetUrls, dailyLimit, filterPatterns } = req.body;

        await poolConnect;

        const request = pool.request();
        request.input('isAutoCrawlOn', sql.Bit, isAutoCrawlOn);
        request.input('crawlTime', sql.VarChar, crawlTime);
        request.input('targetUrls', sql.NVarChar(sql.MAX), targetUrls);
        request.input('dailyLimit', sql.Int, dailyLimit);
        request.input('filterPatterns', sql.NVarChar(500), filterPatterns);

        const updateQuery = `
            UPDATE SystemSettings 
            SET isAutoCrawlOn = @isAutoCrawlOn, 
                crawlTime = @crawlTime, 
                targetUrls = @targetUrls, 
                dailyLimit = @dailyLimit, 
                filterPatterns = @filterPatterns 
            WHERE Id = 1
        `;

        await request.query(updateQuery);

        res.json({
            success: true,
            message: 'Cập nhật cấu hình crawler thành công'
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật cấu hình crawler:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật cấu hình crawler',
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
        console.error(' [CRAWL ERROR]', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi thu thập & đồng bộ',
            error: error.message
        });
    }
};



const getRecentHistory = async (req, res) => {
    try {
        await poolConnect;

        const result = await pool.request().query(`
            SELECT TOP (10) Id, Title, DocumentNumber, Category, SourceUrl, Status, CreatedAt
            FROM dbo.LegalDocuments
            ORDER BY CreatedAt DESC
        `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('❌ [GET HISTORY ERROR]', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy lịch sử thu thập',
            error: error.message
        });
    }
};
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
const runManualCrawl = async (req, res) => {
    try {
        const { urls } = req.body;

        if (!Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp danh sách URLs' });
        }

        if (urls.length > 5) {
            return res.status(400).json({ success: false, message: 'Chỉ được thu thập tối đa 5 URLs mỗi lần' });
        }

        const result = await crawlService.processLegalCrawl(urls, null);

        res.json({ success: true, ...result });

    } catch (error) {
        console.error('❌ [CRITICAL ERROR]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
// ============================================================
// MODULE 3: LẤY DANH SÁCH NGƯỜI DÙNG (ADMIN)
// ============================================================
const getAllUsers = async (req, res) => {
    try {
        await poolConnect;
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
        const offset = (page - 1) * limit;

        const countRequest = pool.request();
        const countSql = `SELECT COUNT(*) as total FROM dbo.Users`;
        const countResult = await countRequest.query(countSql);
        const totalUsers = countResult.recordset[0]?.total || 0;

        const dataRequest = pool.request();
        dataRequest.input('Offset', sql.Int, offset);
        dataRequest.input('Limit', sql.Int, limit);
        const query = `
            SELECT Id, FullName, Email, Role, Status, CreatedAt
            FROM dbo.Users
            ORDER BY CreatedAt DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `;
        const result = await dataRequest.query(query);

        res.json({
            success: true,
            data: result.recordset,
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit),
            totalUsers
        });
    } catch (error) {
        console.error('❌ Lỗi lấy danh sách User:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy dữ liệu người dùng' });
    }
};

const toggleUserBan = async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (!userId) return res.status(400).json({ success: false, message: 'User id required' });

        await poolConnect;
        const request = pool.request();
        request.input('Id', sql.Int, userId);

        const updateSql = `
            UPDATE dbo.Users
            SET Status = CASE WHEN Status = 'Banned' THEN 'Active' ELSE 'Banned' END
            WHERE Id = @Id;
            SELECT Id, FullName, Email, Role, Status, CreatedAt
            FROM dbo.Users
            WHERE Id = @Id;
        `;

        const result = await request.query(updateSql);
        const updatedUser = result.recordset?.[0];
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error('❌ Lỗi khóa/mở khóa User:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái người dùng' });
    }
};

const createUser = async (req, res) => {
    try {
        const { fullName, email, password, role } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin' });
        }

        // Kiểm tra email đã tồn tại
        await poolConnect;
        const checkRequest = pool.request();
        checkRequest.input('Email', sql.NVarChar(255), email);
        const checkResult = await checkRequest.query('SELECT Id FROM dbo.Users WHERE Email = @Email');

        if (checkResult.recordset.length > 0) {
            return res.status(400).json({ success: false, message: 'Email đã tồn tại' });
        }

        // Mã hóa mật khẩu
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Thêm user mới
        const insertRequest = pool.request();
        insertRequest.input('FullName', sql.NVarChar(255), fullName);
        insertRequest.input('Email', sql.NVarChar(255), email);
        insertRequest.input('Password', sql.NVarChar(255), hashedPassword);
        insertRequest.input('Role', sql.NVarChar(50), role || 'USER');
        insertRequest.input('Status', sql.NVarChar(50), 'Active');
        insertRequest.input('CreatedAt', sql.DateTime, new Date());

        const insertSql = `
            INSERT INTO dbo.Users (FullName, Email, Password, Role, Status, CreatedAt)
            VALUES (@FullName, @Email, @Password, @Role, @Status, @CreatedAt);
            SELECT SCOPE_IDENTITY() AS Id;
        `;

        const insertResult = await insertRequest.query(insertSql);
        const newUserId = insertResult.recordset[0].Id;

        res.json({ success: true, message: 'Thêm người dùng thành công', userId: newUserId });
    } catch (error) {
        console.error('❌ Lỗi tạo user:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi tạo người dùng' });
    }
};
const getAiHistory = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 50);
        const offset = (page - 1) * limit;

        await poolConnect;

        // Đếm tổng số records từ cả 2 bảng
        const countRequest = pool.request();
        const countSql = `
            SELECT COUNT(*) AS total FROM (
                SELECT Id FROM dbo.VideoHistory
                UNION ALL
                SELECT Id FROM dbo.ContractHistory
            ) AS CombinedHistory
        `;
        const countResult = await countRequest.query(countSql);
        const totalItems = countResult.recordset[0]?.total || 0;

        const historyRequest = pool.request();
        historyRequest.input('Offset', sql.Int, offset);
        historyRequest.input('Limit', sql.Int, limit);

        // Đã sử dụng v.Status và c.Status. Chỉnh lại FeatureName cho đẹp trên UI
        const query = `
            SELECT Id, FullName, Email, FeatureName, Outcome, EventTime FROM (
                SELECT v.Id, u.FullName, u.Email, N'VIDEO_ANALYSIS' as FeatureName, v.Status as Outcome, v.CreatedAt as EventTime 
                FROM [dbo].[VideoHistory] v LEFT JOIN [dbo].[Users] u ON v.UserId = u.Id
                UNION ALL
                SELECT c.Id, u.FullName, u.Email, N'CONTRACT_REVIEW' as FeatureName, c.Status as Outcome, c.CreatedAt as EventTime 
                FROM [dbo].[ContractHistory] c LEFT JOIN [dbo].[Users] u ON c.UserId = u.Id
            ) AS CombinedHistory
            ORDER BY EventTime DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `;
        const result = await historyRequest.query(query);

        res.json({
            success: true,
            data: result.recordset,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            totalItems
        });
    } catch (error) {
        console.error(' Lỗi lấy Lịch sử Phân tích AI:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch sử phân tích AI' });
    }
};
// Hàm lấy tính năng được sử dụng nhiều nhất (Dựa trên bảng AIFeatureUsage)
const getFeatureUsage = async (req, res) => {
    try {
        const timeframe = String(req.query.timeframe || req.query.filter || 'week').toLowerCase();
        
        let whereClause = `WHERE CreatedAt >= DATEADD(WEEK, -1, GETDATE()) AND FeatureName != 'CRAWL_DATA'`;

        if (timeframe === 'month') {
            whereClause = `WHERE CreatedAt >= DATEADD(MONTH, -1, GETDATE()) AND FeatureName != 'CRAWL_DATA'`;
        } else if (timeframe === 'year') {
            whereClause = `WHERE CreatedAt >= DATEADD(YEAR, -1, GETDATE()) AND FeatureName != 'CRAWL_DATA'`;
        } else if (timeframe === 'all') {
            whereClause = `WHERE FeatureName != 'CRAWL_DATA'`;
        }

        await poolConnect;
        const request = pool.request();
        const query = `
            SELECT TOP (10)
                FeatureName,
                SUM(UsageCount) AS UsageCount  
            FROM [LegalBotDB].[dbo].[AIFeatureUsage]
            ${whereClause}
            GROUP BY FeatureName
            ORDER BY UsageCount DESC
        `;
        
        const result = await request.query(query);

        res.json({ success: true, data: result.recordset || [], timeframe });
    } catch (error) {
        console.error(' Lỗi lấy Tính năng Sử dụng Nhiều nhất:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};
const getCrawlerStatus = async (req, res) => {
    try {
        const status = crawlService.getCrawlStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('❌ [GET CRAWLER STATUS ERROR]', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy trạng thái crawler',
            error: error.message
        });
    }
};

module.exports = {
    getSystemStats,
    getSystemSettings,
    crawlAndSyncLaw,
    runManualCrawl,
    getRecentHistory,
    getCrawlerSettings,
    updateCrawlerSettings,
    getAllUsers,
    createUser,
    toggleUserBan,
    getAiHistory,
    getFeatureUsage,
    getCrawlerStatus
};