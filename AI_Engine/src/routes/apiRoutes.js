const express = require('express');
const router = express.Router();

// Import các controller
const authController = require('../controllers/authController');
const historyController = require('../controllers/historyController');
const documentController = require('../controllers/documentController'); // ✅ Dòng này đã sạch, không có dấu +

// --- AUTH ROUTES ---
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// --- HISTORY ROUTES (Lịch sử phân tích) ---
router.post('/history/save', historyController.saveAnalysis);
router.get('/history/:userId', historyController.getHistory);
router.get('/history/detail/:id', historyController.getDetail);
router.delete('/history/delete/:id', historyController.deleteHistory);

// --- DOCUMENT ROUTES (Văn bản pháp luật - MỚI) ---
router.get('/documents', documentController.getAllDocuments);
router.get('/documents/:id', documentController.getDocumentDetail);

module.exports = router;