const { sql, pool, poolConnect } = require('../config/db');

// 1. Lưu kết quả phân tích
// 1. Lưu kết quả phân tích (Đã thêm Title và RecordType)
exports.saveAnalysis = async (req, res) => {
  try {
    // Nhận thêm title và recordType từ Frontend gửi lên
    const { userId, fileName, riskScore, content, title, recordType } = req.body;

    if (!userId || !fileName) {
      return res.status(400).json({ success: false, message: 'userId and fileName required' });
    }

    await poolConnect;
    const request = pool.request();
    request.input('UserId', sql.BigInt, userId);
    request.input('FileName', sql.NVarChar(260), fileName);
    request.input('Title', sql.NVarChar(500), title ?? `Hồ sơ: ${fileName}`); // Lưu tiêu đề đẹp
    request.input('RecordType', sql.NVarChar(50), recordType ?? 'ANALYSIS');   // Phân loại hồ sơ
    request.input('RiskScore', sql.Int, riskScore ?? null);
    request.input('AnalysisJson', sql.NVarChar(sql.MAX), content ?? null);
    request.input('AnalysisAt', sql.DateTime2, new Date());

    // Cập nhật câu lệnh INSERT đầy đủ các cột
    const insertSql = `
      INSERT INTO dbo.ContractHistory (UserId, FileName, Title, RecordType, AnalysisAt, RiskScore, AnalysisJson, CreatedAt)
      OUTPUT INSERTED.Id, INSERTED.UserId, INSERTED.Title, INSERTED.RecordType, INSERTED.RiskScore, INSERTED.AnalysisAt
      VALUES (@UserId, @FileName, @Title, @RecordType, @AnalysisAt, @RiskScore, @AnalysisJson, SYSUTCDATETIME())
    `;

    const result = await request.query(insertSql);
    const row = result.recordset[0];

    console.log(`✅ Đã lưu ${recordType} cho User ${userId}`);
    return res.json({ success: true, analysis: row });

  } catch (err) {
    console.error('Save Analysis Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


// 2. Lấy danh sách lịch sử theo User (CÓ PHÂN TRANG & TÌM KIẾM)
exports.getHistory = async (req, res) => {
  try {
    const userId = req.params.userId;
    // Lấy thêm query params từ Frontend gửi lên (mặc định trang 1, mỗi trang 6 item)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6; 
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    await poolConnect;
    const request = pool.request();
    request.input('UserId', sql.BigInt, userId);

    // Điều kiện lọc cơ bản
    let whereClause = `WHERE UserId = @UserId`;
    
    // Nếu có tìm kiếm thì ghép thêm điều kiện LIKE
    if (search.trim() !== '') {
        whereClause += ` AND (Title LIKE @Search OR FileName LIKE @Search)`;
        request.input('Search', sql.NVarChar, `%${search}%`);
    }

    // 1. Lấy TỔNG SỐ record để Frontend chia trang
    const countSql = `SELECT COUNT(*) as total FROM dbo.ContractHistory ${whereClause}`;
    const countResult = await request.query(countSql);
    const totalDocs = countResult.recordset[0].total;

    // 2. Lấy DATA của đúng trang hiện tại
    const selectSql = `
        SELECT * FROM dbo.ContractHistory 
        ${whereClause} 
        ORDER BY CreatedAt DESC 
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;
    const result = await request.query(selectSql);

    return res.json({ 
        success: true, 
        data: result.recordset,
        currentPage: page,
        totalPages: Math.ceil(totalDocs / limit),
        totalDocs: totalDocs
    });
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