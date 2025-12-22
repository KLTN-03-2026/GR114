const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const multer = require('multer');
const path = require('path');

// Cấu hình upload file tạm
const upload = multer({
    dest: path.join(__dirname, '../../uploads/')
});


// router.post('/analyze-contract', upload.single('contract'), aiController.analyzeContract);

router.post('/analyze-contract', upload.single('file'), aiController.analyzeContract);

module.exports = router;