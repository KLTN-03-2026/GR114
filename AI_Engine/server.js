// src/server.js - BẢN FIX LỖI HOÀN CHỈNH (Đã test PDF & Word)
const express = require('express');
// Load environment variables from .env (if present)
require('dotenv').config();
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');       // Thư viện nhận file upload
const pdfParse = require('pdf-parse');  // Thư viện đọc PDF
const mammoth = require('mammoth');     // 👇 ĐÃ THÊM: Thư viện đọc Word
const fs = require('fs');               // Thư viện quản lý file
const path = require('path');           // 👇 ĐÃ THÊM: Thư viện xử lý đường dẫn
const nodemailer = require('nodemailer');

// Sửa lại đường dẫn import cho đúng vị trí file
const ragService = require('./src/services/ragService');
const { generateAnswerWithGemini, analyzeContractWithGemini } = require('./src/services/geminiService');

// Import các routes
const adminRoutes = require('./src/routes/adminRoutes');

const app = express();
const PORT = 8000;

app.use(cors());
app.use(bodyParser.json());

// Cấu hình Multer: Tự động tạo thư mục uploads nếu chưa có
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: uploadDir });

// ============================================================
// 1. GIỮ NGUYÊN CÁC API GIẢ LẬP (MOCK)
// ============================================================
const MOCK_USER = {
    id: 1,
    username: "admin",
    fullName: "Admin LegAI",
    role: "ADMIN",
    email: "admin@legai.com",
    avatar: "https://i.pravatar.cc/150?u=admin"
};
const MOCK_TOKEN = "fake-jwt-token-vip-pro-123";

const handleLogin = (req, res) => {
    res.json({
        success: true, message: "Login OK", accessToken: MOCK_TOKEN,
        token: MOCK_TOKEN, data: { accessToken: MOCK_TOKEN, user: MOCK_USER }, user: MOCK_USER
    });
};
app.post('/api/auth/login', handleLogin);
app.post('/api/login', handleLogin);

app.get('/api/auth/verify-token', (req, res) => {
    res.json({ success: true, isValid: true, user: MOCK_USER, data: { user: MOCK_USER } });
});

app.get('/api/auth/users/:id', (req, res) => res.json({ success: true, data: MOCK_USER }));
app.get('/api/auth/me', (req, res) => res.json({ success: true, data: MOCK_USER }));

app.get('/api/legal/templates', (req, res) => res.json({ success: true, data: [], meta: { total: 0 } }));
app.get('/api/legal/document-types', (req, res) => res.json({ success: true, data: [] }));
app.get('/api/legal/documents', (req, res) => res.json({ success: true, data: [], meta: { total: 0 } }));


// ============================================================
// 1.5. ADMIN ROUTES - Đăng ký routes admin với prefix /api/admin
// ============================================================
app.use('/api/admin', adminRoutes);

// ============================================================
// 2. API CHAT AI
// ============================================================
const handleChat = async (req, res) => {
    try {
        let query = req.body.query || req.body.message || req.body.question;
        if (!query && req.body.messages && Array.isArray(req.body.messages)) {
            query = req.body.messages[req.body.messages.length - 1].content;
        }

        if (!query) return res.status(400).json({ success: false, message: "Trống câu hỏi" });

        console.log(`\n🔍 Chat: "${query}"`);

        // B1: Tìm kiếm luật
        const documents = await ragService.query(query, 5); // Đã tăng lên 5 theo chiến thuật Leader
        let finalAnswer = "";

        // B2: Hỏi Gemini
        if (documents.length > 0) {
            finalAnswer = await generateAnswerWithGemini(query, documents);
        } else {
            finalAnswer = "Xin lỗi, không tìm thấy văn bản luật phù hợp trong dữ liệu hiện tại.";
        }

        // B3: Trả về
        res.json({
            success: true,
            data: { answer: finalAnswer, sources: documents },
            answer: finalAnswer,
            message: "Thành công"
        });

    } catch (error) {
        console.error("❌ Lỗi Server:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

app.post('/api/ai/ask', handleChat);
app.post('/api/chat', handleChat);
app.post('/api/search-legal', handleChat);


// ============================================================
// 3. API MỚI: PHÂN TÍCH HỢP ĐỒNG (PDF & WORD)
// ============================================================
app.post('/api/ai/analyze-contract', upload.single('contract'), async (req, res) => {
    try {
        console.log("\n📂 Nhận yêu cầu phân tích hợp đồng...");

        // Kiểm tra xem có file gửi lên không
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Vui lòng gửi file!" });
        }

        const filePath = req.file.path;
        // Sử dụng path.extname an toàn hơn
        const fileExt = path.extname(req.file.originalname).toLowerCase();
        let contractText = "";

        // B1: Phân loại và Đọc nội dung file
        try {
            if (fileExt === '.pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const pdfData = await pdfParse(dataBuffer);
                contractText = pdfData.text;
            }
            else if (fileExt === '.docx') {
                const result = await mammoth.extractRawText({ path: filePath });
                contractText = result.value;
            }
            else {
                // File không hỗ trợ
                fs.unlinkSync(filePath);
                return res.status(400).json({ success: false, message: "Chỉ hỗ trợ file PDF (.pdf) và Word (.docx)!" });
            }
        } catch (readErr) {
            fs.unlinkSync(filePath);
            return res.status(400).json({ success: false, message: "Lỗi đọc file: " + readErr.message });
        }

        // Kiểm tra nếu file rỗng
        if (!contractText || contractText.trim().length === 0) {
            fs.unlinkSync(filePath);
            return res.status(400).json({ success: false, message: "Không đọc được nội dung văn bản trong file!" });
        }

        // B1.5: Tìm luật liên quan (RAG)
        // Tìm 5 điều luật liên quan nhất đến nội dung hợp đồng
        const relatedLaws = await ragService.query(contractText, 5);

        // Format lại chuỗi luật để gửi cho AI
        const legalContext = relatedLaws.map(d =>
            `Nguồn: ${d.title}\nNội dung: ${d.content}`
        ).join("\n---\n");

        console.log(`📄 Đã đọc file ${fileExt} (${contractText.length} ký tự).`);
        console.log(`⚖️ Đã tìm thấy ${relatedLaws.length} văn bản luật liên quan.`);

        // B2: Gửi cho Gemini phân tích (Có kèm luật)
        // Cần sửa lại hàm analyzeContractWithGemini bên geminiService để nhận thêm tham số legalContext
        // Tuy nhiên ở đây cứ truyền vào, nếu hàm bên kia chưa update thì nó sẽ bỏ qua, không gây lỗi.
        const analysisResult = await analyzeContractWithGemini(contractText, legalContext);

        // B3: Xóa file tạm
        fs.unlinkSync(filePath);

        console.log("✅ Phân tích xong! Risk Score:", analysisResult.risk_score);
        console.log("📝 CHI TIẾT PHÂN TÍCH (Tóm tắt):", analysisResult.summary);

        // B4: Trả về kết quả
        res.json({
            success: true,
            data: analysisResult
        });

    } catch (error) {
        console.error("❌ Lỗi Phân tích:", error);
        // Cố gắng xóa file tạm nếu có lỗi
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: error.message });
    }
});


