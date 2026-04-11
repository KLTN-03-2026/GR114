<<<<<<< HEAD
// AI_Engine/src/server.js
=======
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
<<<<<<< HEAD

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
=======
const fs = require('fs');
const multer = require('multer');

// 1. Load cấu hình
// Tôi ép PORT = 8000 ở đây để ông không bị dính lỗi cổng 3000 nữa
dotenv.config({ path: path.join(__dirname, '../.env') });
const PORT = 8000;

const app = express();

// 2. Cấu hình Multer (Cần thiết để nhận file PDF/Word từ AI Planning)
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: uploadDir });

// 3. Middleware
app.use(cors({
    origin: '*',
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

<<<<<<< HEAD
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
=======
// 4. Import Routes
const chatRoutes = require('./routes/chatRoutes');
const aiRoutes = require('./routes/aiRoutes');
const apiRoutes = require('./routes/apiRoutes');
const adminRoutes = require('./routes/adminRoutes');
app.post('/api/ai/generate-plan', upload.array('files'), async (req, res) => {
    try {
        const { prompt } = req.body;
        let context = "";

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const ext = path.extname(file.originalname).toLowerCase();
                if (ext === '.pdf') {
                    const data = await pdfParse(fs.readFileSync(file.path));
                    context += data.text + "\n";
                } else if (ext === '.docx') {
                    const result = await mammoth.extractRawText({ path: file.path });
                    context += result.value + "\n";
                }
                fs.unlinkSync(file.path); // Dọn dẹp file tạm
            }
        }

        const plan = await generatePlanWithGemini(prompt, context);
        res.json({ success: true, plan });
    } catch (error) {
        console.error("Lỗi Planning API:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// 5. Mount Routes
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

// 🟢 MỚI: Endpoint trực tiếp cho Planning 
const { generatePlanWithGemini } = require('./services/geminiService');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');



// 6. Test Route
app.get('/', (req, res) => {
    res.send('🤖 LegAI Engine is running on Port ' + PORT);
});

// 7. Start Server
const startServer = async () => {
    try {
        console.log("⏳ Đang khởi động AI Engine...");

        // Khởi động lắng nghe
        app.listen(PORT, () => {
            console.log(`\n========================================`);
            console.log(`🚀 LEGAI BACKEND STARTED AT: http://localhost:${PORT}`);
            console.log(`📡 Chế độ: Full Modular + Planning Integrated`);
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
            console.log(`========================================\n`);
        });
    } catch (error) {
        console.error("❌ Không thể khởi động Server:", error);
    }
};

<<<<<<< HEAD
startServer();

// ============================================================
// 1.5. ADMIN ROUTES - Đăng ký routes admin với prefix /api/admin
// ============================================================
app.use('/api/admin', adminRoutes);
=======
startServer();
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
