const sql = require('mssql');

const config = {
    user: 'sa',
    password: '123456',
    server: 'localhost',
    database: 'LegalBotDB',
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect().then(() => {
    console.log('✅ Connected to SQL Server LegalBotDB');
}).catch(err => {
    console.error('❌ SQL Server connection error:', err);
});

module.exports = {
    sql,
    pool,
    poolConnect
};