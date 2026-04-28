const ragService = require('../services/ragService');
const geminiService = require('../services/geminiService');

exports.ask = async (req, res) => {
    try {
        // 1. Nhận câu hỏi từ Frontend
        const { question, message } = req.body;
        const userQuery = question || message; // Chấp nhận cả 2 key

        if (!userQuery) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập câu hỏi' });
        }

        console.log(`🤖 LegAI nhận câu hỏi: "${userQuery}"`);

        // 2. Gọi RAG tìm luật (Sử dụng hàm 'query' như trong file ragService bạn gửi)
        let relatedDocs = [];
        try {
            relatedDocs = await ragService.query(userQuery);
        } catch (err) {
            console.error("⚠️ Lỗi RAG (sẽ trả lời bằng kiến thức chung):", err.message);
        }
        
        // 3. Gọi Gemini trả lời (kèm theo tài liệu vừa tìm được)
        const answer = await geminiService.generateAnswerWithGemini(userQuery, relatedDocs);

        // 4. Trả về kết quả JSON
        return res.json({
            success: true,
            answer: answer,
            // Trả về nguồn tham khảo để FE hiển thị
            sources: relatedDocs.map(doc => ({
                title: doc.title,
                source: doc.sourceUrl || 'Cơ sở dữ liệu nội bộ'
            }))
        });

    } catch (error) {
        console.error('❌ Lỗi Chat Controller:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'LegAI đang gặp sự cố, vui lòng thử lại sau.',
            error: error.message 
        });
    }
};