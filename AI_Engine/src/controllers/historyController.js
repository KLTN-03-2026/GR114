const { sql, pool, poolConnect, isDbReady } = require('../config/db');
const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLibDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const { pathToFileURL } = require('url');

let contractHistoryColumnsCache = null;
const memoryState = global.__legaiMemoryState || (global.__legaiMemoryState = {
  history: [],
  nextId: 1
});

const getNowIso = () => new Date().toISOString();

const purgeMemoryHistory = () => {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  memoryState.history = memoryState.history.filter((item) => {
    if (!item.DeletedAt) return true;
    return new Date(item.DeletedAt).getTime() >= cutoff;
  });
};

const canUseDb = async () => {
  await poolConnect;
  return isDbReady();
};

const createMemoryRecord = ({ userId, fileName, originalFileName, riskScore, mergedJson, contractText }) => {
  const now = getNowIso();
  const record = {
    Id: memoryState.nextId++,
    UserId: Number(userId),
    FileName: fileName,
    OriginalFileName: originalFileName || fileName,
    UploadedAt: now,
    AnalysisAt: now,
    RiskScore: riskScore ?? null,
    AnalysisJson: mergedJson,
    AnalysisText: contractText || '',
    ContractText: contractText || '',
    IsFinal: 1,
    CreatedAt: now,
    UpdatedAt: null,
    DeletedAt: null
  };
  memoryState.history.unshift(record);
  purgeMemoryHistory();
  return record;
};

const findMemoryRecord = (id) => memoryState.history.find((item) => String(item.Id) === String(id));

const mergeAnalysisMeta = (analysisJsonText, metaPatch) => {
  const parsed = safeJsonParse(analysisJsonText) || {};
  return JSON.stringify({
    ...parsed,
    meta: {
      ...(parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {}),
      ...metaPatch
    }
  });
};

const getContractHistoryColumns = async () => {
  if (!(await canUseDb())) return new Set();
  if (contractHistoryColumnsCache) return contractHistoryColumnsCache;
  const request = pool.request();
  const result = await request.query(`
    SELECT c.name
    FROM sys.columns c
    INNER JOIN sys.objects o ON o.object_id = c.object_id
    WHERE o.object_id = OBJECT_ID(N'dbo.ContractHistory')
  `);
  contractHistoryColumnsCache = new Set((result.recordset || []).map((r) => r.name));
  return contractHistoryColumnsCache;
};

const ensureContractHistoryColumns = async () => {
  if (!(await canUseDb())) return;
  const request = pool.request();
  await request.query(`
    IF COL_LENGTH('dbo.ContractHistory', 'ContractText') IS NULL
      ALTER TABLE dbo.ContractHistory ADD ContractText nvarchar(max) NULL;

    IF COL_LENGTH('dbo.ContractHistory', 'AnalysisText') IS NULL
      ALTER TABLE dbo.ContractHistory ADD AnalysisText nvarchar(max) NULL;

    IF COL_LENGTH('dbo.ContractHistory', 'DeletedAt') IS NULL
      ALTER TABLE dbo.ContractHistory ADD DeletedAt datetime2(7) NULL;

    IF COL_LENGTH('dbo.ContractHistory', 'UpdatedAt') IS NULL
      ALTER TABLE dbo.ContractHistory ADD UpdatedAt datetime2(7) NULL;
  `);
  contractHistoryColumnsCache = null;
};

const safeJsonParse = (text) => {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const parsePngDataUrl = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:image\/png;base64,(.+)$/i);
  if (!m) return null;
  try {
    return Buffer.from(m[1], 'base64');
  } catch {
    return null;
  }
};

const parseImageDataUrl = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (!m) return null;
  try {
    return Buffer.from(m[2], 'base64');
  } catch {
    return null;
  }
};

const parseBase64DataUrl = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
  if (!m) return null;
  try {
    return { mimeType: m[1].toLowerCase(), buffer: Buffer.from(m[2], 'base64') };
  } catch {
    return null;
  }
};

