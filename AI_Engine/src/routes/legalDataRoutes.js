const express = require('express');
const router = express.Router();
const legalDataController = require('../controllers/legalDataController');
const { isAdmin } = require('../middleware/authMiddleware');

router.get('/', isAdmin, legalDataController.getLegalDocuments);
router.post('/', isAdmin, legalDataController.createLegalDocument);
router.put('/:id', isAdmin, legalDataController.updateLegalDocument);
router.delete('/:id', isAdmin, legalDataController.deleteLegalDocument);
router.get('/:id/chunks', isAdmin, legalDataController.getDocumentChunks);
router.get('/categories', isAdmin, legalDataController.getCategories);
module.exports = router;