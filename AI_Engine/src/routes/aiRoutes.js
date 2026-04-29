const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const multer = require('multer');
const path = require('path');

const upload = multer({
    dest: path.join(__dirname, '../../uploads/')
});

const ensureDev = (req, res, next) => {
    if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
        return res.status(404).end();
    }
    return next();
};

router.post(
    '/analyze-contract',
    upload.fields([
        { name: 'file', maxCount: 1 },
        { name: 'files', maxCount: 30 }
    ]),
    aiController.analyzeContract
);

router.post(
    '/classify-contract',
    upload.fields([
        { name: 'file', maxCount: 1 },
        { name: 'files', maxCount: 30 }
    ]),
    aiController.classifyContract
);

router.post('/train-contract-classifier', aiController.trainContractClassifier);

router.post('/dev/train-contract-classifier-default', ensureDev, aiController.devTrainContractClassifierDefault);

router.post('/dev/train-contract-classifier-from-urls', ensureDev, aiController.devTrainContractClassifierFromUrls);

router.get('/dev/self-test-contract-classifier', ensureDev, aiController.devSelfTestContractClassifier);

module.exports = router;
