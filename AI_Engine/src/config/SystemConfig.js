const { sql, pool } = require('./db');

class SystemConfig {
    static appName = '';
    static adminEmail = '';
    static geminiApiKey = '';
    static geminiModel = '';
    static temperature = 0.3;
    static pineconeApiKey = '';
    static pineconeIndex = '';

    // Hàm load dữ liệu từ DB vào class
    static async loadFromDB() {
        try {
            const poolConnection = await pool;
            const result = await poolConnection.request()
                .query('SELECT * FROM SystemSettings WHERE id = 1');

            if (result.recordset.length > 0) {
                const data = result.recordset[0];
                this.appName = data.appName;
                this.adminEmail = data.adminEmail;
                this.geminiApiKey = data.geminiApiKey;
                this.geminiModel = data.geminiModel;
                this.temperature = parseFloat(data.temperature);
                this.pineconeApiKey = data.pineconeApiKey;
                this.pineconeIndex = data.pineconeIndex;
                console.log('SystemConfig loaded from DB successfully');
            } else {
                console.log('No SystemSettings found in DB, using defaults');
            }
        } catch (error) {
            console.error('Error loading SystemConfig from DB:', error);
        }
    }

    // Hàm lấy config dưới dạng object (cho internal use)
    static getConfig() {
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