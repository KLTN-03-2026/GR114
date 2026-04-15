const legalDataService = require('../services/legalDataService');

const getLegalDocuments = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', category = '', status = '' } = req.query;
        const result = await legalDataService.getLegalDocuments({
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            search,
            category,
            status
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[legalDataController] getLegalDocuments error:', error.message || error);
        res.status(500).json({ success: false, message: error.message || 'Unable to fetch legal documents' });
    }
};

const createLegalDocument = async (req, res) => {
    try {
        const data = req.body;
        const result = await legalDataService.upsertLegalData(data, false);

        if (result.success) {
            res.json({ success: true, data: result, syncStatus: result.syncStatus });
        } else {
            res.status(500).json({ success: false, message: result.error, syncStatus: result.syncStatus });
        }
    } catch (error) {
        console.error('[legalDataController] createLegalDocument error:', error.message || error);
        res.status(500).json({ success: false, message: error.message || 'Unable to create legal document' });
    }
};

const updateLegalDocument = async (req, res) => {
    try {
        const data = { ...req.body, id: req.params.id };
        const result = await legalDataService.upsertLegalData(data, true);

        if (result.success) {
            res.json({ success: true, data: result, syncStatus: result.syncStatus });
        } else {
            res.status(500).json({ success: false, message: result.error, syncStatus: result.syncStatus });
        }
    } catch (error) {
        console.error('[legalDataController] updateLegalDocument error:', error.message || error);
        res.status(500).json({ success: false, message: error.message || 'Unable to update legal document' });
    }
};

const deleteLegalDocument = async (req, res) => {
    try {
        const result = await legalDataService.deleteLegalData(req.params.id);
        if (result.success) {
            res.json({ success: true, syncStatus: result.syncStatus });
        } else {
            res.status(500).json({ success: false, message: result.error, syncStatus: result.syncStatus });
        }
    } catch (error) {
        console.error('[legalDataController] deleteLegalDocument error:', error.message || error);
        res.status(500).json({ success: false, message: error.message || 'Unable to delete legal document' });
    }
};

const getDocumentChunks = async (req, res) => {
    try {
        const chunks = await legalDataService.getDocumentChunks(req.params.id);
        res.json({ success: true, data: chunks });
    } catch (error) {
        console.error('[legalDataController] getDocumentChunks error:', error.message || error);
        res.status(500).json({ success: false, message: error.message || 'Unable to fetch document chunks' });
    }
};

module.exports = {
    getLegalDocuments,
    createLegalDocument,
    updateLegalDocument,
    deleteLegalDocument,
    getDocumentChunks
};