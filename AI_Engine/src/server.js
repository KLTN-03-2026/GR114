// AI_Engine/src/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// 1. Load cấu hình & Service
dotenv.config({ path: path.join(__dirname, '../.env') });
const ragService = require('./services/ragService'); // 👇 Quan trọng: Import RAG

const app = express();
const PORT = 8000; // Chạy port 8000 để né Laravel (8081)

// 2. Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Import Routes (Đã tách ra file riêng cho gọn)
const chatRoutes = require('./routes/chatRoutes');
const aiRoutes = require('./routes/aiRoutes');

// 4. Mount Routes
app.use('/api/chat', chatRoutes); // -> http://localhost:8000/api/chat/ask
app.use('/api/ai', aiRoutes);     // -> http://localhost:8000/api/ai/analyze-contract

// 5. Test Route
app.get('/', (req, res) => {
    res.send('🤖 LegAI Engine is Ready on Port 8000!');
});

// 6. Start Server & Khởi động AI
const startServer = async () => {
    try {
        console.log("⏳ Đang khởi động AI Engine...");

        // 👇 LOGIC CŨ CỦA BẠN Ở ĐÂY: Nạp dữ liệu luật vào RAM
        await ragService.createVectorStore(false);

        app.listen(PORT, () => {
            console.log(`\n========================================`);
            console.log(`🤖 AI SERVER STARTED AT: http://localhost:${PORT}`);
            console.log(`🔗 Chatbot API: http://localhost:${PORT}/api/chat/ask`);
            console.log(`🔗 Analyze API: http://localhost:${PORT}/api/ai/analyze-contract`);
            console.log(`========================================\n`);
        });
    } catch (error) {
        console.error("❌ Không thể khởi động Server:", error);
    }
};

startServer();