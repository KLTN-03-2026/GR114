const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Cấu hình upload file tạm
// const upload = multer({
//     dest: path.join(__dirname, '../../uploads/')
// });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Tạo thư mục 'uploads' trong thư mục gốc của AI_Engine nếu chưa có
        const uploadPath = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true }); // recursive: true để tạo các thư mục cha nếu cần
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Sử dụng tên file gốc kèm timestamp để tránh trùng lặp
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

// Chỉ chấp nhận một số loại file văn bản nhất định
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf',
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'text/plain'
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Loại file không được hỗ trợ! Chỉ chấp nhận PDF, DOC, DOCX, TXT.'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// router.post('/analyze-contract', upload.single('contract'), aiController.analyzeContract);

router.post('/analyze-contract', upload.single('file'), aiController.analyzeContract);
// Endpoint mới: phân tích nhiều hợp đồng cùng lúc (field: 'files')
router.post('/analyze-contracts', upload.array('files', 20), aiController.analyzeContractsBatch);

// NEW ROUTE: Route cho So sánh Hợp đồng
router.post('/compare-contracts', upload.fields([
    { name: 'fileA', maxCount: 1 }, // 'fileA' là tên field từ frontend, tối đa 1 file
    { name: 'fileB', maxCount: 1 }  // 'fileB' là tên field từ frontend, tối đa 1 file
]), aiController.compareContracts);

router.post('/generate-form', aiController.generateForm);
module.exports = router;