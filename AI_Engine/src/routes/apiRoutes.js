const express = require('express');
const router = express.Router();

// Import các controller
const documentController = require('../controllers/documentController');
const authController = require('../controllers/authController');
const historyController = require('../controllers/historyController');


// --- AUTH ROUTES ---
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// --- HISTORY ROUTES (Lịch sử phân tích) ---
router.post('/history/save', historyController.saveAnalysis);
router.get('/history/:userId', historyController.getHistory);
router.get('/history/detail/:id', historyController.getDetail);
router.delete('/history/delete/:id', historyController.deleteHistory);

// --- DOCUMENT ROUTES 
// 3.  Lấy thống kê số lượng văn bản theo danh mục (dành cho FE làm filter dropdown)
router.get('/document-stats', documentController.getDocumentStats);
// 1. Lấy danh sách toàn bộ luật
router.get('/documents', documentController.getAllDocuments); 

// 2. Lấy chi tiết 1 bộ luật khi user click vào xem
router.get('/documents/:id', documentController.getDocumentDetail);

module.exports = router;