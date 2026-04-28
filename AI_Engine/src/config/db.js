const sql = require('mssql');

const config = {
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD || '123456',
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'LegalBotDB',
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

const isDbReady = () => Boolean(pool.connected);

module.exports = {
    sql,
    pool,
    poolConnect,
    isDbReady
};
