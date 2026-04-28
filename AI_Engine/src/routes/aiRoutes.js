const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const multer = require('multer');
const path = require('path');

const upload = multer({
    dest: path.join(__dirname, '../../uploads/')
});

router.post(
    '/analyze-contract',
    upload.fields([
        { name: 'file', maxCount: 1 },
        { name: 'files', maxCount: 30 }
    ]),
    aiController.analyzeContract
);

module.exports = router;
