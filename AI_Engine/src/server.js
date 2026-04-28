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
            await pool.request().query(`
              IF COL_LENGTH('dbo.ContractHistory', 'DeletedAt') IS NULL
                ALTER TABLE dbo.ContractHistory ADD DeletedAt datetime2(7) NULL;

              IF COL_LENGTH('dbo.ContractHistory', 'UpdatedAt') IS NULL
                ALTER TABLE dbo.ContractHistory ADD UpdatedAt datetime2(7) NULL;
            `);

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
