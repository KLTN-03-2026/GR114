// AI_Engine/src/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// 1. Load cấu hình & Service
dotenv.config({ path: path.join(__dirname, '../.env') });
const ragService = require('./services/ragService'); // Service AI

const app = express();
const PORT = process.env.PORT || 8000;

// 2. Middleware
// Cấu hình CORS chi tiết (tốt cho Frontend Vite port 5173)
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Import Routes
const chatRoutes = require('./routes/chatRoutes'); 
const aiRoutes = require('./routes/aiRoutes');     
const apiRoutes = require('./routes/apiRoutes');   //  Route cho Auth & History
const adminRoutes = require('./routes/adminRoutes'); // Route cho Admin

// 4. Mount Routes
app.use('/api/chat', chatRoutes); // -> Chatbot
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

// ============================================================
// 1.5. ADMIN ROUTES - Đăng ký routes admin với prefix /api/admin
// ============================================================
app.use('/api/admin', adminRoutes);