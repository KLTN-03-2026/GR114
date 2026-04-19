const express = require('express');
const { getSettings, saveSettings } = require('../controllers/settingController');
const { authMiddleware, isAdmin } = require('../middleware/authMiddleware');
const SystemConfig = require('../config/SystemConfig');
const router = express.Router();

// GET /api/admin/settings - Lấy cài đặt hệ thống
router.get('/', isAdmin, getSettings);
// POST /api/admin/settings - Lưu cài đặt hệ thống
router.post('/', isAdmin, saveSettings);
// API mới: Lấy danh sách Model động từ Google
router.get('/models', async (req, res) => {
    try {
        const apiKey = SystemConfig.geminiApiKey;
        // Nếu chưa có Key, trả về 1 mảng mặc định để UI không bị trống
        if (!apiKey) {
            return res.json({ success: true, data: ['gemini-2.5-flash', 'gemini-1.5-flash'] });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            // Lọc đúng logic của tầng 3: Chỉ lấy con nào tạo text được
            const models = data.models
                .filter(m => m.supportedGenerationMethods.includes("generateContent"))
                .map(m => m.name.replace('models/', ''));

            return res.json({ success: true, data: models });
        }

        return res.json({ success: true, data: ['gemini-2.5-flash'] });
    } catch (error) {
        console.error("Lỗi fetch models:", error.message);
        return res.json({ success: true, data: ['gemini-2.5-flash'] });
    }
});
module.exports = router;