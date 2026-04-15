// AI_Engine/src/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// 1. Load cấu hình & Service
dotenv.config({ path: path.join(__dirname, '../.env') });
const ragService = require('./services/ragService'); // 🟢 GIỮ LẠI: Service AI
const nodemailer = require('nodemailer');

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
const chatRoutes = require('./routes/chatRoutes'); // Cũ
const aiRoutes = require('./routes/aiRoutes');     // Cũ
const apiRoutes = require('./routes/apiRoutes');   // MỚI: Route cho Auth & History

// 4. Mount Routes
app.use('/api/chat', chatRoutes); // -> Chatbot
app.use('/api/ai', aiRoutes);     // -> Phân tích HĐ
app.use('/api', apiRoutes);       // MỚI: /api/auth/login, /api/history...

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
// Support email endpoint (confirmation email)
// POST /api/support { name, email, phone, subject, message }
// ============================================================
app.post('/api/support', async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body || {};
        if (!name || !email || !phone || !subject || !message) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin.' });
        }

        let transporter;
        let previewUrl = null;

        if (process.env.SMTP_HOST) {
            transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
            });
        } else {
            const testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: { user: testAccount.user, pass: testAccount.pass }
            });
        }

        const mailOptions = {
            from: process.env.SMTP_FROM || `"LegalAI Support" <no-reply@legalai.local>`,
            to: email,
            subject: `Xác nhận: Yêu cầu hỗ trợ đã được nhận`,
            text: `Xin chào ${name},\n\nChúng tôi đã nhận được yêu cầu hỗ trợ của bạn.\n\nChủ đề: ${subject}\nSố điện thoại: ${phone}\nNội dung: ${message}\n\nChúng tôi sẽ liên hệ lại sớm.\n\nTrân trọng,\nLegalAI`,
            html: `<p>Xin chào <b>${name}</b>,</p><p>Chúng tôi đã nhận được yêu cầu hỗ trợ của bạn với thông tin sau:</p><ul><li><b>Chủ đề:</b> ${subject}</li><li><b>Số điện thoại:</b> ${phone}</li><li><b>Nội dung:</b> ${message}</li></ul><p>Đội ngũ LegalAI sẽ liên hệ với bạn sớm. Vui lòng kiểm tra hộp thư đến và số điện thoại của bạn.</p><p>Trân trọng,<br/>LegalAI</p>`
        };

        const info = await transporter.sendMail(mailOptions);
        if (nodemailer.getTestMessageUrl) previewUrl = nodemailer.getTestMessageUrl(info) || null;

        // send admin copy (best-effort)
        try {
            await transporter.sendMail({
                from: process.env.SMTP_FROM || `"LegalAI Support" <no-reply@legalai.local>`,
                to: process.env.ADMIN_SUPPORT_EMAIL || 'support@legalai.vn',
                subject: `Yêu cầu hỗ trợ mới từ ${name} <${email}>`,
                text: `Yêu cầu mới:\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nSubject: ${subject}\nMessage: ${message}`
            });
        } catch (err) {
            console.warn('Could not send admin copy:', err && err.message ? err.message : err);
        }

        return res.json({ success: true, message: 'Email sent', to: email, previewUrl });
    } catch (err) {
        console.error('Support email error:', err);
        return res.status(500).json({ success: false, message: 'Lỗi khi gửi email: ' + (err.message || err) });
    }
});