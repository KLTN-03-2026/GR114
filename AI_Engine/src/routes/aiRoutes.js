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
// Endpoint mới: phân tích nhiều hợp đồng cùng lúc (field: 'files')
router.post('/analyze-contracts', upload.array('files', 20), aiController.analyzeContractsBatch);
router.post('/generate-form', aiController.generateForm);
module.exports = router;