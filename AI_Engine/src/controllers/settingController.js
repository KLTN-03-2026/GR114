const { sql, pool } = require('../config/db');
const SystemConfig = require('../config/SystemConfig');

// Hàm che khuất API key
function maskApiKey(key) {
    if (!key || key.length < 8) return '********';
    return key.substring(0, 4) + '...' + key.substring(key.length - 4);
}

// GET /api/admin/settings - Lấy settings với API keys che khuất
const getSettings = async (req, res) => {
    try {
        const poolConnect = await pool;
        const result = await poolConnect.request()
            .query('SELECT * FROM AppConfigurations WHERE id = 1');

        if (result.recordset.length > 0) {
            const data = result.recordset[0];
            res.json({
                success: true,
                data: {
                    appName: data.appName,
                    adminEmail: data.adminEmail,
                    geminiApiKey: maskApiKey(data.geminiApiKey),
                    geminiModel: data.geminiModel,
                    temperature: parseFloat(data.temperature),
                    pineconeApiKey: maskApiKey(data.pineconeApiKey),
                    pineconeIndex: data.pineconeIndex
                }
            });
        } else {
            // Trả về mặc định nếu chưa có
            res.json({
                success: true,
                data: SystemConfig.getAll()
            });
        }
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// POST /api/admin/settings - Lưu settings
const saveSettings = async (req, res) => {
    const { appName, adminEmail, geminiApiKey, geminiModel, temperature, pineconeApiKey, pineconeIndex } = req.body;

    // Validate cơ bản
    if (!appName || !adminEmail || !geminiModel || temperature === undefined || !pineconeIndex) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
    }

    if (temperature < 0 || temperature > 1) {
        return res.status(400).json({ success: false, message: 'Temperature phải từ 0 đến 1' });
    }

    try {
        const poolConnect = await pool;

        // Kiểm tra xem đã có settings chưa
        const checkResult = await poolConnect.request()
            .query('SELECT COUNT(*) as count FROM AppConfigurations WHERE id = 1');

        const hasSettings = checkResult.recordset[0].count > 0;

        // Xử lý API keys: Nếu là chuỗi che, giữ nguyên từ DB
        let finalGeminiKey = geminiApiKey;
        let finalPineconeKey = pineconeApiKey;

        if (hasSettings) {
            const currentResult = await poolConnect.request()
                .query('SELECT geminiApiKey, pineconeApiKey FROM AppConfigurations WHERE id = 1');
            const current = currentResult.recordset[0];

            if (geminiApiKey === maskApiKey(current.geminiApiKey)) {
                finalGeminiKey = current.geminiApiKey;
            }
            if (pineconeApiKey === maskApiKey(current.pineconeApiKey)) {
                finalPineconeKey = current.pineconeApiKey;
            }
        }

        // Validate API keys nếu không phải che
        if (!finalGeminiKey || finalGeminiKey === '********') {
            return res.status(400).json({ success: false, message: 'Thiếu Gemini API Key' });
        }
        if (!finalPineconeKey || finalPineconeKey === '********') {
            return res.status(400).json({ success: false, message: 'Thiếu Pinecone API Key' });
        }

        // Update hoặc Insert
        if (hasSettings) {
            await poolConnect.request()
                .input('appName', sql.NVarChar, appName)
                .input('adminEmail', sql.NVarChar, adminEmail)
                .input('geminiApiKey', sql.NVarChar, finalGeminiKey)
                .input('geminiModel', sql.NVarChar, geminiModel)
                .input('temperature', sql.Decimal(3, 2), temperature)
                .input('pineconeApiKey', sql.NVarChar, finalPineconeKey)
                .input('pineconeIndex', sql.NVarChar, pineconeIndex)
                .query(`
                    UPDATE AppConfigurations
                    SET appName = @appName, adminEmail = @adminEmail, geminiApiKey = @geminiApiKey,
                        geminiModel = @geminiModel, temperature = @temperature, pineconeApiKey = @pineconeApiKey,
                        pineconeIndex = @pineconeIndex, updatedAt = GETDATE()
                    WHERE id = 1
                `);
        } else {
            await poolConnect.request()
                .input('appName', sql.NVarChar, appName)
                .input('adminEmail', sql.NVarChar, adminEmail)
                .input('geminiApiKey', sql.NVarChar, finalGeminiKey)
                .input('geminiModel', sql.NVarChar, geminiModel)
                .input('temperature', sql.Decimal(3, 2), temperature)
                .input('pineconeApiKey', sql.NVarChar, finalPineconeKey)
                .input('pineconeIndex', sql.NVarChar, pineconeIndex)
                .query(`
                    INSERT INTO AppConfigurations (id, appName, adminEmail, geminiApiKey, geminiModel, temperature, pineconeApiKey, pineconeIndex)
                    VALUES (1, @appName, @adminEmail, @geminiApiKey, @geminiModel, @temperature, @pineconeApiKey, @pineconeIndex)
                `);
        }

        // Hot-reload SystemConfig
        await SystemConfig.loadFromDB();

        res.json({ success: true, message: 'Cấu hình đã được lưu thành công' });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lưu cấu hình' });
    }
};

module.exports = {
    getSettings,
    saveSettings
};