const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const multer = require('multer');
const path = require('path');

// Cấu hình upload file tạm
const upload = multer({ 
    dest: path.join(__dirname, '../../uploads/') // Lưu tạm vào folder uploads
});

// POST http://localhost:5000/api/ai/analyze-contract
router.post('/analyze-contract', upload.single('contract'), aiController.analyzeContract);

module.exports = router;