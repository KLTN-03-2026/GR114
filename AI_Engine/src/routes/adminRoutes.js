const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/authMiddleware');

// Route lấy thống kê hệ thống - chỉ dành cho Admin
router.get('/stats', isAdmin, adminController.getSystemStats);

// Route Thu thập & Đồng bộ Pháp luật - chỉ dành cho Admin
router.post('/crawl', isAdmin, adminController.crawlAndSyncLaw);

//  các route khác cho admin ở đây
 router.get('/users', isAdmin, adminController.getAllUsers);
// router.post('/users/:id/ban', isAdmin, adminController.banUser);
// router.get('/audit-logs', isAdmin, adminController.getAuditLogs;

module.exports = router;