const normalizeContractText = (text) => String(text || '')
  .normalize('NFC')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .replace(/\u0000/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const detectOriginalFileKind = (metaHint, dataUrlMimeType) => {
  const hintedMime = String(metaHint?.originalFileMimeType || '').toLowerCase();
  const hintedName = String(metaHint?.originalFileName || '').toLowerCase();
  const mime = String(dataUrlMimeType || '').toLowerCase();

  const isPdf = mime === 'application/pdf'
    || hintedMime === 'application/pdf'
    || hintedName.endsWith('.pdf');

  const isDoc = mime === 'application/msword'
    || hintedMime === 'application/msword'
    || hintedName.endsWith('.doc');

  const isDocx = mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || hintedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || hintedName.endsWith('.docx');

  return { isPdf, isDoc, isDocx };
};

const extractContractTextFromOriginalFile = async (originalFileDataUrl, metaHint) => {
  const originalFile = parseBase64DataUrl(originalFileDataUrl);
  if (!originalFile?.buffer || originalFile.buffer.length === 0) return '';

  const { isPdf, isDoc, isDocx } = detectOriginalFileKind(metaHint, originalFile.mimeType);

  try {
    if (isDocx) {
      const r = await mammoth.extractRawText({ buffer: originalFile.buffer });
      return normalizeContractText(r?.value || '');
    }
    if (isDoc) {
      const pdfBuffer = await convertDocToPdf(originalFile.buffer);
      if (!pdfBuffer || pdfBuffer.length === 0) return '';
      const r = await pdfParse(pdfBuffer);
      return normalizeContractText(r?.text || '');
    }
    if (isPdf) {
      const r = await pdfParse(originalFile.buffer);
      return normalizeContractText(r?.text || '');
    }
  } catch {
  }

  return '';
};

const pickPdfFontPath = () => {
  const candidates = [
    process.env.LEGAI_PDF_FONT,
    'C:\\\\Windows\\\\Fonts\\\\arial.ttf',
    'C:\\\\Windows\\\\Fonts\\\\tahoma.ttf',
    'C:\\\\Windows\\\\Fonts\\\\times.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
  ].filter(Boolean);

  for (const fontPath of candidates) {
    try {
      if (fs.existsSync(fontPath)) return fontPath;
    } catch {
    }
  }
  return null;
};

const pickLibreOfficePath = () => {
  const candidates = [
    process.env.LEGAI_LIBREOFFICE_PATH,
    'C:\\\\Program Files\\\\LibreOffice\\\\program\\\\soffice.exe',
    'C:\\\\Program Files\\\\LibreOffice\\\\program\\\\soffice.com',
    'C:\\\\Program Files (x86)\\\\LibreOffice\\\\program\\\\soffice.exe',
    'C:\\\\Program Files (x86)\\\\LibreOffice\\\\program\\\\soffice.com',
    '/usr/bin/soffice',
    '/usr/local/bin/soffice'
  ].filter(Boolean);

  for (const exePath of candidates) {
    try {
      if (fs.existsSync(exePath)) return exePath;
    } catch {
    }
  }
  return null;
};

const convertDocxToPdf = async (docxBuffer) => {
  const sofficePath = pickLibreOfficePath();
  if (!sofficePath) return null;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legai-docx-'));
  const inputPath = path.join(tmpDir, 'input.docx');
  const outputPath = path.join(tmpDir, 'input.pdf');
  const userProfileDir = path.join(tmpDir, 'lo-profile');

  try {
    fs.mkdirSync(userProfileDir, { recursive: true });
    fs.writeFileSync(inputPath, docxBuffer);
    const userInstallation = pathToFileURL(`${userProfileDir}${path.sep}`).toString();
    await new Promise((resolve, reject) => {
      const p = spawn(sofficePath, [
        '--headless',
        '--nologo',
        '--nofirststartwizard',
        '--invisible',
        `-env:UserInstallation=${userInstallation}`,
        '--convert-to',
        'pdf',
        '--outdir',
        tmpDir,
        inputPath
      ], {
        windowsHide: true
      });
      let stderr = '';
      p.stderr.on('data', (d) => {
        stderr += String(d);
      });
      p.on('error', reject);
      p.on('exit', (code) => {
        if (code === 0) return resolve();
        reject(new Error(stderr || `LibreOffice convert failed (${code})`));
      });
    });

    if (!fs.existsSync(outputPath)) return null;
    return fs.readFileSync(outputPath);
  } catch {
    return null;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
    }
  }
};

const convertDocToPdf = async (docBuffer) => {
  const sofficePath = pickLibreOfficePath();
  if (!sofficePath) return null;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legai-doc-'));
  const inputPath = path.join(tmpDir, 'input.doc');
  const outputPath = path.join(tmpDir, 'input.pdf');
  const userProfileDir = path.join(tmpDir, 'lo-profile');

  try {
    fs.mkdirSync(userProfileDir, { recursive: true });
    fs.writeFileSync(inputPath, docBuffer);
    const userInstallation = pathToFileURL(`${userProfileDir}${path.sep}`).toString();
    await new Promise((resolve, reject) => {
      const p = spawn(sofficePath, [
        '--headless',
        '--nologo',
        '--nofirststartwizard',
        '--invisible',
        `-env:UserInstallation=${userInstallation}`,
        '--convert-to',
        'pdf',
        '--outdir',
        tmpDir,
        inputPath
      ], {
        windowsHide: true
      });
      let stderr = '';
      p.stderr.on('data', (d) => {
        stderr += String(d);
      });
      p.on('error', reject);
      p.on('exit', (code) => {
        if (code === 0) return resolve();
        reject(new Error(stderr || `LibreOffice convert failed (${code})`));
      });
    });

    if (!fs.existsSync(outputPath)) return null;
    return fs.readFileSync(outputPath);
  } catch {
    return null;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
    }
  }
};

