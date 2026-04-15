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

// NEW ROUTES: Luật của tôi & Vừa xem gần đây (Không dùng authenticateToken)
// Lấy danh sách luật đã lưu cho một người dùng cụ thể
router.get('/user/saved-laws/:userId', historyController.getSavedLaws); // userId trong URL params
// Thêm/Xóa một luật khỏi danh sách đã lưu (userId trong req.body)
router.post('/user/toggle-saved-law', historyController.toggleSavedLaw); 
// THÊM MỚI: Xóa một luật đã lưu theo ID của bản ghi (dùng DELETE request)
router.delete('/user/remove-saved-law', historyController.removeSavedLaw); 

// Lấy danh sách tài liệu vừa xem gần đây cho một người dùng cụ thể
router.get('/user/recent-docs/:userId', historyController.getRecentDocs); // userId trong URL params
// Thêm/Cập nhật một tài liệu vào lịch sử xem gần đây (userId trong req.body)
router.post('/user/add-recent-doc', historyController.addRecentDoc); 
// Xóa một tài liệu khỏi lịch sử xem gần đây (userId trong req.body)
router.delete('/user/remove-recent-doc', historyController.removeRecentDoc); 


module.exports = router;