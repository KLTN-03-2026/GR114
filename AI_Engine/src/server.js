const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');
const { poolConnect } = require('./config/db'); // BỔ SUNG: Import kết nối DB để chờ

// 1. Load cấu hình
dotenv.config({ path: path.join(__dirname, '../.env') });
const PORT = 8000;
const app = express();

// Tạo Server HTTP bọc Express để chạy được Socket.io
const server = http.createServer(app);

// Khởi tạo Socket.io với cấu hình CORS
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
global.io = io;

// 2. Cấu hình Multer (Cần thiết để nhận file PDF/Word từ AI Planning)
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: uploadDir });

// 3. Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Import Routes & Services
const chatRoutes = require('./routes/chatRoutes');
const aiRoutes = require('./routes/aiRoutes');
const apiRoutes = require('./routes/apiRoutes');
const adminRoutes = require('./routes/adminRoutes');
const settingRoutes = require('./routes/settingRoutes');
const { processLegalCrawl } = require('./services/crawlService');
const { getSystemSettings } = require('./controllers/adminController');


const { generatePlan } = require('./services/geminiService');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// API Endpoint trực tiếp cho Planning
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

        const plan = await generatePlan(prompt, context);
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
app.use('/api/admin/settings', settingRoutes); 

// 6. Test Route
app.get('/', (req, res) => {
    res.send(' LegAI Engine is running on Port ' + PORT);
});

// Khối logic (node-cron) canh giờ Auto Crawl
cron.schedule('* * * * *', async () => {
    const now = new Date();
    const currentHourMinute = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    console.log(` [Scheduler] Đang kiểm tra lịch cào lúc: ${currentHourMinute}`);

    try {
        const settings = await getSystemSettings();

        if (settings && settings.IsAutoCrawlOn) {
            if (settings.CrawlTime === currentHourMinute) {
                console.log(" [AUTO CRAWL]  Đang kích hoạt...");

                let urlList = [];
                try {
                    urlList = JSON.parse(settings.TargetUrls);
                } catch (e) {
                    urlList = settings.TargetUrls.split(/[\s,;]+/).map(u => u.trim()).filter(u => u !== '');
                }

                if (urlList.length > 0) {
                    processLegalCrawl(urlList, io);
                } else {
                    console.log(" Không có URL nào để cào!");
                }
            }
        }
    } catch (error) {
        console.error(" Lỗi :", error.message);
    }
});

// 7. Start Server 
const startServer = async () => {
    try {
        console.log(" Đang khởi động AI Engine...");

        
        await poolConnect;

        // Load SystemConfig từ DB một cách an toàn
        const SystemConfig = require('./config/SystemConfig');
        await SystemConfig.loadFromDB();

        server.listen(PORT, () => {
            console.log(`\n========================================`);
            console.log(` LEGAI BACKEND & SOCKET.IO STARTED AT: http://localhost:${PORT}`);
            console.log(`Chế độ: Full Modular + Real-time Socket.io + Auto Scheduler`);
            console.log(`========================================\n`);
        });
    } catch (error) {
        console.error(" Không thể khởi động Server:", error);
    }
};

startServer();