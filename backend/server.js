const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();

app.use(cors());
app.use(express.json());

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then((pool) => {
    console.log('Connected to MSSQL');
    try {
      pool.__connected = true;
    } catch (_) {}
    return pool;
  })
  .catch((err) => {
    console.error('Database Connection Failed! Bad Config: ', err);
    const dummyPool = {
      __connected: false,
      request: () => {
        const r = {
          input: function () { return r; },
          query: async function () { throw new Error('Database not connected'); },
        };
        return r;
      },
    };
    return dummyPool;
  });
// ─── Validators ───────────────────────────────────────────────────────────────
const usernamePattern = /^[A-Za-z0-9]{4,8}$/;
const passwordPattern = /^[A-Za-z0-9!@#]{4,8}$/;

const validateUsername = (username) => {
  if (!username || !username.trim()) return 'Username is required.';
  if (username.length < 4) return 'Username must be at least 4 characters.';
  if (username.length > 8) return 'Username must be no more than 8 characters.';
  if (!usernamePattern.test(username)) return 'Username can only contain letters and numbers.';
  return null;
};

const validatePassword = (password) => {
  if (!password || !password.trim()) return 'Password is required.';
  if (!passwordPattern.test(password)) return 'Password must be 4–8 characters and can only contain letters, numbers, and ! @ #';
  return null;
};

// ─── Auth: Login ─────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const usernameErr = validateUsername(username);
    if (usernameErr) return res.status(400).json({ message: usernameErr });

    const passwordErr = validatePassword(password);
    if (passwordErr) return res.status(400).json({ message: passwordErr });

    const pool = await poolPromise;
    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .query('SELECT id, username, password FROM Tbl_Users WHERE username = @username');

    const user = result.recordset[0];
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password, phoneNumber } = req.body;

    if (!phoneNumber) return res.status(400).json({ message: 'Phone number is required.' });

    const usernameErr = validateUsername(username);
    if (usernameErr) return res.status(400).json({ message: usernameErr });

    const passwordErr = validatePassword(password);
    if (passwordErr) return res.status(400).json({ message: passwordErr });

    const pool = await poolPromise;
    const existingUser = await pool.request()
      .input('username', sql.VarChar, username)
      .query('SELECT id FROM Tbl_Users WHERE username = @username');

    if (existingUser.recordset.length > 0) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.request()
      .input('username', sql.VarChar, username)
      .input('password', sql.VarChar, hashedPassword)
      .input('phoneNumber', sql.VarChar, phoneNumber)
      .query('INSERT INTO Tbl_Users (username, password, phone_number) VALUES (@username, @password, @phoneNumber)');

    return res.json({ message: 'Account created successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;

    const usernameErr = validateUsername(username);
    if (usernameErr) return res.status(400).json({ message: usernameErr });

    const pool = await poolPromise;
    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .query('SELECT id, phone_number FROM Tbl_Users WHERE username = @username');

    const user = result.recordset[0];
    if (!user) return res.status(404).json({ message: 'User not found.' });

    return res.json({ message: 'Verification code sent', phoneNumber: user.phone_number });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { username, newPassword } = req.body;

    const usernameErr = validateUsername(username);
    if (usernameErr) return res.status(400).json({ message: usernameErr });

    const passwordErr = validatePassword(newPassword);
    if (passwordErr) return res.status(400).json({ message: passwordErr });

    const pool = await poolPromise;
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .input('password', sql.VarChar, hashedPassword)
      .query('UPDATE Tbl_Users SET password = @password WHERE username = @username');

    if (result.rowsAffected[0] === 0) return res.status(404).json({ message: 'User not found.' });

    return res.json({ message: 'Password reset successful' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;

    const usernameErr = validateUsername(username);
    if (usernameErr) return res.status(400).json({ message: usernameErr });

    if (!currentPassword) return res.status(400).json({ message: 'Current password is required.' });

    const passwordErr = validatePassword(newPassword);
    if (passwordErr) return res.status(400).json({ message: passwordErr });

    const pool = await poolPromise;
    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .query('SELECT id, password FROM Tbl_Users WHERE username = @username');

    const user = result.recordset[0];
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) return res.status(401).json({ message: 'Current password is incorrect.' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updateResult = await pool.request()
      .input('username', sql.VarChar, username)
      .input('password', sql.VarChar, hashedPassword)
      .query('UPDATE Tbl_Users SET password = @password WHERE username = @username');

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(500).json({ message: 'Failed to update password.' });
    }

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── Table routes ─────────────────────────────────────────────────────────────
app.get('/api/floors', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`
        SELECT DISTINCT GroupName
        FROM Vw_Tables
        WHERE Enable = 1
        ORDER BY GroupName
      `);

    return res.json({ floors: result.recordset });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/tables', async (req, res) => {
  try {
    const { floor } = req.query;

    if (!floor) return res.status(400).json({ message: 'Floor is required.' });

    const pool = await poolPromise;
    const result = await pool.request()
      .input('floor', sql.VarChar, floor)
      .query(`
        SELECT TableNo, GroupName, Vaccant, ResID, ListingOrder
FROM Vw_Tables
WHERE Enable = 1
  AND GroupName = @floor
ORDER BY ListingOrder
      `);

    return res.json({ tables: result.recordset });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/tables/counts', async (req, res) => {
  try {
    const { floor } = req.query;

    const pool = await poolPromise;
    let request = pool.request();
    let floorClause = '';
    if (floor) {
      request = request.input('floor', sql.VarChar, floor);
      floorClause = ' AND GroupName = @floor';
    }

    const query = `
      SELECT
        (SELECT COUNT(TableNo) FROM Vw_Tables WHERE Vaccant = 'Y' AND Enable = '1' AND (ResID IS NULL OR LTRIM(RTRIM(ResID)) = '') ${floorClause}) AS VaccantCount,
        (SELECT COUNT(TableNo) FROM Vw_Tables WHERE Vaccant = 'N' AND Enable = '1' ${floorClause}) AS OccupiedCount,
        (SELECT COUNT(TableNo) FROM Vw_Tables WHERE Enable = '1' AND ResID IS NOT NULL AND LTRIM(RTRIM(ResID)) <> '' ${floorClause}) AS ReservedCount
    `;

    const result = await request.query(query);

    return res.json(result.recordset[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── Menu/Category routes ─────────────────────────────────────────────────────
app.get('/api/menu/categories', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`
        SELECT DISTINCT 
          Level1 AS Level,
          L1Des AS LDes,
          'C' AS Type,
          '0' AS SalesPrice,
          L1LitingOrder
        FROM Vw_MenuAssignment 
        WHERE DisplayInFront = '1' 
          AND MenuAssiEnable = '1' 
          AND MenuItemEnable = '1' 
        ORDER BY L1LitingOrder
      `);

    // Map your database column keys to your frontend expectation if necessary
    const formattedCategories = result.recordset.map(row => ({
      id: row.Level,
      label: row.LDes,
      type: row.Type,
      price: parseFloat(row.SalesPrice),
      listingOrder: row.L1LitingOrder,
      // Default fallback color if your frontend relies on explicit random UI card colors
      color: '#E3F2FD' 
    }));

    return res.json({ categories: formattedCategories });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/menu/main-categories', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT DISTINCT
          m.Category AS CategoryCode,
          CASE m.Category
              WHEN 'F' THEN 'Foods'
              WHEN 'B' THEN 'Bleverages'
              WHEN 'S' THEN 'Siga'
              WHEN 'O' THEN 'Others'
              ELSE m.Category
          END AS CategoryName
      FROM Vw_MenuAssignment m
      WHERE m.DisplayInFront = '1'
        AND m.MenuAssiEnable = '1'
        AND m.MenuItemEnable = '1'
        AND EXISTS (
          SELECT 1
          FROM Vw_MenuAssignment c
          WHERE c.DisplayInFront = '1'
            AND c.MenuAssiEnable = '1'
            AND c.MenuItemEnable = '1'
            AND c.Category = m.Category
            AND NULLIF(LTRIM(RTRIM(ISNULL(c.L1Des, ''))), '') IS NOT NULL
        )
      ORDER BY
          CASE m.Category
              WHEN 'F' THEN 1
              WHEN 'B' THEN 2
              WHEN 'S' THEN 3
              WHEN 'O' THEN 4
              ELSE 5
          END
    `);

    return res.json({ tabs: result.recordset });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/menu/sub-categories', async (req, res) => {
  try {
    const { category } = req.query;

    if (!category) {
      return res.status(400).json({ message: 'category is required.' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('category', sql.VarChar, String(category).trim())
      .query(`
        SELECT DISTINCT
            Level1 AS Level,
            L1Des AS LDes,
            'C' AS Type,
            '0' AS SalesPrice,
            L1LitingOrder
        FROM Vw_MenuAssignment
        WHERE DisplayInFront = '1'
          AND MenuAssiEnable = '1'
          AND MenuItemEnable = '1'
          AND Category = @category
        ORDER BY L1LitingOrder
      `);

    return res.json({ subCategories: result.recordset });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/remarks/order-descriptions', async (_req, res) => {
  let remarkPool;
  try {
    const remarksDbConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      server: 'DEWAKA\\SQL2008',
      database: 'MMRESTAURANT',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };

    remarkPool = await new sql.ConnectionPool(remarksDbConfig).connect();

    const result = await remarkPool.request().query(`
      SELECT DESCRIPTIONS
      FROM dbo.Tbl_OrderDescriptions
      WHERE Enable = 'True'
      ORDER BY DESCRIPTIONS ASC
    `);

    const descriptions = Array.isArray(result.recordset)
      ? result.recordset
          .map((row) => String(row.DESCRIPTIONS ?? '').trim())
          .filter(Boolean)
      : [];

    return res.json({ ok: true, descriptions });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Failed to load order descriptions.',
      error: error.message,
    });
  } finally {
    if (remarkPool) {
      try {
        await remarkPool.close();
      } catch (_) {}
    }
  }
});


const buildMenuLevelQuery = (intLevel) => {
  if (intLevel === 1) {
    return `
        Select distinct(Level2) As Level, L2Des as LDes,'C' As Type,'0' As SalesPrice from Vw_MenuAssignment  Where DisplayInFront = '1' And MenuAssiEnable='1' And MenuItemEnable = '1' 
        And  Level1= @level1 AND Level2 <>'' 
        UNION 
        Select MenuItemCode,MenuItmDes,'I' As Type,SalesPrice from Vw_MenuAssignment  Where DisplayInFront = '1' And MenuAssiEnable='1' And MenuItemEnable = '1' 
        And  Level1= @level1 AND Level2 ='' 
    `;
  }

  if (intLevel === 2) {
    return `
        Select distinct(Level3) As Level, L3Des as LDes,'C' As Type,'0' As SalesPrice from Vw_MenuAssignment  Where DisplayInFront = '1' And MenuAssiEnable='1' And MenuItemEnable = '1' 
        And  Level1= @level1 And  Level2= @level2 AND Level3 <>''
        UNION 
        Select MenuItemCode,MenuItmDes,'I' As Type,SalesPrice from Vw_MenuAssignment  Where DisplayInFront = '1' And MenuAssiEnable='1' And MenuItemEnable = '1' 
        And  Level1= @level1 And  Level2= @level2 AND Level3 =''
    `;
  }

  if (intLevel === 3) {
    return `
        Select distinct(Level4) As Level, L4Des as LDes,'C' As Type,'0' As SalesPrice from Vw_MenuAssignment  Where DisplayInFront = '1' And MenuAssiEnable='1' And MenuItemEnable = '1' 
        And  Level1= @level1 And  Level2= @level2 And Level3= @level3 AND Level4 <>'' 
        UNION 
        Select MenuItemCode,MenuItmDes,'I' As Type,SalesPrice from Vw_MenuAssignment  Where DisplayInFront = '1' And MenuAssiEnable='1' And MenuItemEnable = '1' 
        And  Level1= @level1 And  Level2= @level2 And Level3= @level3 AND Level4 ='' 
    `;
  }

  if (intLevel === 4) {
    return `
        Select distinct(Level5) As Level, L5Des as LDes,'C' As Type,'0' As SalesPrice from Vw_MenuAssignment  Where DisplayInFront = '1' And MenuAssiEnable='1' And MenuItemEnable = '1' 
        And  Level1= @level1 And  Level2= @level2 And Level3= @level3 And Level4= @level4 AND Level5 <>''
        UNION 
        Select MenuItemCode,MenuItmDes,'I' As Type,SalesPrice from Vw_MenuAssignment  Where DisplayInFront = '1' And MenuAssiEnable='1' And MenuItemEnable = '1' 
        And  Level1= @level1 And  Level2= @level2 And Level3= @level3 And Level4= @level4 AND Level5 =''
    `;
  }

  if (intLevel === 5) {
    return `
        Select distinct(Level6) As Level, L6Des as LDes,'C' As Type,'0' As SalesPrice from Vw_MenuAssignment  Where DisplayInFront = '1' And MenuAssiEnable='1' And MenuItemEnable = '1' 
        And  Level1= @level1 And  Level2= @level2 And Level3= @level3 And Level4= @level4 And Level5= @level5 AND Level6 <>'' 
        UNION 
        Select MenuItemCode,MenuItmDes,'I' As Type,SalesPrice  from Vw_MenuAssignment  Where DisplayInFront = '1' And MenuAssiEnable='1' And MenuItemEnable = '1' 
        And  Level1= @level1 And  Level2= @level2 And Level3= @level3 And Level4= @level4 And Level5= @level5 AND Level6 ='' 
    `;
  }

  if (intLevel === 6) {
    return `
        Select distinct(Level7) As Level, L7Des as LDes,'C' As Type,'0' As SalesPrice from Vw_MenuAssignment  Where DisplayInFront = '1' And MenuAssiEnable='1' And MenuItemEnable = '1' 
        And  Level1= @level1 And  Level2= @level2 And Level3= @level3 And Level4= @level4 And Level5= @level5 And Level6= @level6 AND Level7 <>''
        UNION 
        Select MenuItemCode,MenuItmDes,'I' As Type, SalesPrice  from Vw_MenuAssignment  Where DisplayInFront = '1' And MenuAssiEnable='1' And MenuItemEnable = '1' 
        And  Level1= @level1 And  Level2= @level2 And Level3= @level3 And Level4= @level4 And Level5= @level5 And Level6= @level6 AND Level7 =''
    `;
  }

  if (intLevel === 7) {
    return `
        Select MenuItemCode As Level ,MenuItmDes as LDes,'I' As Type,SalesPrice from Vw_MenuAssignment  Where DisplayInFront = '1' And MenuAssiEnable='1' And MenuItemEnable = '1' 
        And  Level1= @level1 And  Level2= @level2 And  Level3= @level3 And  Level4= @level4 And  Level5= @level5 And  Level6= @level6 And  Level7= @level7  order by LISTINGORDER
    `;
  }

  return '';
};

app.get('/api/menu/level', async (req, res) => {
  try {
    const intLevel = Number(req.query.intLevel);
    const queryText = buildMenuLevelQuery(intLevel);

    if (!queryText) {
      return res.status(400).json({ message: 'intLevel must be between 1 and 7.' });
    }

    const pool = await poolPromise;
    const request = pool.request();

    ['level1', 'level2', 'level3', 'level4', 'level5', 'level6', 'level7'].forEach((key) => {
      if (req.query[key] !== undefined) {
        request.input(key, sql.VarChar, String(req.query[key]).trim());
      }
    });

    const result = await request.query(queryText);

    return res.json({ rows: result.recordset });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});







// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGINT', async () => {
  try {
    await sql.close();
    console.log('MSSQL pool closed (SIGINT)');
    process.exit(0);
  } catch (err) {
    console.error('Error closing MSSQL pool', err);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  try {
    await sql.close();
    console.log('MSSQL pool closed (SIGTERM)');
    process.exit(0);
  } catch (err) {
    console.error('Error closing MSSQL pool', err);
    process.exit(1);
  }
});


// ─── Restaurant POS lifecycle helpers and API controllers ────────────────────
const pickString = (value, maxLength = 50) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().substring(0, maxLength);
};

const pickNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getBearerUserId = (req, fallbackUserId = 'SYSTEM') => {
  const fallback = pickString(fallbackUserId, 50) || 'SYSTEM';
  try {
    const authHeader = (req.get && req.get('authorization')) || req.headers.authorization || '';
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded && typeof decoded === 'object' && decoded.id) {
        return pickString(decoded.id, 50) || fallback;
      }
    }
  } catch (error) {
    console.warn('Bearer token verification failed:', error && error.message ? error.message : error);
  }

  return fallback;
};

const getSqlErrorNumber = (error) => {
  return error?.number
    ?? error?.originalError?.info?.number
    ?? error?.originalError?.number
    ?? error?.precedingErrors?.[0]?.number
    ?? null;
};

const sendSqlError = (res, error, fallbackMessage, validationStatus = 400) => {
  const number = getSqlErrorNumber(error);
  const message = error?.message || fallbackMessage;

  if (number === 50017 || number === 50018 || number === 50019 || number === 50010 || number === 50011 || number === 50012 || number === 50013 || number === 50014 || number === 50015 || number === 50016) {
    return res.status(validationStatus).json({ ok: false, message, errorNumber: number });
  }

  return res.status(500).json({ ok: false, message, errorNumber: number });
};

const executeStoredProcedure = async (procName, inputs = []) => {
  const pool = await poolPromise;
  const request = pool.request();
  for (const input of inputs) {
    request.input(input.name, input.type, input.value);
  }
  return request.execute(procName);
};

// Persist timestamps as Sri Lankan local time (GMT+5:30), independent of host timezone.
const SQL_SRI_LANKA_NOW = 'DATEADD(MINUTE, 330, GETUTCDATE())';

const confirmCartHandler = async (req, res) => {
  try {
    const body = Array.isArray(req.body) ? { items: req.body } : (req.body || {});
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return res.status(400).json({ ok: false, message: 'No items to confirm' });
    }

    const tableNo = pickString(body.tableNo ?? body.TableNo ?? body.TabelNo ?? body.tableName ?? body.TableName, 50);
    const tableGrpId = pickString(body.tableGrpId ?? body.TableGrpId ?? body.TableGrpID ?? body.TabelGrpID ?? body.tableGroupId, 50);
    const userId = getBearerUserId(req, body.userId ?? body.UserID ?? 'SYSTEM');
    const lPax = pickNumber(body.lPax ?? body.LPax ?? 0, 0);
    const fPax = pickNumber(body.fPax ?? body.FPax ?? 0, 0);

    if (!tableNo) {
      return res.status(400).json({ ok: false, message: 'TableNo is required' });
    }

    const normalizedItemsMap = new Map();
    for (const rawItem of items) {
      const itemCode = pickString(rawItem.menuItemCode ?? rawItem.ItemCode ?? rawItem.itemCode, 50);
      const qty = pickNumber(rawItem.quantity ?? rawItem.QTY ?? 0, 0);
      const salesPrice = pickNumber(rawItem.salesPrice ?? rawItem.SalesPrice ?? rawItem.price ?? 0, 0);
      const itemRemarks = pickString(rawItem.itemRemarks ?? rawItem.ItemRemarks ?? '', 500);

      if (!itemCode) {
        return res.status(400).json({ ok: false, message: 'ItemCode is required for each cart item' });
      }

      if (qty <= 0) {
        return res.status(400).json({ ok: false, message: `Quantity must be greater than zero for item ${itemCode}` });
      }

      const current = normalizedItemsMap.get(itemCode);
      if (current) {
        current.QTY += qty;
        current.SalesPrice = salesPrice;
        current.ItemRemarks = itemRemarks;
      } else {
        normalizedItemsMap.set(itemCode, {
          ItemCode: itemCode,
          QTY: qty,
          SalesPrice: salesPrice,
          ItemRemarks: itemRemarks,
        });
      }
    }

    const normalizedItems = [...normalizedItemsMap.values()];
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      for (const item of normalizedItems) {
        const lookupReq = new sql.Request(transaction);
        lookupReq.input('TabelNo', sql.NVarChar(50), tableNo);
        lookupReq.input('ItemCode', sql.NVarChar(50), item.ItemCode);

        const existing = await lookupReq.query(`
          SELECT QTY
          FROM dbo.Tbl_HoldUpsCloud WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
          WHERE TabelNo = @TabelNo
            AND ItemCode = @ItemCode
        `);

        const existingQty = Number(existing.recordset?.[0]?.QTY ?? 0);
        const rowExists = (existing.recordset?.length ?? 0) > 0;

        if (rowExists) {
          const updateReq = new sql.Request(transaction);
          updateReq.input('TabelNo', sql.NVarChar(50), tableNo);
          updateReq.input('ItemCode', sql.NVarChar(50), item.ItemCode);
          updateReq.input('QTY', sql.Float, item.QTY);
          updateReq.input('SalesPrice', sql.Decimal(18, 2), item.SalesPrice);
          updateReq.input('ItemRemarks', sql.NVarChar(500), item.ItemRemarks);
          updateReq.input('UserID', sql.NVarChar(50), userId);
          updateReq.input('TabelGrpID', sql.NVarChar(50), tableGrpId);
          updateReq.input('LPax', sql.Float, lPax);
          updateReq.input('FPax', sql.Float, fPax);

          await updateReq.query(`
            UPDATE dbo.Tbl_HoldUpsCloud
            SET QTY = @QTY,
                SalesPrice = @SalesPrice,
                ItemRemarks = @ItemRemarks,
                UserID = @UserID,
                TabelGrpID = @TabelGrpID,
                LPax = @LPax,
                FPax = @FPax,
                TxnDateTime = ${SQL_SRI_LANKA_NOW}
            WHERE TabelNo = @TabelNo
              AND ItemCode = @ItemCode
          `);
        } else {
          const insertReq = new sql.Request(transaction);
          insertReq.input('TabelNo', sql.NVarChar(50), tableNo);
          insertReq.input('ItemCode', sql.NVarChar(50), item.ItemCode);
          insertReq.input('QTY', sql.Float, item.QTY);
          insertReq.input('SalesPrice', sql.Decimal(18, 2), item.SalesPrice);
          insertReq.input('ItemRemarks', sql.NVarChar(500), item.ItemRemarks);
          insertReq.input('UserID', sql.NVarChar(50), userId);
          insertReq.input('TabelGrpID', sql.NVarChar(50), tableGrpId);
          insertReq.input('LPax', sql.Float, lPax);
          insertReq.input('FPax', sql.Float, fPax);

          await insertReq.query(`
            INSERT INTO dbo.Tbl_HoldUpsCloud
              (TabelNo, ItemCode, QTY, SalesPrice, ItemRemarks, UserID, TabelGrpID, LPax, FPax, TxnDateTime)
            VALUES
              (@TabelNo, @ItemCode, @QTY, @SalesPrice, @ItemRemarks, @UserID, @TabelGrpID, @LPax, @FPax, ${SQL_SRI_LANKA_NOW})
          `);
        }

        // Only audit meaningful cart confirmation changes.
        const deltaQty = rowExists ? (item.QTY - existingQty) : item.QTY;
        if (deltaQty !== 0) {
          const tempReq = new sql.Request(transaction);
          tempReq.input('TabelNo', sql.NVarChar(50), tableNo);
          tempReq.input('UserID', sql.NVarChar(50), userId);
          tempReq.input('ItemCode', sql.NVarChar(50), item.ItemCode);
          tempReq.input('QTY', sql.Float, deltaQty);
          tempReq.input('ItemRemarks', sql.NVarChar(500), item.ItemRemarks);
          tempReq.input('TabelGrpID', sql.NVarChar(50), tableGrpId || null);
          tempReq.input('LPax', sql.Float, lPax);
          tempReq.input('FPax', sql.Float, fPax);
          tempReq.input('SalesPrice', sql.Decimal(18, 2), item.SalesPrice);

          await tempReq.query(`
            INSERT INTO dbo.Tbl_HoldUpsCloudTemp
              (TabelNo, UserID, ItemCode, QTY, ItemRemarks, TabelGrpID, TxnDateTime, LPax, FPax, SalesPrice, AoR, MgrID)
            VALUES
              (@TabelNo, @UserID, @ItemCode, @QTY, @ItemRemarks, @TabelGrpID, ${SQL_SRI_LANKA_NOW}, @LPax, @FPax, @SalesPrice, 'A', '0')
          `);
        }
      }

      await transaction.commit();

      return res.status(200).json({
        ok: true,
        message: 'Cart confirmed successfully',
        data: {
          tableNo,
          itemCount: normalizedItems.length,
        },
      });
    } catch (error) {
      try { await transaction.rollback(); } catch (_) {}
      return sendSqlError(res, error, 'Failed to confirm cart');
    }
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Failed to confirm cart' });
  }
};

const billingAddItemHandler = async (req, res) => {
  try {
    const body = req.body || {};
    const tableNo = pickString(body.tableNo ?? body.TableNo ?? body.TabelNo, 50);
    const userId = getBearerUserId(req, body.userId ?? body.UserID ?? 'SYSTEM');
    const tableGrpId = pickString(body.tableGrpId ?? body.TableGrpID ?? body.TabelGrpID ?? '', 50);
    const lPax = pickNumber(body.lPax ?? body.LPax ?? 0, 0);
    const fPax = pickNumber(body.fPax ?? body.FPax ?? 0, 0);
    const mgrId = pickString(body.mgrId ?? body.MgrID ?? '0', 50) || '0';

    const incomingItems = Array.isArray(body.items)
      ? body.items
      : (body.ItemCode || body.itemCode ? [body] : []);

    const normalizedItems = incomingItems.map((item) => ({
      ItemCode: pickString(item.ItemCode ?? item.itemCode, 50),
      QTY: Math.abs(pickNumber(item.QTY ?? item.qty ?? item.quantity ?? item.delta ?? 0, 0)),
      SalesPrice: pickNumber(item.SalesPrice ?? item.salesPrice ?? 0, 0),
      ItemRemarks: pickString(item.ItemRemarks ?? item.itemRemarks ?? '', 500),
    })).filter((item) => item.ItemCode && item.QTY > 0);

    if (!tableNo) return res.status(400).json({ ok: false, message: 'TabelNo is required.' });
    if (normalizedItems.length === 0) return res.status(400).json({ ok: false, message: 'At least one valid item is required.' });

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      for (const item of normalizedItems) {
        const tempReq = new sql.Request(transaction);
        tempReq.input('TabelNo', sql.NVarChar(50), tableNo);
        tempReq.input('UserID', sql.NVarChar(50), userId);
        tempReq.input('ItemCode', sql.NVarChar(50), item.ItemCode);
        tempReq.input('QTY', sql.Float, item.QTY);
        tempReq.input('SalesPrice', sql.Decimal(18, 2), item.SalesPrice);
        tempReq.input('ItemRemarks', sql.NVarChar(500), item.ItemRemarks);
        tempReq.input('TabelGrpID', sql.NVarChar(50), tableGrpId || null);
        tempReq.input('LPax', sql.Float, lPax);
        tempReq.input('FPax', sql.Float, fPax);
        tempReq.input('MgrID', sql.NVarChar(50), mgrId || '0');

        await tempReq.query(`
          INSERT INTO dbo.Tbl_HoldUpsCloudTemp
            (TabelNo, UserID, ItemCode, QTY, SalesPrice, ItemRemarks, TabelGrpID, LPax, FPax, AoR, TxnDateTime, MgrID)
          VALUES
            (@TabelNo, @UserID, @ItemCode, @QTY, @SalesPrice, @ItemRemarks, @TabelGrpID, @LPax, @FPax, 'A', ${SQL_SRI_LANKA_NOW}, @MgrID)
        `);

        const lookupReq = new sql.Request(transaction);
        lookupReq.input('TabelNo', sql.NVarChar(50), tableNo);
        lookupReq.input('ItemCode', sql.NVarChar(50), item.ItemCode);

        const existing = await lookupReq.query(`
          SELECT QTY
          FROM dbo.Tbl_HoldUpsCloud WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
          WHERE TabelNo = @TabelNo
            AND ItemCode = @ItemCode
        `);

        if (existing.recordset && existing.recordset.length > 0) {
          const updateReq = new sql.Request(transaction);
          updateReq.input('TabelNo', sql.NVarChar(50), tableNo);
          updateReq.input('ItemCode', sql.NVarChar(50), item.ItemCode);
          updateReq.input('QTY', sql.Float, item.QTY);
          updateReq.input('SalesPrice', sql.Decimal(18, 2), item.SalesPrice);
          updateReq.input('ItemRemarks', sql.NVarChar(500), item.ItemRemarks);
          updateReq.input('UserID', sql.NVarChar(50), userId);
          updateReq.input('TabelGrpID', sql.NVarChar(50), tableGrpId);
          updateReq.input('LPax', sql.Float, lPax);
          updateReq.input('FPax', sql.Float, fPax);

          await updateReq.query(`
            UPDATE dbo.Tbl_HoldUpsCloud
            SET QTY = QTY + @QTY,
                SalesPrice = COALESCE(@SalesPrice, SalesPrice),
                ItemRemarks = CASE
                  WHEN NULLIF(LTRIM(RTRIM(@ItemRemarks)), '') IS NULL THEN ItemRemarks
                  WHEN NULLIF(LTRIM(RTRIM(ISNULL(ItemRemarks, ''))), '') IS NULL THEN @ItemRemarks
                  ELSE ISNULL(ItemRemarks, '') + '; ' + ISNULL(@ItemRemarks, '')
                END,
                UserID = @UserID,
                TabelGrpID = @TabelGrpID,
                LPax = @LPax,
                FPax = @FPax,
                TxnDateTime = ${SQL_SRI_LANKA_NOW}
            WHERE TabelNo = @TabelNo
              AND ItemCode = @ItemCode
          `);
        } else {
          const insertReq = new sql.Request(transaction);
          insertReq.input('TabelNo', sql.NVarChar(50), tableNo);
          insertReq.input('ItemCode', sql.NVarChar(50), item.ItemCode);
          insertReq.input('QTY', sql.Float, item.QTY);
          insertReq.input('SalesPrice', sql.Decimal(18, 2), item.SalesPrice);
          insertReq.input('ItemRemarks', sql.NVarChar(500), item.ItemRemarks);
          insertReq.input('UserID', sql.NVarChar(50), userId);
          insertReq.input('TabelGrpID', sql.NVarChar(50), tableGrpId);
          insertReq.input('LPax', sql.Float, lPax);
          insertReq.input('FPax', sql.Float, fPax);

          await insertReq.query(`
            INSERT INTO dbo.Tbl_HoldUpsCloud
              (TabelNo, ItemCode, QTY, SalesPrice, ItemRemarks, UserID, TabelGrpID, LPax, FPax, TxnDateTime)
            VALUES
              (@TabelNo, @ItemCode, @QTY, @SalesPrice, @ItemRemarks, @UserID, @TabelGrpID, @LPax, @FPax, ${SQL_SRI_LANKA_NOW})
          `);
        }
      }

      await transaction.commit();

      return res.status(200).json({
        ok: true,
        message: 'Item added successfully',
        data: {
          tableNo,
          itemCount: normalizedItems.length,
        },
      });
    } catch (error) {
      try { await transaction.rollback(); } catch (_) {}
      return sendSqlError(res, error, 'Failed to add item');
    }
  } catch (error) {
    return sendSqlError(res, error, 'Failed to add item');
  }
};

const billingRemoveItemHandler = async (req, res) => {
  try {
    const body = req.body || {};

    const TabelNo = body.TabelNo || body.TableNo || body.tableNo;
    const UserID = body.UserID || body.userId;
    const ItemCode = body.ItemCode || body.menuItemCode || body.itemCode;
    const QTY = body.QTY || body.qty || body.quantity;
    const VoidRemark = body.VoidRemark || body.voidRemark || body.ItemRemarks || body.itemRemarks || body.remarks;
    const ItemRemarks = body.ItemRemarks || body.itemRemarks || '';
    const MgrID = body.MgrID || body.mgrId;
    const TabelGrpID = body.TabelGrpID || body.TableGrpID || body.tableGrpId || '';
    const LPax = body.LPax || body.lPax || 0;
    const FPax = body.FPax || body.fPax || 0;
    const SalesPrice = body.SalesPrice || body.salesPrice || 0;

    if (!TabelNo) {
      return res.status(400).json({ success: false, message: 'TabelNo is required.' });
    }

    if (!QTY || parseFloat(QTY) <= 0) {
      return res.status(400).json({ success: false, message: 'QTY must be greater than zero.' });
    }

    if (!ItemCode) {
      return res.status(400).json({ success: false, message: 'ItemCode is required.' });
    }

    const tableNoValue = pickString(TabelNo, 50);
    const userIdValue = pickString(UserID ?? getBearerUserId(req, 'SYSTEM'), 50) || 'SYSTEM';
    const itemCodeValue = pickString(ItemCode, 50);
    const qtyValue = Math.abs(pickNumber(QTY, 0));
    const itemRemarksValue = pickString(ItemRemarks ?? '', 500);
    const voidRemarkValue = pickString(VoidRemark ?? '', 500);
    const mgrIdValue = pickString(MgrID ?? '', 50);
    const tableGrpIdValue = pickString(TabelGrpID ?? '', 50);
    const lPaxValue = pickNumber(LPax, 0);
    const fPaxValue = pickNumber(FPax, 0);
    const salesPriceValue = pickNumber(SalesPrice, 0);

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      // Guard current quantity to prevent over-removal
      const checkReq = new sql.Request(transaction);
      checkReq.input('TabelNo', sql.NVarChar(50), tableNoValue);
      checkReq.input('ItemCode', sql.NVarChar(50), itemCodeValue);

      const checkRes = await checkReq.query(`
        SELECT QTY
        FROM dbo.Tbl_HoldUpsCloud WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE TabelNo = @TabelNo
          AND ItemCode = @ItemCode
      `);

      const currentQty = checkRes.recordset?.[0]?.QTY;
      if (currentQty === undefined || currentQty === null) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Item line not found on the active bill.' });
      }

      if (qtyValue > currentQty) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Transaction Denied: Cannot void more items than what is currently active.' });
      }

      // Insert void audit row in temp table (AOR = 'R')
      const logReq = new sql.Request(transaction);
      logReq.input('TabelNo', sql.NVarChar(50), tableNoValue);
      logReq.input('UserID', sql.NVarChar(50), userIdValue);
      logReq.input('ItemCode', sql.NVarChar(50), itemCodeValue);
      logReq.input('QTY', sql.Float, qtyValue);
      logReq.input('ItemRemarks', sql.NVarChar(500), itemRemarksValue);
      logReq.input('VoidRemark', sql.NVarChar(500), voidRemarkValue);
      logReq.input('MgrID', sql.NVarChar(50), mgrIdValue);
      logReq.input('TabelGrpID', sql.NVarChar(50), tableGrpIdValue);
      logReq.input('LPax', sql.Float, lPaxValue);
      logReq.input('FPax', sql.Float, fPaxValue);
      logReq.input('SalesPrice', sql.Decimal(18, 2), salesPriceValue);

      await logReq.query(`
        INSERT INTO dbo.Tbl_HoldUpsCloudTemp
          (TabelNo, UserID, ItemCode, QTY, ItemRemarks, VoidRemark, TabelGrpID, LPax, FPax, SalesPrice, MgrID, TxnDateTime, AoR)
        VALUES
          (@TabelNo, @UserID, @ItemCode, @QTY, @ItemRemarks, @VoidRemark, @TabelGrpID, @LPax, @FPax, @SalesPrice, @MgrID, ${SQL_SRI_LANKA_NOW}, 'R')
      `);

      // Decrement quantity in authoritative table
      const updReq = new sql.Request(transaction);
      updReq.input('TabelNo', sql.NVarChar(50), tableNoValue);
      updReq.input('ItemCode', sql.NVarChar(50), itemCodeValue);
      updReq.input('QTY', sql.Float, qtyValue);

      await updReq.query(`
        UPDATE dbo.Tbl_HoldUpsCloud
        SET QTY = QTY - @QTY,
            TxnDateTime = ${SQL_SRI_LANKA_NOW}
        WHERE TabelNo = @TabelNo
          AND ItemCode = @ItemCode
      `);

      // Delete row if final quantity reaches zero or less
      const delReq = new sql.Request(transaction);
      delReq.input('TabelNo', sql.NVarChar(50), tableNoValue);
      delReq.input('ItemCode', sql.NVarChar(50), itemCodeValue);

      await delReq.query(`
        DELETE FROM dbo.Tbl_HoldUpsCloud
        WHERE TabelNo = @TabelNo
          AND ItemCode = @ItemCode
          AND QTY <= 0
      `);

      await transaction.commit();

      return res.status(200).json({ success: true });
    } catch (innerErr) {
      try { await transaction.rollback(); } catch (_) {}
      const message = innerErr?.message || 'Failed to remove item.';
      return res.status(500).json({ success: false, message });
    }
  } catch (error) {
    const message = error?.message || 'Failed to remove item.';
    return res.status(500).json({ success: false, message });
  }
};

const getActiveBillItemsHandler = async (req, res) => {
  try {
    const tableNo = pickString(req.query?.tableNo ?? req.body?.tableNo ?? req.body?.TableNo, 50);

    if (!tableNo) {
      return res.status(400).json({ ok: false, message: 'TableNo is required.' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('TabelNo', sql.NVarChar(50), tableNo)
      .query(`
        SELECT
          h.TabelNo,
          h.ItemCode,
          COALESCE(NULLIF(LTRIM(RTRIM(m.MenuItmDes)), ''), h.ItemCode) AS MenuItmDes,
          h.QTY,
          h.SalesPrice,
          COALESCE(h.ItemRemarks, '') AS ItemRemarks,
          h.TabelGrpID,
          h.UserID,
          h.LPax,
          h.FPax,
          h.TxnDateTime
        FROM dbo.Tbl_HoldUpsCloud h
        LEFT JOIN Vw_MenuAssignment m
          ON m.MenuItemCode = h.ItemCode
        WHERE h.TabelNo = @TabelNo
        ORDER BY h.TxnDateTime, h.ItemCode
      `);

    return res.json({
      ok: true,
      data: {
        tableNo,
        items: result.recordset.map((row) => ({
          menuItemCode: row.ItemCode,
          menuItmDes: row.MenuItmDes,
          salesPrice: Number(row.SalesPrice ?? 0),
          quantity: Number(row.QTY ?? 0),
          itemRemarks: row.ItemRemarks ?? '',
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Failed to load active bill items.' });
  }
};

app.post('/api/orders/confirm-cart', confirmCartHandler);
app.post('/api/cart/confirm', confirmCartHandler);
app.post('/api/confirm-cart', confirmCartHandler);
app.post('/api/billing/add-item', billingAddItemHandler);
app.post('/api/add-billing-item', billingAddItemHandler);
app.post('/api/billing/remove-item', billingRemoveItemHandler);
app.post('/api/remove-billing-item', billingRemoveItemHandler);
app.get('/api/billing/active-items', getActiveBillItemsHandler);


