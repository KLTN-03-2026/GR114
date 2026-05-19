// AI_Engine/src/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { pool, poolConnect, isDbReady } = require('./config/db');

// 1. Load cấu hình & Service
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 8000;

const ensureSqlSchema = async () => {
    const request = pool.request();
    await request.query(`
        IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.Users (
                Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                Email NVARCHAR(320) NOT NULL,
                Password NVARCHAR(MAX) NOT NULL,
                FullName NVARCHAR(200) NULL,
                Role NVARCHAR(20) NOT NULL CONSTRAINT DF_Users_Role DEFAULT ('USER'),
                CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME())
            );

            CREATE UNIQUE INDEX UX_Users_Email ON dbo.Users(Email);
        END;

        IF OBJECT_ID(N'dbo.ContractHistory', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ContractHistory (
                Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                UserId BIGINT NOT NULL,
                FileName NVARCHAR(260) NOT NULL,
                OriginalFileName NVARCHAR(260) NULL,
                UploadedAt DATETIME2(7) NULL,
                AnalysisAt DATETIME2(7) NOT NULL,
                RiskScore INT NULL,
                AnalysisJson NVARCHAR(MAX) NULL,
                ContractText NVARCHAR(MAX) NULL,
                IsFinal BIT NOT NULL CONSTRAINT DF_ContractHistory_IsFinal DEFAULT (1),
                CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_ContractHistory_CreatedAt DEFAULT (SYSUTCDATETIME()),
                UpdatedAt DATETIME2(7) NULL,
                DeletedAt DATETIME2(7) NULL
            );

            CREATE INDEX IX_ContractHistory_UserId_CreatedAt ON dbo.ContractHistory(UserId, CreatedAt DESC);
        END;

        IF OBJECT_ID(N'dbo.LegalDocuments', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.LegalDocuments (
                Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                Title NVARCHAR(400) NOT NULL,
                SubTitle NVARCHAR(400) NULL,
                DocumentNumber NVARCHAR(100) NULL,
                DocumentType NVARCHAR(100) NULL,
                Agency NVARCHAR(200) NULL,
                IssueDate DATE NULL,
                Description NVARCHAR(MAX) NULL,
                Content NVARCHAR(MAX) NULL,
                CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_LegalDocuments_CreatedAt DEFAULT (SYSUTCDATETIME())
            );
        END;

        IF COL_LENGTH('dbo.ContractHistory', 'DeletedAt') IS NULL
            ALTER TABLE dbo.ContractHistory ADD DeletedAt datetime2(7) NULL;

        IF COL_LENGTH('dbo.ContractHistory', 'UpdatedAt') IS NULL
            ALTER TABLE dbo.ContractHistory ADD UpdatedAt datetime2(7) NULL;

        IF COL_LENGTH('dbo.ContractHistory', 'ContractText') IS NULL AND COL_LENGTH('dbo.ContractHistory', 'AnalysisText') IS NULL
            ALTER TABLE dbo.ContractHistory ADD ContractText NVARCHAR(MAX) NULL;

        IF COL_LENGTH('dbo.ContractHistory', 'OriginalFileName') IS NULL
            ALTER TABLE dbo.ContractHistory ADD OriginalFileName NVARCHAR(260) NULL;

        IF COL_LENGTH('dbo.ContractHistory', 'UploadedAt') IS NULL
            ALTER TABLE dbo.ContractHistory ADD UploadedAt DATETIME2(7) NULL;

        IF COL_LENGTH('dbo.ContractHistory', 'IsFinal') IS NULL
            ALTER TABLE dbo.ContractHistory ADD IsFinal BIT NOT NULL CONSTRAINT DF_ContractHistory_IsFinal_Added DEFAULT (1);
    `);

    const seedReq = pool.request();
    const seedResult = await seedReq.query(`SELECT COUNT(1) AS Cnt FROM dbo.LegalDocuments`);
    const cnt = Number(seedResult?.recordset?.[0]?.Cnt ?? 0) || 0;
    if (cnt === 0) {
        const ins = pool.request();
        await ins.query(`
            INSERT INTO dbo.LegalDocuments (Title, SubTitle, DocumentNumber, DocumentType, Agency, IssueDate, Description, Content)
            VALUES
              (N'Bộ luật Dân sự 2015', N'BỘ LUẬT', N'91/2015/QH13', N'Bộ luật', N'Quốc hội', '2015-11-24', N'Văn bản mẫu khởi tạo để module tra cứu hoạt động khi chưa có dữ liệu.', N'Nội dung mẫu.'),
              (N'Luật Thương mại 2005', N'LUẬT', N'36/2005/QH11', N'Luật', N'Quốc hội', '2005-06-14', N'Dữ liệu mẫu dự phòng cho module văn bản pháp luật.', N'Nội dung mẫu.');
        `);
    }
};

// 2. Middleware
// Cấu hình CORS chi tiết (tốt cho Frontend Vite port 5173)
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        try {
            const u = new URL(origin);
            const isLocalhost = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
            const isHttp = u.protocol === 'http:' || u.protocol === 'https:';
            if (isLocalhost && isHttp) return callback(null, true);
        } catch {
        }
        return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 3. Import Routes
const aiRoutes = require('./routes/aiRoutes');     // Cũ
const apiRoutes = require('./routes/apiRoutes');   // 🟢 MỚI: Route cho Auth & History
let chatRoutes = null;

try {
    chatRoutes = require('./routes/chatRoutes');
} catch (error) {
    console.warn('⚠️ Chat routes disabled:', error.message);
}

// 4. Mount Routes
if (chatRoutes) {
    app.use('/api/chat', chatRoutes);
}
app.use('/api/ai', aiRoutes);     // -> Phân tích HĐ
app.use('/api', apiRoutes);       // 🟢 MỚI: -> /api/auth/login, /api/history...

// 5. Test Route
app.get('/', (req, res) => {
    res.send('🤖 LegAI Engine (Full Backend) is Ready on Port ' + PORT);
});

// 6. Start Server & Khởi động AI
const startServer = async () => {
    try {
        console.log("⏳ Đang khởi động AI Engine & Kết nối SQL...");

        console.log("☁️  Hệ thống đã sẵn sàng kết nối Pinecone Cloud.");

        await poolConnect;
        if (isDbReady()) {
            await ensureSqlSchema();

            const purgeOldDeleted = async () => {
              try {
                await pool.request().query(`
                  IF COL_LENGTH('dbo.ContractHistory', 'DeletedAt') IS NOT NULL
                    DELETE FROM dbo.ContractHistory
                    WHERE DeletedAt IS NOT NULL
                      AND DeletedAt < DATEADD(day, -30, SYSUTCDATETIME());
                `);
              } catch (e) {
                console.error('❌ Purge old deleted records error:', e);
              }
            };

            purgeOldDeleted();
            setInterval(purgeOldDeleted, 6 * 60 * 60 * 1000);
        } else {
            console.warn('⚠️ SQL chưa sẵn sàng, chuyển sang chế độ lưu tạm trong bộ nhớ.');
        }

        app.listen(PORT, () => {
            console.log(`\n========================================`);
            console.log(`🚀 FULL BACKEND STARTED AT: http://localhost:${PORT}`);
            console.log(`🔗 Chatbot API: http://localhost:${PORT}/api/chat/ask`);
            console.log(`🔗 Analyze API: http://localhost:${PORT}/api/ai/analyze-contract`);
            console.log(`🔗 Auth/DB API: http://localhost:${PORT}/api/auth/login`);
            console.log(`========================================\n`);
        });
    } catch (error) {
        console.error("❌ Không thể khởi động Server:", error);
    }
};

startServer();
