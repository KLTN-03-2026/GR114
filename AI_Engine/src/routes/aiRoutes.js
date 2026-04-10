const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const multer = require('multer');
const path = require('path');

// Cấu hình upload file tạm
const upload = multer({
    dest: path.join(__dirname, '../../uploads/')
});



//1/ Route Phân tích hợp đồng (Nhận file hợp đồng và trả về kết quả phân tích)
router.post('/analyze-contract', upload.single('file'), aiController.analyzeContract);
// 2. Route Lập kế hoạch báo cáo (Nhận yêu cầu và trả về kế hoạch đã lập)
router.post('/generate-planning', upload.array('files', 10), aiController.generatePlanning);
// 3. Route Soạn thảo văn bản (Nhận yêu cầu và trả về văn bản đã soạn thảo)
router.post('/generate-form', aiController.generateForm);
// 4. Route Thẩm định Video (Bóc tách link TikTok/YouTube và đối soát)
router.post('/analyze-video', aiController.analyzeVideo);

module.exports = router;