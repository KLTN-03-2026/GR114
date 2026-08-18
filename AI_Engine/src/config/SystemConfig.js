const { sql, pool } = require('./db');
const { decrypt } = require('../utils/encryption');

class SystemConfig {
    static appName = 'LEGAI HUB';
    static adminEmail = 'admin@legai.vn';
    static geminiApiKey = '';
    static geminiModel = 'gemini-3.1-flash-lite';
    static temperature = 0.1;
    static pineconeApiKey = '';
    static pineconeIndex = 'legai-index-v3';

    // Hàm load dữ liệu từ DB vào static properties
    static async loadFromDB() {
        try {
            const poolConnect = await pool;
            const result = await poolConnect.request()
                .query('SELECT * FROM AppConfigurations WHERE id = 1');

            if (result.recordset.length > 0) {
                const data = result.recordset[0];
                this.appName = data.appName;
                this.adminEmail = data.adminEmail;
                this.geminiModel = process.env.GEMINI_MODEL || data.geminiModel || this.geminiModel;
                this.temperature = parseFloat(process.env.TEMPERATURE || data.temperature || this.temperature);


                this.pineconeIndex = process.env.PINECONE_INDEX_NAME || process.env.PINECONE_INDEX || data.pineconeIndex || 'legai-index-v3';

                // --- BƯỚC GIẢI MÃ KHI LOAD TỪ DB
                if (data.geminiApiKey) {
                    try {
                        this.geminiApiKey = process.env.GEMINI_API_KEY || decrypt(data.geminiApiKey);
                    } catch (e) {
                        console.log(' Gemini Key trong DB chưa được mã hóa. Đang tạm dùng key thô.');
                        this.geminiApiKey = data.geminiApiKey;
                    }
                }

                if (data.pineconeApiKey) {
                    try {
                        this.pineconeApiKey = process.env.PINECONE_API_KEY || decrypt(data.pineconeApiKey);
                    } catch (e) {
                        console.log('  Pinecone Key trong DB chưa được mã hóa. Đang tạm dùng key thô.');
                        this.pineconeApiKey = data.pineconeApiKey;
                    }
                }

                console.log(`SystemConfig loaded: Model=[${this.geminiModel}], Index=[${this.pineconeIndex}], Temp=[${this.temperature}]`);
            } else {
                console.log('No AppConfigurations found in DB, using defaults');
            }
        } catch (error) {
            console.error('Error loading SystemConfig from DB:', error);
        }
    }

    // lấy tất cả settings 
    static getAll() {
        return {
            appName: this.appName,
            adminEmail: this.adminEmail,
            geminiApiKey: this.geminiApiKey,
            geminiModel: this.geminiModel,
            temperature: this.temperature,
            pineconeApiKey: this.pineconeApiKey,
            pineconeIndex: this.pineconeIndex
        };
    }
}

module.exports = SystemConfig;