const { GoogleGenerativeAI } = require("@google/generative-ai");
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');

// Cấu hình Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Dùng bản 2.5-flash và bật chế độ ép trả về JSON 100%
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" }
});

exports.analyzeContract = async (req, res) => {
    let filePath = null;

    try {
        // 1. Kiểm tra xem có file gửi lên không
        if (!req.file) {
            return res.status(400).json({ error: "Vui lòng upload file hợp đồng!" });
        }

        filePath = req.file.path;
        const mimeType = req.file.mimetype;
        let contractText = "";

        // 2. Phân loại và Đọc file
        console.log(`🕵️‍♂️ Đang đọc file: ${req.file.originalname} (${mimeType})`);

        if (mimeType === 'application/pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            contractText = data.text;
        } 
        else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { 
            const result = await mammoth.extractRawText({ path: filePath });
            contractText = result.value;
        } 
        else {
            contractText = fs.readFileSync(filePath, 'utf-8');
        }

        if (!contractText || contractText.trim().length < 10) {
            return res.status(400).json({ error: "Không đọc được nội dung file hoặc file quá ngắn." });
        }

        // 3. Gửi cho Gemini phân tích (GIỮ NGUYÊN PROMPT GỐC CỦA BẠN)
        console.log("🤖 Đang gửi nội dung cho Gemini phân tích...");
        
        const prompt = `
        Bạn là một Luật sư AI chuyên nghiệp (LegAI). Hãy phân tích hợp đồng dưới đây và trả về kết quả dưới dạng JSON (chỉ JSON, không có markdown).
        
        Nội dung hợp đồng:
        """${contractText}"""

        Yêu cầu output JSON format:
        {
            "summary": "Tóm tắt ngắn gọn nội dung hợp đồng (2-3 câu)",
            "risk_score": (Số nguyên từ 0-100, càng cao càng an toàn),
            "risks": [
                {
                    "clause": "Trích dẫn điều khoản gốc gây rủi ro",
                    "issue": "Giải thích tại sao rủi ro theo luật Việt Nam",
                    "severity": "High" | "Medium" | "Low"
                }
            ],
            "recommendation": "Lời khuyên tổng quan của luật sư"
        }
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse thẳng vì API đã đảm bảo format JSON
        const analysisResult = JSON.parse(responseText);

        console.log("✅ Phân tích xong!");
        res.json(analysisResult);

    } catch (error) {
        console.error("❌ Lỗi phân tích:", error);
        res.status(500).json({ error: "Lỗi hệ thống khi phân tích hợp đồng. Chi tiết: " + error.message });
    } finally {
        // Luôn dọn rác ổ cứng dù thành công hay thất bại
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("🧹 Đã dọn dẹp file tạm.");
        }
    }
};