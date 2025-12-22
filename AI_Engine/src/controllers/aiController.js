const { GoogleGenerativeAI } = require("@google/generative-ai");
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');

// Cấu hình Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

exports.analyzeContract = async (req, res) => {
    try {
        // 1. Kiểm tra xem có file gửi lên không
        if (!req.file) {
            return res.status(400).json({ error: "Vui lòng upload file hợp đồng!" });
        }

        let contractText = "";
        const filePath = req.file.path;
        const mimeType = req.file.mimetype;

        // 2. Phân loại và Đọc file
        console.log(`🕵️‍♂️ Đang đọc file: ${req.file.originalname} (${mimeType})`);

        if (mimeType === 'application/pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            contractText = data.text;
        } 
        else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { // .docx
            const result = await mammoth.extractRawText({ path: filePath });
            contractText = result.value;
        } 
        else {
            // Mặc định coi là file text (.txt)
            contractText = fs.readFileSync(filePath, 'utf-8');
        }

        // Xóa file tạm sau khi đọc xong để đỡ rác server
        fs.unlinkSync(filePath);

        if (!contractText || contractText.trim().length < 10) {
            return res.status(400).json({ error: "Không đọc được nội dung file hoặc file quá ngắn." });
        }

        // 3. Gửi cho Gemini phân tích
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

        // Làm sạch JSON (bỏ dấu ```json nếu có)
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const analysisResult = JSON.parse(cleanJson);

        console.log("✅ Phân tích xong!");
        res.json(analysisResult);

    } catch (error) {
        console.error("❌ Lỗi phân tích:", error);
        res.status(500).json({ error: "Lỗi hệ thống khi phân tích hợp đồng." });
    }
};