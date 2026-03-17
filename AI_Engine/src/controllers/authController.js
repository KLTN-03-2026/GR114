const { sql, pool, poolConnect } = require('../config/db');

/**
 * POST /auth/register
 * body: { email, password, fullName }
 */
exports.register = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    await poolConnect;
    const request = pool.request();
    request.input('Email', sql.NVarChar(320), email);
    request.input('Password', sql.NVarChar(sql.MAX), password); // plain text per demo request
    request.input('FullName', sql.NVarChar(200), fullName || null);
    request.input('Role', sql.NVarChar(20), 'USER');

    const insertSql = `
      INSERT INTO dbo.Users (Email, Password, FullName, Role)
      OUTPUT INSERTED.Id, INSERTED.Email, INSERTED.FullName, INSERTED.Role
      VALUES (@Email, @Password, @FullName, @Role)
    `;

    const result = await request.query(insertSql);
    const user = result.recordset[0];
    return res.json({ success: true, user });
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

    await poolConnect;
    const request = pool.request();
    request.input('Email', sql.NVarChar(320), email);

    const selectSql = `SELECT Id, Email, Password, FullName, Role FROM dbo.Users WHERE Email = @Email`;
    const result = await request.query(selectSql);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const userRow = result.recordset[0];
    if (userRow.Password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = {
      id: userRow.Id,
      email: userRow.Email,
      role: userRow.Role,
      fullName: userRow.FullName
    };

    return res.json({ success: true, user });
  } catch (err) {
    console.error('Auth Login Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};