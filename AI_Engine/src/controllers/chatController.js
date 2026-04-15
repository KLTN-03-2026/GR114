const { sql, pool, poolConnect } = require('../config/db');

const ragService = require('../services/ragService');
const geminiService = require('../services/geminiService');

exports.ask = async (req, res) => {
    try {
        const { question, chatHistory } = req.body;

        if (!question) {
            return res.status(400).json({ success: false, message: "Thiếu câu hỏi." });
        }

        // 1. Tìm tài liệu liên quan từ Pinecone (RAG)
        // Lưu ý: Hàm này trong ragService.js của bạn tên là 'query'
        const documents = await ragService.query(question);

        // 2. Gửi sang Gemini để lấy câu trả lời
        const aiResponse = await geminiService.generateAnswerWithGemini(question, documents, chatHistory || []);

        // 3. LOGIC BƯỚC 3: Kiểm tra tín hiệu Fallback [CONTACT_LAWYER]
        if (aiResponse.includes('[CONTACT_LAWYER]')) {
            await poolConnect;
            
            // Lấy ngẫu nhiên 1 luật sư từ Database (Bước 2 bạn đã tạo bảng Lawyers)
            const result = await pool.request().query(`
                SELECT TOP 1 FullName, Phone, Specialty 
                FROM dbo.Lawyers 
                WHERE IsActive = 1 
                ORDER BY NEWID()
            `);
            
            const lawyer = result.recordset[0];

            return res.json({
                success: true,
                type: 'contact', // Tín hiệu cho Frontend
                answer: "Rất tiếc, câu hỏi của bạn nằm ngoài phạm vi dữ liệu hiện tại của hệ thống. Để đảm bảo quyền lợi, bạn nên kết nối trực tiếp với Luật sư chuyên trách của chúng tôi.",
                lawyer: {
                    name: lawyer.FullName,
                    phone: lawyer.Phone,
                    specialty: lawyer.Specialty
                }
            });
        }

        // 4. Trả về kết quả bình thường
        res.json({
            success: true,
            type: 'text',
            answer: aiResponse
        });

    } catch (error) {
        console.error("❌ Lỗi Chat Controller:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message // Sẽ không còn báo 'ragService is not defined' nữa
        });
    }
};