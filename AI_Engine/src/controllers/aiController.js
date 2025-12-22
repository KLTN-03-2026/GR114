// AI_Engine/src/controllers/aiController.js
const geminiService = require('../services/geminiService');
const fs = require('fs');
const path = require('path');

// Nạp thư viện đọc file (như code cũ của bạn)
let pdfParse, mammoth;
try { pdfParse = require('pdf-parse'); } catch (e) { }
try { mammoth = require('mammoth'); } catch (e) { }

exports.analyzeContract = async (req, res) => {
    try {
        // 1. Kiểm tra file
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Vui lòng upload file hợp đồng.' });
        }

        console.log(`📄 Đang phân tích file: ${req.file.originalname}`);
        const filePath = req.file.path;
        const ext = path.extname(req.file.originalname).toLowerCase();
        let contractText = "";

        // 2. Đọc nội dung dựa trên đuôi file
        try {
            if (ext === '.pdf' && pdfParse) {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdfParse(dataBuffer);
                contractText = data.text;
            }
            else if (ext === '.docx' && mammoth) {
                const result = await mammoth.extractRawText({ path: filePath });
                contractText = result.value;
            }
            else {
                // Mặc định đọc text
                contractText = fs.readFileSync(filePath, 'utf8');
            }
        } catch (readErr) {
            console.error("Lỗi đọc file:", readErr);
            return res.status(400).json({ success: false, message: "Không đọc được nội dung file." });
        }

        // 3. Gửi cho Gemini phân tích (Kèm context rỗng hoặc lấy từ RAG nếu muốn xịn hơn)
        const analysisResult = await geminiService.analyzeContractWithGemini(contractText, "");

        // 4. Xóa file tạm (Code cũ bạn có xóa)
        try { fs.unlinkSync(filePath); } catch (e) { }

        // 5. Trả kết quả
        return res.json({
            success: true,
            data: analysisResult
        });

    } catch (error) {
        console.error('❌ Lỗi Analyze Controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi khi phân tích hợp đồng.',
            error: error.message
        });
    }
};