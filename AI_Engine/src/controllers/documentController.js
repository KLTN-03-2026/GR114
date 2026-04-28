// ...existing code...
const { sql, pool, poolConnect, isDbReady } = require('../config/db');

const sampleDocuments = [
  {
    Id: 1,
    Title: 'Bộ luật Dân sự 2015',
    SubTitle: 'BỘ LUẬT',
    DocumentNumber: '91/2015/QH13',
    DocumentType: 'Bộ luật',
    Agency: 'Quốc hội',
    IssueDate: '2015-11-24',
    Description: 'Văn bản mẫu tạm thời khi hệ thống chưa kết nối được cơ sở dữ liệu.',
    Content: 'Nội dung văn bản mẫu để giao diện tra cứu vẫn chạy được trong chế độ offline.'
  },
  {
    Id: 2,
    Title: 'Luật Thương mại 2005',
    SubTitle: 'LUẬT',
    DocumentNumber: '36/2005/QH11',
    DocumentType: 'Luật',
    Agency: 'Quốc hội',
    IssueDate: '2005-06-14',
    Description: 'Dữ liệu mẫu dự phòng cho module văn bản pháp luật.',
    Content: 'Hệ thống đang dùng dữ liệu mẫu vì SQL Server chưa sẵn sàng.'
  }
];

const canUseDb = async () => {
  await poolConnect;
  return isDbReady();
};

/**
 * GET /api/documents
 * Optional query: ?search=keyword
 */
exports.getAllDocuments = async (req, res) => {
  try {
    const search = (req.query.search || '').trim().toLowerCase();
    if (!(await canUseDb())) {
      const data = search
        ? sampleDocuments.filter((item) =>
            [item.Title, item.DocumentType, item.Description].filter(Boolean).some((text) => text.toLowerCase().includes(search))
          )
        : sampleDocuments;
      return res.json({ success: true, data });
    }

    const request = pool.request();
    const rawSearch = (req.query.search || '').trim();
    let sqlText = `SELECT * FROM dbo.LegalDocuments`;
    if (rawSearch) {
      sqlText += ` WHERE Title LIKE @search OR DocumentType LIKE @search`;
      request.input('search', sql.NVarChar(sql.MAX), `%${rawSearch}%`);
    }
    sqlText += ` ORDER BY IssueDate DESC`;

    const result = await request.query(sqlText);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('GetAllDocuments Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/documents/:id
 */
exports.getDocumentDetail = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'id required' });

    if (!(await canUseDb())) {
      const row = sampleDocuments.find((item) => String(item.Id) === String(id));
      if (!row) return res.status(404).json({ success: false, message: 'Document not found' });
      return res.json({ success: true, data: row });
    }

    const request = pool.request();
    request.input('Id', sql.Int, id);

    const sqlText = `SELECT * FROM dbo.LegalDocuments WHERE Id = @Id`;
    const result = await request.query(sqlText);
    const row = result.recordset && result.recordset[0];

    if (!row) return res.status(404).json({ success: false, message: 'Document not found' });

    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('GetDocumentDetail Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
// ...existing code...
