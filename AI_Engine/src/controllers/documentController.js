// ...existing code...
const { sql, pool, poolConnect } = require('../config/db');

/**
 * GET /api/documents
 * Optional query: ?search=keyword
 */
exports.getAllDocuments = async (req, res) => {
  try {
    await poolConnect;
    const request = pool.request();

    const search = (req.query.search || '').trim();
    let sqlText = `SELECT * FROM dbo.LegalDocuments`;
    if (search) {
      sqlText += ` WHERE Title LIKE @search OR DocumentType LIKE @search`;
      request.input('search', sql.NVarChar(sql.MAX), `%${search}%`);
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

    await poolConnect;
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