const drawDecorations = (doc, pageNumber, fontName) => {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const marginLeft = doc.page.margins.left;
  const marginRight = doc.page.margins.right;

  doc.save();
  if (fontName) doc.font(fontName);
  doc.opacity(0.08);
  doc.fillColor('#000000');
  doc.fontSize(44);
  doc.rotate(-30, { origin: [pageWidth / 2, pageHeight / 2] });
  doc.text('Generated by LegAI', 0, pageHeight / 2 - 30, { width: pageWidth, align: 'center' });
  doc.restore();

  doc.save();
  if (fontName) doc.font(fontName);
  doc.opacity(1);
  doc.fillColor('#6b7280');
  doc.fontSize(9);
  doc.text(
    `Generated by LegAI - Trang ${pageNumber}`,
    marginLeft,
    pageHeight - 28,
    { width: pageWidth - marginLeft - marginRight, align: 'center' }
  );
  doc.restore();
};

const appendSignaturePageToPdfBuffer = async (pdfBuffer, signatureA, signatureB) => {
  if (!pdfBuffer || pdfBuffer.length === 0) return pdfBuffer;
  const hasSig = Boolean(signatureA?.buffer?.length) || Boolean(signatureB?.buffer?.length);
  if (!hasSig) return pdfBuffer;

  const pdfDoc = await PDFLibDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const page = pages[pages.length - 1];
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const margin = Math.max(24, Math.min(60, pageWidth * 0.06));
  const gap = Math.max(18, Math.min(40, pageWidth * 0.05));
  const boxHeight = Math.max(70, Math.min(120, pageHeight * 0.13));
  const boxWidth = (pageWidth - margin * 2 - gap) / 2;
  const boxY = Math.max(24, margin);
  const boxAX = margin;
  const boxBX = margin + boxWidth + gap;

  const embedAndDrawSignature = async (sig, x) => {
    if (!sig?.buffer?.length) return;
    const mime = String(sig.mimeType || '').toLowerCase();
    const image = mime === 'image/png'
      ? await pdfDoc.embedPng(sig.buffer)
      : await pdfDoc.embedJpg(sig.buffer);
    const iw = image.width;
    const ih = image.height;
    const maxW = boxWidth - 18;
    const maxH = boxHeight - 18;
    const scale = Math.min(maxW / iw, maxH / ih);
    const w = iw * scale;
    const h = ih * scale;
    const ix = x + (boxWidth - w) / 2;
    const iy = boxY + (boxHeight - h) / 2;
    page.drawRectangle({
      x,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      color: rgb(1, 1, 1)
    });
    page.drawImage(image, { x: ix, y: iy, width: w, height: h });
  };

  await embedAndDrawSignature(signatureA, boxAX);
  await embedAndDrawSignature(signatureB, boxBX);

  const out = await pdfDoc.save();
  return Buffer.from(out);
};

