const { sql, pool } = require('./db');

class SystemConfig {
    static appName = 'LEGAI HUB';
    static adminEmail = 'admin@legai.vn';
    static geminiApiKey = '';
    static geminiModel = 'gemini-1.5-flash';
    static temperature = 0.3;
    static pineconeApiKey = '';
    static pineconeIndex = 'legal-vectors';

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
                this.geminiApiKey = data.geminiApiKey;
                this.geminiModel = data.geminiModel;
                this.temperature = parseFloat(data.temperature);
                this.pineconeApiKey = data.pineconeApiKey;
                this.pineconeIndex = data.pineconeIndex;
                console.log('SystemConfig loaded from DB');
            } else {
                console.log('No AppConfigurations found in DB, using defaults');
            }
        } catch (error) {
            console.error('Error loading SystemConfig from DB:', error);
        }
    }

    // Hàm lấy tất cả settings (dùng cho internal)
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