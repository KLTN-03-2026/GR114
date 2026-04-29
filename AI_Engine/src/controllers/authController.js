const { sql, pool, poolConnect, isDbReady } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const jwtSecret = () => String(process.env.JWT_SECRET || process.env.LEGAI_JWT_SECRET || 'legai-dev-secret');

const signToken = (user) => jwt.sign(
  { sub: user.id, email: user.email, role: user.role },
  jwtSecret(),
  { expiresIn: '7d' }
);

const isBcryptHash = (value) => typeof value === 'string' && value.startsWith('$2');

const canUseDb = async () => {
  await poolConnect;
  if (!isDbReady()) return false;
  try {
    await pool.request().query('SELECT 1 AS Ok');
    return true;
  } catch {
    return false;
  }
};

/**
 * POST /auth/register
 * body: { email, password, fullName }
 */
exports.register = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    if (!(await canUseDb())) {
      return res.status(503).json({ success: false, message: 'SQL Server chưa sẵn sàng. Vui lòng bật SQL Server và thử lại.' });
    }
    const request = pool.request();
    request.input('Email', sql.NVarChar(320), email);
    const hashedPassword = await bcrypt.hash(String(password), 10);
    request.input('Password', sql.NVarChar(sql.MAX), hashedPassword);
    request.input('FullName', sql.NVarChar(200), fullName || null);
    request.input('Role', sql.NVarChar(20), 'USER');

    const insertSql = `
      INSERT INTO dbo.Users (Email, Password, FullName, Role)
      OUTPUT INSERTED.Id, INSERTED.Email, INSERTED.FullName, INSERTED.Role
      VALUES (@Email, @Password, @FullName, @Role)
    `;

    const result = await request.query(insertSql);
    const user = result.recordset[0];
    const normalizedUser = {
      id: user.Id,
      email: user.Email,
      fullName: user.FullName,
      role: user.Role
    };
    const token = signToken(normalizedUser);
    return res.json({ success: true, user: normalizedUser, token });
  } catch (err) {
    console.error('Auth Register Error:', err);
    if (err.number === 2627) { // unique constraint
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /auth/login
 * body: { email, password }
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    if (!(await canUseDb())) {
      return res.status(503).json({ success: false, message: 'SQL Server chưa sẵn sàng. Vui lòng bật SQL Server và thử lại.' });
    }
    const request = pool.request();
    request.input('Email', sql.NVarChar(320), email);

    const selectSql = `SELECT Id, Email, Password, FullName, Role FROM dbo.Users WHERE Email = @Email`;
    const result = await request.query(selectSql);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const userRow = result.recordset[0];
    const storedPassword = userRow.Password;
    const plain = String(password);
    let ok = false;
    if (isBcryptHash(storedPassword)) {
      ok = await bcrypt.compare(plain, storedPassword);
    } else {
      ok = String(storedPassword) === plain;
      if (ok) {
        try {
          const nextHash = await bcrypt.hash(plain, 10);
          const upd = pool.request();
          upd.input('Id', sql.Int, userRow.Id);
          upd.input('Password', sql.NVarChar(sql.MAX), nextHash);
          await upd.query('UPDATE dbo.Users SET Password = @Password WHERE Id = @Id');
        } catch {
        }
      }
    }
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const user = {
      id: userRow.Id,
      email: userRow.Email,
      role: userRow.Role,
      fullName: userRow.FullName
    };

    const token = signToken(user);
    return res.json({ success: true, user, token });
  } catch (err) {
    console.error('Auth Login Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