// 1. Lưu kết quả phân tích
exports.saveAnalysis = async (req, res) => {
  try {
    const { userId, fileName, originalFileName, riskScore, content, contractText, meta } = req.body;
    if (!userId || !fileName) return res.status(400).json({ success: false, message: 'userId and fileName required' });

    const existingJson = safeJsonParse(content) || {};
    const normalizedMeta = meta && typeof meta === 'object' ? meta : {};
    const mergedJson = JSON.stringify({
      ...existingJson,
      meta: {
        ...(existingJson.meta && typeof existingJson.meta === 'object' ? existingJson.meta : {}),
        ...normalizedMeta
      }
    });

    let effectiveContractText = typeof contractText === 'string' ? contractText : '';
    if (!effectiveContractText || !effectiveContractText.trim()) {
      const derived = await extractContractTextFromOriginalFile(normalizedMeta.originalFileDataUrl, normalizedMeta);
      if (derived) effectiveContractText = derived;
    }

    if (!(await canUseDb())) {
      const record = createMemoryRecord({ userId, fileName, originalFileName, riskScore, mergedJson, contractText: effectiveContractText });
      return res.json({ success: true, analysis: record });
    }

    await ensureContractHistoryColumns();
    const request = pool.request();
    request.input('UserId', sql.BigInt, userId);
    request.input('FileName', sql.NVarChar(260), fileName);
    request.input('OriginalFileName', sql.NVarChar(260), originalFileName ?? null);
    request.input('RiskScore', sql.Int, riskScore ?? null);
    request.input('AnalysisJson', sql.NVarChar(sql.MAX), content ?? null);
    request.input('ContractText', sql.NVarChar(sql.MAX), effectiveContractText ? normalizeContractText(effectiveContractText) : null);
    request.input('AnalysisAt', sql.DateTime2, new Date());
    request.input('NowUtc', sql.DateTime2, new Date());
    request.input('MergedJson', sql.NVarChar(sql.MAX), mergedJson);

    const columns = await getContractHistoryColumns();
    const hasContractText = columns.has('AnalysisText') || columns.has('ContractText');
    const contractTextColumn = columns.has('ContractText') ? 'ContractText' : 'AnalysisText';

    const insertColumns = ['UserId', 'FileName', 'AnalysisAt', 'RiskScore', 'AnalysisJson', 'CreatedAt'];
    const insertValues = ['@UserId', '@FileName', '@AnalysisAt', '@RiskScore', '@MergedJson', 'SYSUTCDATETIME()'];

    if (columns.has('OriginalFileName')) {
      insertColumns.splice(2, 0, 'OriginalFileName');
      insertValues.splice(2, 0, '@OriginalFileName');
    }
    if (columns.has('UploadedAt')) {
      insertColumns.splice(2, 0, 'UploadedAt');
      insertValues.splice(2, 0, '@NowUtc');
    }
    if (hasContractText) {
      insertColumns.splice(insertColumns.indexOf('AnalysisJson') + 1, 0, contractTextColumn);
      insertValues.splice(insertValues.indexOf('@MergedJson') + 1, 0, '@ContractText');
    }
    if (columns.has('IsFinal')) {
      insertColumns.push('IsFinal');
      insertValues.push('1');
    }
    if (columns.has('UpdatedAt')) {
      insertColumns.push('UpdatedAt');
      insertValues.push('NULL');
    }
    if (columns.has('DeletedAt')) {
      insertColumns.push('DeletedAt');
      insertValues.push('NULL');
    }

    const insertSql = `
      INSERT INTO dbo.ContractHistory (${insertColumns.join(', ')})
      OUTPUT INSERTED.Id, INSERTED.UserId, INSERTED.FileName, INSERTED.RiskScore, INSERTED.AnalysisAt
      VALUES (${insertValues.join(', ')})
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

    purgeMemoryHistory();
    if (!(await canUseDb())) {
      return res.json({
        success: true,
        data: memoryState.history.filter((item) => String(item.UserId) === String(userId) && !item.DeletedAt)
      });
    }

    await ensureContractHistoryColumns();
    const request = pool.request();
    request.input('UserId', sql.BigInt, userId);

    const columns = await getContractHistoryColumns();
    const hasDeletedAt = columns.has('DeletedAt');

    const selectSql = hasDeletedAt
      ? `SELECT * FROM dbo.ContractHistory WHERE UserId = @UserId AND DeletedAt IS NULL ORDER BY CreatedAt DESC`
      : `SELECT * FROM dbo.ContractHistory WHERE UserId = @UserId ORDER BY CreatedAt DESC`;

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

    if (!(await canUseDb())) {
      const row = findMemoryRecord(id);
      if (!row) return res.status(404).json({ success: false, message: 'Not found' });
      const parsed = safeJsonParse(row.AnalysisJson) || {};
      const meta = parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {};
      const hasText = Boolean(String(row.ContractText || row.AnalysisText || '').trim());
      if (!hasText && meta.originalFileDataUrl) {
        const derived = await extractContractTextFromOriginalFile(meta.originalFileDataUrl, meta);
        if (derived) {
          row.ContractText = derived;
          row.AnalysisText = derived;
          row.UpdatedAt = getNowIso();
        }
      }
      return res.json({ success: true, data: row });
    }

    await ensureContractHistoryColumns();
    const request = pool.request();
    request.input('Id', sql.BigInt, id);

    const sqlText = `SELECT * FROM dbo.ContractHistory WHERE Id = @Id`;
    const result = await request.query(sqlText);

    const row = result.recordset && result.recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });

    const parsed = safeJsonParse(row.AnalysisJson) || {};
    const meta = parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {};
    const hasText = Boolean(String(row.ContractText || row.AnalysisText || '').trim());
    if (!hasText && meta.originalFileDataUrl) {
      const derived = await extractContractTextFromOriginalFile(meta.originalFileDataUrl, meta);
      if (derived) {
        const columns = await getContractHistoryColumns();
        const contractTextColumn = columns.has('ContractText') ? 'ContractText' : (columns.has('AnalysisText') ? 'AnalysisText' : null);
        if (contractTextColumn) {
          const updateReq = pool.request();
          updateReq.input('Id', sql.BigInt, id);
          updateReq.input('Text', sql.NVarChar(sql.MAX), derived);
          await updateReq.query(`UPDATE dbo.ContractHistory SET ${contractTextColumn} = @Text, UpdatedAt = SYSUTCDATETIME() WHERE Id = @Id`);
          row[contractTextColumn] = derived;
        }
      }
    }

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

    if (!(await canUseDb())) {
      const row = findMemoryRecord(id);
      if (!row || row.DeletedAt) return res.status(404).json({ success: false, message: 'Not found or already deleted' });
      row.DeletedAt = getNowIso();
      row.UpdatedAt = getNowIso();
      purgeMemoryHistory();
      return res.json({ success: true });
    }

    await ensureContractHistoryColumns();
    const request = pool.request();
    request.input('Id', sql.BigInt, id);

    const columns = await getContractHistoryColumns();
    const hasDeletedAt = columns.has('DeletedAt');

    const deleteSql = hasDeletedAt
      ? `UPDATE dbo.ContractHistory SET DeletedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME() WHERE Id = @Id AND DeletedAt IS NULL`
      : `DELETE FROM dbo.ContractHistory WHERE Id = @Id`;

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

exports.getTrash = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    purgeMemoryHistory();
    if (!(await canUseDb())) {
      return res.json({
        success: true,
        data: memoryState.history.filter((item) => String(item.UserId) === String(userId) && item.DeletedAt)
      });
    }

    await ensureContractHistoryColumns();
    const request = pool.request();
    request.input('UserId', sql.BigInt, userId);

    const columns = await getContractHistoryColumns();
    if (!columns.has('DeletedAt')) return res.json({ success: true, data: [] });

    const sqlText = `SELECT * FROM dbo.ContractHistory WHERE UserId = @UserId AND DeletedAt IS NOT NULL ORDER BY DeletedAt DESC`;
    const result = await request.query(sqlText);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('Get Trash Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.restoreHistory = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'id required' });

    if (!(await canUseDb())) {
      const row = findMemoryRecord(id);
      if (!row) return res.status(404).json({ success: false, message: 'Not found' });
      row.DeletedAt = null;
      row.UpdatedAt = getNowIso();
      return res.json({ success: true });
    }

    await ensureContractHistoryColumns();
    const request = pool.request();
    request.input('Id', sql.BigInt, id);

    const columns = await getContractHistoryColumns();
    if (!columns.has('DeletedAt')) return res.status(400).json({ success: false, message: 'Soft delete not supported' });

    const sqlText = `UPDATE dbo.ContractHistory SET DeletedAt = NULL, UpdatedAt = SYSUTCDATETIME() WHERE Id = @Id`;
    const result = await request.query(sqlText);
    const affected = result.rowsAffected && result.rowsAffected[0];
    if (!affected || affected === 0) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('Restore Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.purgeHistory = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'id required' });

    if (!(await canUseDb())) {
      const before = memoryState.history.length;
      memoryState.history = memoryState.history.filter((item) => String(item.Id) !== String(id));
      if (before === memoryState.history.length) return res.status(404).json({ success: false, message: 'Not found' });
      return res.json({ success: true });
    }

    const request = pool.request();
    request.input('Id', sql.BigInt, id);

    const sqlText = `DELETE FROM dbo.ContractHistory WHERE Id = @Id`;
    const result = await request.query(sqlText);
    const affected = result.rowsAffected && result.rowsAffected[0];
    if (!affected || affected === 0) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('Purge Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateHistoryMeta = async (req, res) => {
  try {
    const id = req.params.id;
    const { title, category, description, signaturePlacement, pagesImages, pagesOriginalNames } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'id required' });

    const isValidBox = (box) => {
      if (!box || typeof box !== 'object') return false;
      const { x, y, w, h } = box;
      const nums = [x, y, w, h];
      if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return false;
      if (x < 0 || y < 0 || w <= 0 || h <= 0) return false;
      if (x > 1 || y > 1 || w > 1 || h > 1) return false;
      if (x + w > 1.001 || y + h > 1.001) return false;
      return true;
    };

    const isValidPlacement = (placement) => {
      if (!placement || typeof placement !== 'object') return false;
      const pageIndex = placement.pageIndex;
      if (typeof pageIndex !== 'number' || !Number.isFinite(pageIndex) || pageIndex < 0) return false;
      if (!isValidBox(placement.a) || !isValidBox(placement.b)) return false;
      return true;
    };

    const metaPatch = {
      ...(title !== undefined ? { title } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(description !== undefined ? { description } : {})
    };

    if (signaturePlacement !== undefined) {
      if (!isValidPlacement(signaturePlacement)) {
        return res.status(400).json({ success: false, message: 'signaturePlacement invalid' });
      }
      metaPatch.signaturePlacement = signaturePlacement;
    }

    if (pagesImages !== undefined) {
      if (!Array.isArray(pagesImages) || pagesImages.length === 0 || pagesImages.length > 30) {
        return res.status(400).json({ success: false, message: 'pagesImages must be an array (1-30 items)' });
      }
      const ok = pagesImages.every((s) => typeof s === 'string' && s.length <= 3_000_000 && Boolean(parseImageDataUrl(s)));
      if (!ok) {
        return res.status(400).json({ success: false, message: 'pagesImages must be PNG/JPEG data URLs' });
      }
      metaPatch.pagesImages = pagesImages;
    }

    if (pagesOriginalNames !== undefined) {
      if (!Array.isArray(pagesOriginalNames) || pagesOriginalNames.length > 30) {
        return res.status(400).json({ success: false, message: 'pagesOriginalNames must be an array (<=30 items)' });
      }
      const ok = pagesOriginalNames.every((s) => typeof s === 'string' && s.length <= 260);
      if (!ok) {
        return res.status(400).json({ success: false, message: 'pagesOriginalNames invalid' });
      }
      metaPatch.pagesOriginalNames = pagesOriginalNames;
    }

    if (!(await canUseDb())) {
      const row = findMemoryRecord(id);
      if (!row) return res.status(404).json({ success: false, message: 'Not found' });
      row.AnalysisJson = mergeAnalysisMeta(row.AnalysisJson, metaPatch);
      row.UpdatedAt = getNowIso();
      return res.json({ success: true });
    }

    const request = pool.request();
    request.input('Id', sql.BigInt, id);

    const current = await request.query(`SELECT AnalysisJson FROM dbo.ContractHistory WHERE Id = @Id`);
    const row = current.recordset && current.recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });

    const nextJson = mergeAnalysisMeta(row.AnalysisJson, metaPatch);

    const updateReq = pool.request();
    updateReq.input('Id', sql.BigInt, id);
    updateReq.input('NextJson', sql.NVarChar(sql.MAX), nextJson);
    const result = await updateReq.query(`UPDATE dbo.ContractHistory SET AnalysisJson = @NextJson, UpdatedAt = SYSUTCDATETIME() WHERE Id = @Id`);
    const affected = result.rowsAffected && result.rowsAffected[0];
    if (!affected || affected === 0) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('Update Meta Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateHistorySignatures = async (req, res) => {
  try {
    const id = req.params.id;
    const { signatureADataUrl, signatureBDataUrl } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'id required' });

    if (signatureADataUrl !== undefined && signatureADataUrl !== null && !parseImageDataUrl(signatureADataUrl)) {
      return res.status(400).json({ success: false, message: 'signatureADataUrl must be a PNG/JPEG data URL' });
    }
    if (signatureBDataUrl !== undefined && signatureBDataUrl !== null && !parseImageDataUrl(signatureBDataUrl)) {
      return res.status(400).json({ success: false, message: 'signatureBDataUrl must be a PNG/JPEG data URL' });
    }

    if (!(await canUseDb())) {
      const row = findMemoryRecord(id);
      if (!row) return res.status(404).json({ success: false, message: 'Not found' });
      row.AnalysisJson = mergeAnalysisMeta(row.AnalysisJson, {
        ...(signatureADataUrl !== undefined ? { signatureADataUrl } : {}),
        ...(signatureBDataUrl !== undefined ? { signatureBDataUrl } : {})
      });
      row.UpdatedAt = getNowIso();
      return res.json({ success: true });
    }

    const request = pool.request();
    request.input('Id', sql.BigInt, id);
    const current = await request.query(`SELECT AnalysisJson FROM dbo.ContractHistory WHERE Id = @Id`);
    const row = current.recordset && current.recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });

    const nextJson = mergeAnalysisMeta(row.AnalysisJson, {
      ...(signatureADataUrl !== undefined ? { signatureADataUrl } : {}),
      ...(signatureBDataUrl !== undefined ? { signatureBDataUrl } : {})
    });

    const updateReq = pool.request();
    updateReq.input('Id', sql.BigInt, id);
    updateReq.input('NextJson', sql.NVarChar(sql.MAX), nextJson);
    const result = await updateReq.query(`UPDATE dbo.ContractHistory SET AnalysisJson = @NextJson, UpdatedAt = SYSUTCDATETIME() WHERE Id = @Id`);
    const affected = result.rowsAffected && result.rowsAffected[0];
    if (!affected || affected === 0) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('Update Signatures Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportPdf = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'id required' });

    let record = null;
    if (!(await canUseDb())) {
      record = findMemoryRecord(id);
    } else {
      await ensureContractHistoryColumns();
      const request = pool.request();
      request.input('Id', sql.BigInt, id);
      const result = await request.query(`SELECT * FROM dbo.ContractHistory WHERE Id = @Id`);
      record = result.recordset && result.recordset[0];
    }
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });

    const parsed = safeJsonParse(record.AnalysisJson) || {};
    const meta = parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {};
    const contractText = record.ContractText || record.AnalysisText || '';
    const signatureADataUrl = req.body?.signatureADataUrl || meta.signatureADataUrl;
    const signatureBDataUrl = req.body?.signatureBDataUrl || meta.signatureBDataUrl;
    const signatureA = parseImageDataUrl(signatureADataUrl);
    const signatureB = parseImageDataUrl(signatureBDataUrl);
    const signatureAInfo = parseBase64DataUrl(signatureADataUrl);
    const signatureBInfo = parseBase64DataUrl(signatureBDataUrl);
    const normalizedSigAInfo = signatureAInfo && (signatureAInfo.mimeType === 'image/png' || signatureAInfo.mimeType === 'image/jpeg' || signatureAInfo.mimeType === 'image/jpg')
      ? { ...signatureAInfo, mimeType: signatureAInfo.mimeType === 'image/jpg' ? 'image/jpeg' : signatureAInfo.mimeType }
      : null;
    const normalizedSigBInfo = signatureBInfo && (signatureBInfo.mimeType === 'image/png' || signatureBInfo.mimeType === 'image/jpeg' || signatureBInfo.mimeType === 'image/jpg')
      ? { ...signatureBInfo, mimeType: signatureBInfo.mimeType === 'image/jpg' ? 'image/jpeg' : signatureBInfo.mimeType }
      : null;

    const originalFile = parseBase64DataUrl(meta.originalFileDataUrl);
    if (originalFile?.buffer && originalFile.buffer.length > 0) {
      const { isPdf, isDoc, isDocx } = detectOriginalFileKind(meta, originalFile.mimeType);

      if (isPdf) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="LegAI_${record.Id}.pdf"`);
        const outBuffer = await appendSignaturePageToPdfBuffer(originalFile.buffer, normalizedSigAInfo, normalizedSigBInfo);
        return res.end(outBuffer);
      }

      if (isDoc) {
        if (!pickLibreOfficePath()) {
          return res.status(409).json({
            success: false,
            message: 'Không tìm thấy LibreOffice (soffice). Cài LibreOffice hoặc đặt LEGAI_LIBREOFFICE_PATH để chuyển DOC -> PDF giữ nguyên định dạng.'
          });
        }
        const pdfBuffer = await convertDocToPdf(originalFile.buffer);
        if (pdfBuffer && pdfBuffer.length > 0) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="LegAI_${record.Id}.pdf"`);
          const outBuffer = await appendSignaturePageToPdfBuffer(pdfBuffer, normalizedSigAInfo, normalizedSigBInfo);
          return res.end(outBuffer);
        }
        return res.status(500).json({ success: false, message: 'Chuyển đổi DOC -> PDF thất bại.' });
      }

      if (isDocx) {
        if (!pickLibreOfficePath()) {
          return res.status(409).json({
            success: false,
            message: 'Không tìm thấy LibreOffice (soffice). Cài LibreOffice hoặc đặt LEGAI_LIBREOFFICE_PATH để chuyển DOCX -> PDF giữ nguyên định dạng.'
          });
        }
        const pdfBuffer = await convertDocxToPdf(originalFile.buffer);
        if (pdfBuffer && pdfBuffer.length > 0) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="LegAI_${record.Id}.pdf"`);
          const outBuffer = await appendSignaturePageToPdfBuffer(pdfBuffer, normalizedSigAInfo, normalizedSigBInfo);
          return res.end(outBuffer);
        }
        return res.status(500).json({ success: false, message: 'Chuyển đổi DOCX -> PDF thất bại.' });
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="LegAI_${record.Id}.pdf"`);

    const pageImages = Array.isArray(meta.pagesImages) ? meta.pagesImages : [];
    const hasPageImages = pageImages.length > 0;

    const doc = new PDFDocument({ size: 'A4', margin: hasPageImages ? 0 : 50, bufferPages: true });
    doc.pipe(res);

    const fontPath = pickPdfFontPath();
    const fontName = fontPath ? 'LegAIFont' : null;
    if (fontPath) {
      doc.registerFont(fontName, fontPath);
      doc.font(fontName);
    }
    doc.on('pageAdded', () => {
      if (fontName) doc.font(fontName);
    });

    if (hasPageImages) {
      const placeSignatureFixed = (sigBuf, box) => {
        if (!sigBuf) return;
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const x = Math.max(0, Math.min(pageWidth, box.x * pageWidth));
        const y = Math.max(0, Math.min(pageHeight, box.y * pageHeight));
        const w = Math.max(1, Math.min(pageWidth, box.w * pageWidth));
        const h = Math.max(1, Math.min(pageHeight, box.h * pageHeight));
        doc.save();
        doc.fillColor('#ffffff');
        doc.rect(x, y, w, h).fill();
        doc.restore();
        doc.image(sigBuf, x, y, { fit: [w, h], align: 'center', valign: 'center' });
      };

      for (let pageIdx = 0; pageIdx < pageImages.length; pageIdx += 1) {
        if (pageIdx > 0) {
          doc.addPage({ size: 'A4', margin: 0 });
        }
        const pageBuf = parseImageDataUrl(pageImages[pageIdx]);
        if (pageBuf) {
          doc.image(pageBuf, 0, 0, { fit: [doc.page.width, doc.page.height], align: 'center', valign: 'center' });
        }

        if (pageIdx === pageImages.length - 1) {
          placeSignatureFixed(signatureA, { x: 0.14, y: 0.80, w: 0.30, h: 0.12 });
          placeSignatureFixed(signatureB, { x: 0.56, y: 0.80, w: 0.30, h: 0.12 });
        }
      }
    } else {
      if (fontName) doc.font(fontName);
      doc.fillColor('#111827');
      doc.fontSize(18).text(meta.title || record.FileName || `Hồ sơ #${record.Id}`, { align: 'left' });
      doc.moveDown(0.3);
      doc.fillColor('#6b7280');
      doc.fontSize(10).text(
        `Ngày tạo: ${record.CreatedAt ? new Date(record.CreatedAt).toLocaleString('vi-VN') : ''}`,
        { align: 'left' }
      );
      if (meta.category) {
        doc.text(`Danh mục: ${meta.category}`, { align: 'left' });
      }
      if (meta.description) {
        doc.text(`Mô tả: ${meta.description}`, { align: 'left' });
      }
      doc.moveDown(1);

      doc.fillColor('#111827');
      doc.fontSize(14).text('Nội dung hợp đồng', { align: 'left' });
      doc.moveDown(0.5);
      doc.fillColor('#111827');
      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const normalizedContractText = String(contractText || '(Chưa có nội dung hợp đồng được lưu)')
        .normalize('NFC')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\u0000/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n');
      doc.fontSize(11).text(normalizedContractText, {
        width: contentWidth,
        align: 'left',
        lineGap: 2,
        paragraphGap: 4
      });

      const signatureBlockHeight = 160;
      if (doc.y > doc.page.height - signatureBlockHeight - 60) {
        doc.addPage();
      } else {
        doc.moveDown(1);
      }

      const startY = doc.y;
      const leftX = doc.page.margins.left;
      const colWidth = (contentWidth - 40) / 2;
      const sigMaxWidth = colWidth;
      const sigMaxHeight = 90;

      doc.fillColor('#111827');
      doc.fontSize(12).text('BÊN A', leftX, startY, { width: colWidth, align: 'center' });
      doc.text('BÊN B', leftX + colWidth + 40, startY, { width: colWidth, align: 'center' });

      const sigY = startY + 18;
      if (signatureA) {
        doc.save();
        doc.fillColor('#ffffff');
        doc.rect(leftX + 10, sigY, sigMaxWidth - 20, sigMaxHeight).fill();
        doc.restore();
        doc.image(signatureA, leftX + 10, sigY, { fit: [sigMaxWidth - 20, sigMaxHeight], align: 'center' });
      } else {
        doc.rect(leftX + 10, sigY, sigMaxWidth - 20, sigMaxHeight).dash(4, { space: 4 }).strokeColor('#9ca3af').stroke().undash();
      }
      if (signatureB) {
        doc.save();
        doc.fillColor('#ffffff');
        doc.rect(leftX + colWidth + 50, sigY, sigMaxWidth - 20, sigMaxHeight).fill();
        doc.restore();
        doc.image(signatureB, leftX + colWidth + 50, sigY, { fit: [sigMaxWidth - 20, sigMaxHeight], align: 'center' });
      } else {
        doc.rect(leftX + colWidth + 50, sigY, sigMaxWidth - 20, sigMaxHeight).dash(4, { space: 4 }).strokeColor('#9ca3af').stroke().undash();
      }

      doc.moveDown(7);
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      drawDecorations(doc, i + 1, fontName);
    }

    doc.end();
  } catch (err) {
    console.error('Export PDF Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