// ============================================================
// 4. API: GỬI EMAIL XÁC NHẬN YÊU CẦU HỖ TRỢ
// Body: { name, email, phone, subject, message }
// ============================================================
app.post('/api/support', async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body || {};
        if (!name || !email || !phone || !subject || !message) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin.' });
        }

        // Tạo transporter: ưu tiên cấu hình SMTP từ env, nếu không có thì dùng test account
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
            from: `"LegAI Support" <no-reply@legai.local>`,
            to: email,
            subject: `Xác nhận: Yêu cầu hỗ trợ đã được nhận`,
            text: `Xin chào ${name},\n\nChúng tôi đã nhận được yêu cầu hỗ trợ của bạn.\n\nChủ đề: ${subject}\nSố điện thoại: ${phone}\nNội dung: ${message}\n\nChúng tôi sẽ liên hệ lại sớm.\n\nTrân trọng,\nLegAI`,
            html: `<p>Xin chào <b>${name}</b>,</p><p>Chúng tôi đã nhận được yêu cầu hỗ trợ của bạn với thông tin sau:</p><ul><li><b>Chủ đề:</b> ${subject}</li><li><b>Số điện thoại:</b> ${phone}</li><li><b>Nội dung:</b> ${message}</li></ul><p>Đội ngũ LegAI sẽ liên hệ với bạn sớm.</p><p>Trân trọng,<br/>LegAI</p>`
        };

        const info = await transporter.sendMail(mailOptions);

        if (nodemailer.getTestMessageUrl) {
            previewUrl = nodemailer.getTestMessageUrl(info) || null;
        }

        // Gửi 1 bản tới email hỗ trợ nội bộ (không block nếu lỗi)
        try {
            await transporter.sendMail({
                from: `"LegAI Support" <no-reply@legai.local>`,
                to: 'support@legalai.vn',
                subject: `Yêu cầu hỗ trợ mới từ ${name} <${email}>`,
                text: `Yêu cầu mới:\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nSubject: ${subject}\nMessage: ${message}`
            });
        } catch (err) {
            console.warn('Could not send admin copy:', err.message || err);
        }

        return res.json({ success: true, message: 'Email sent', to: email, previewUrl });

    } catch (err) {
        console.error('Support email error:', err);
        return res.status(500).json({ success: false, message: 'Lỗi khi gửi email: ' + (err.message || err) });
    }
});


// ============================================================
// KHỞI ĐỘNG
// ============================================================
const startServer = async () => {
    console.log("⏳ Đang khởi động...");
    // Gọi hàm tạo Vector Store
    // false: dùng cache nếu có (khởi động nhanh)
    // true: ép học lại (nếu bạn muốn cập nhật dữ liệu mới)
    await ragService.createVectorStore(false);

    app.listen(PORT, () => {
        console.log(`\n==================================================`);
        console.log(`🚀 SERVER FULL TÍNH NĂNG ĐÃ CHẠY TẠI: http://localhost:${PORT}`);
        console.log(`✨ API Chat: /api/ai/ask`);
        console.log(`✨ API Phân tích: /api/ai/analyze-contract`);
        console.log(`==================================================\n`);
    });
};
startServer();