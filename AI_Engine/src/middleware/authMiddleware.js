const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'DATN_DTU_2026_SECRET_KEY_999');

        // Gán thông tin user vào request để các controller sau sử dụng
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        };

        next();
    } catch (error) {
        console.error('Auth Middleware Error:', error.message);
        return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or expired token' });
    }
};

// Middleware kiểm tra quyền Admin
const isAdmin = (req, res, next) => {
    try {
        // Đầu tiên kiểm tra đã authenticate chưa
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'DATN_DTU_2026_SECRET_KEY_999');

        // Gán thông tin user vào request
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        };

        // Kiểm tra role có phải ADMIN không
        if (req.user.role !== 'ADMIN' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
        }

        next();
    } catch (error) {
        console.error('Admin Middleware Error:', error.message);
        return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or expired token' });
    }
};

module.exports = { authMiddleware, isAdmin };