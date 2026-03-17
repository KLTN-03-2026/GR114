const { sql, pool, poolConnect } = require('../config/db');

// 1. Lưu kết quả phân tích
exports.saveAnalysis = async (req, res) => {
  try {
    const { userId, fileName, riskScore, content } = req.body;
    if (!userId || !fileName) return res.status(400).json({ success: false, message: 'userId and fileName required' });

    await poolConnect;
    const request = pool.request();
    request.input('UserId', sql.BigInt, userId);
    request.input('FileName', sql.NVarChar(260), fileName);
    request.input('RiskScore', sql.Int, riskScore ?? null);
    request.input('AnalysisJson', sql.NVarChar(sql.MAX), content ?? null);
    request.input('AnalysisAt', sql.DateTime2, new Date());

    const insertSql = `
      INSERT INTO dbo.ContractHistory (UserId, FileName, AnalysisAt, RiskScore, AnalysisJson, CreatedAt)
      OUTPUT INSERTED.Id, INSERTED.UserId, INSERTED.FileName, INSERTED.RiskScore, INSERTED.AnalysisAt
      VALUES (@UserId, @FileName, @AnalysisAt, @RiskScore, @AnalysisJson, SYSUTCDATETIME())
    `;

    const result = await request.query(insertSql);
    const row = result.recordset[0];
    return res.json({ success: true, analysis: row });
  } catch (err) {
    console.error('Save Analysis Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 2. Lấy danh sách lịch sử theo User
exports.getHistory = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    await poolConnect;
    const request = pool.request();
    request.input('UserId', sql.BigInt, userId);

    const selectSql = `SELECT * FROM dbo.ContractHistory WHERE UserId = @UserId ORDER BY CreatedAt DESC`;
    const result = await request.query(selectSql);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('Get History Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Lấy chi tiết 1 hồ sơ (MỚI)
exports.getDetail = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'id required' });

    await poolConnect;
    const request = pool.request();
    request.input('Id', sql.BigInt, id);

    const sqlText = `SELECT * FROM dbo.ContractHistory WHERE Id = @Id`;
    const result = await request.query(sqlText);

    const row = result.recordset && result.recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });

    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('Get Detail Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Xóa hồ sơ (MỚI)
exports.deleteHistory = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'id required' });

    await poolConnect;
    const request = pool.request();
    request.input('Id', sql.BigInt, id);

    const deleteSql = `DELETE FROM dbo.ContractHistory WHERE Id = @Id`;
    const result = await request.query(deleteSql);

    const affected = result.rowsAffected && result.rowsAffected[0];
    if (!affected || affected === 0) {
      return res.status(404).json({ success: false, message: 'Not found or already deleted' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete History Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};