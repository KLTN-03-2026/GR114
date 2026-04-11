const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/authMiddleware');

// Route lấy thống kê hệ thống - chỉ dành cho Admin
router.get('/stats', isAdmin, adminController.getSystemStats);

// Route Thu thập & Đồng bộ Pháp luật - chỉ dành cho Admin
router.post('/crawl', isAdmin, adminController.crawlAndSyncLaw);
<<<<<<< HEAD

//  các route khác cho admin ở đây
 router.get('/users', isAdmin, adminController.getAllUsers);
// router.post('/users/:id/ban', isAdmin, adminController.banUser);
// router.get('/audit-logs', isAdmin, adminController.getAuditLogs;
=======
router.post('/crawler/run-manual', isAdmin, adminController.runManualCrawl);
router.get('/crawler/history', isAdmin, adminController.getRecentHistory);

// Routes cho Crawler Settings
router.get('/crawler/settings', isAdmin, adminController.getCrawlerSettings);
router.put('/crawler/settings', isAdmin, adminController.updateCrawlerSettings);

//  các route khác cho admin ở đây
router.get('/users', isAdmin, adminController.getAllUsers);
router.post('/users', isAdmin, adminController.createUser);
router.put('/users/:id/ban', isAdmin, adminController.toggleUserBan);
router.get('/feature-usage', isAdmin, adminController.getFeatureUsage);
router.get('/history-analytics', isAdmin, adminController.getAiHistory);
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c

module.exports = router;