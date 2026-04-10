const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// POST http://localhost:5000/api/chat/ask
router.post('/ask', chatController.ask);

module.exports = router;