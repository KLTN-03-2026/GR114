const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
