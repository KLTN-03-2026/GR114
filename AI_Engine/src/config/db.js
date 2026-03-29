// CHÚ Ý: Dùng thư viện mssql gốc (không dùng msnodesqlv8 nữa)
const sql = require('mssql'); 

const dbConfig = {
    user: 'sa',
    password: '123456', // Mật khẩu Duy vừa đặt ở Mặt trận 1
    server: 'localhost',
    port: 1433,         // Cổng chúng ta vừa thông ở Mặt trận 2
    database: 'LegalBotDB',
    options: {
        encrypt: false, // Để false vì chạy ở máy cá nhân
        trustServerCertificate: true,
        // Không cần instanceName nữa vì đã có port 1433
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect()
    .then(() => {
        console.log('========================================');
        console.log('✅ BINGO! Đã thông tuyến TCP/IP tới SQL Server!');
        console.log('🚀 Tài khoản: sa | Cổng: 1433');
        console.log('========================================');
    })
    .catch(err => {
        console.error('❌ Lỗi kết nối DB (Cách 2):', err.message);
    });

module.exports = { sql, pool, poolConnect };