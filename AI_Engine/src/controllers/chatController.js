const ragService = require('../services/ragService');
const geminiService = require('../services/geminiService');
const { pool, poolConnect } = require('../config/db');



exports.ask = async (req, res) => {
    try {
        // ==========================================
        // 1. NHẬN & KIỂM TRA ĐẦU VÀO (CONTROLLER DUTY)
        // ==========================================
        const { question, message } = req.body;
        const userQuery = question || message;

        if (!userQuery) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập câu hỏi' });
        }

        console.log(`🤖 LegAI nhận câu hỏi: "${userQuery}"`);

        // ==========================================
        // 2. GIAO VIỆC CHO SERVICE (RAG & GEMINI)
        // ==========================================
        let relatedDocs = [];
        try {
            relatedDocs = await ragService.query(userQuery);
        } catch (err) {
            console.error("⚠️ Lỗi RAG (sẽ trả lời bằng kiến thức chung):", err.message);
        }

        // Gọi Service AI (Chuẩn kiến trúc)
        const answer = await geminiService.generateAnswerWithGemini(userQuery, relatedDocs);

        // ==========================================
        // 4. TRẢ KẾT QUẢ CHO FRONTEND
        // ==========================================

        // ==========================================
        // 4. TRẢ KẾT QUẢ CHO FRONTEND
        // ==========================================
        return res.json({
            success: true,
            answer: answer,
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