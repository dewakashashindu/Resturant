const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const edge = require('edge-js'); 
const path = require('path');
const app = express();

const dllPath = path.join(__dirname, 'DbProtector.dll');


const loadConfigFromDLL = edge.func({ 
    assemblyFile: dllPath, 
    typeName: 'Startup', 
    methodName: 'LoadConfig' 
});


const sysConfig = loadConfigFromDLL(null, true);

const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/test', (_req, res) => {
  res.json({
    ok: true,
    message: 'Backend is reachable from the network.',
    timestamp: new Date().toISOString(),
  });
});


const dbConfig = {
  user: sysConfig.DB_USER,
  password: sysConfig.DB_PASS,
  server: sysConfig.DB_SERVER,
  database: sysConfig.DB_NAME,
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


const remarksDbConfig = {
  user: sysConfig.REMARKS_DB_USER || sysConfig.DB_USER,
  password: sysConfig.REMARKS_DB_PASS || sysConfig.DB_PASS,
  server: sysConfig.REMARKS_DB_SERVER || sysConfig.DB_SERVER,
  database: sysConfig.REMARKS_DB_NAME || sysConfig.DB_NAME,
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


const JWT_SECRET_KEY = sysConfig.JWT_SECRET;

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

// Validators
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

// Auth: Login 
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // input validations
    const usernameErr = validateUsername(username);
    if (usernameErr) return res.status(400).json({ message: usernameErr });

    const passwordErr = validatePassword(password);
    if (passwordErr) return res.status(400).json({ message: passwordErr });

    const pool = await poolPromise;


    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .query('SELECT UserId, LoginName, Password, GroupId FROM Tbl_UserDetails WHERE LoginName = @username');

    const user = result.recordset[0];
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  
    const passwordMatch = await bcrypt.compare(password, user.Password);
    if (!passwordMatch) return res.status(401).json({ message: 'Invalid credentials' });

  
    const floorResult = await pool.request()
      .input('UserId', sql.VarChar, String(user.UserId))
      .query(`
        SELECT g.GroupName
        FROM Tbl_TableGroupAccess a
        INNER JOIN Tbl_TableGroup g ON g.GroupId = a.TableGroupId
        WHERE a.UserId = @UserId
      `);

    const assignedFloors = floorResult.recordset.map(row => row.GroupName);
    
   
    const token = jwt.sign(
      { userId: user.UserId, username: user.LoginName, groupId: user.GroupId, assignedFloors },
      JWT_SECRET_KEY || 'YOUR_SECRET_KEY',
      { expiresIn: '7d' }
    );

    console.log("LOGGED IN USER ID FROM OFFICIAL TBL:", user.UserId);
    console.log("ASSIGNED FLOORS FROM DB:", assignedFloors);

    return res.json({
      message: 'Login successful',
      token,
      user: { 
        username: user.LoginName,
        userId: user.UserId,
        groupId: user.GroupId, 
        assignedFloors 
      },
      groupId: user.GroupId,
      assignedFloors: assignedFloors
    });

  } catch (error) {
    console.error("[Backend Login Error]:", error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});





// Username existence check — called on blur from the login screen.
// Returns 200 { exists: true } if the username is in Tbl_UserDetails,
// 404 { exists: false } if not found, and 503 if the DB pool is not connected.
app.get('/api/auth/check-username', async (req, res) => {
  const { username } = req.query;

  const usernameErr = validateUsername(String(username || ''));
  if (usernameErr) return res.status(400).json({ exists: false, message: usernameErr });

  try {
    const pool = await poolPromise;

    if (!pool.__connected) {
      return res.status(503).json({ exists: false, message: 'Database is not connected.' });
    }

    const result = await pool.request()
      .input('username', sql.VarChar, String(username))
      .query('SELECT 1 AS found FROM Tbl_UserDetails WHERE LoginName = @username');

    if (result.recordset.length > 0) {
      return res.json({ exists: true });
    } else {
      return res.status(404).json({ exists: false, message: 'Username not found.' });
    }
  } catch (error) {
    console.error('[check-username] DB error:', error);
    return res.status(503).json({ exists: false, message: 'Database error. Please try again.' });
  }
});

// Verifies that a given username/password belongs to a user with manager-level
// privileges. Used by the billing screen before allowing a void override.
// Matches against Tbl_UserGroups.GroupDes — confirmed values: Cashier, Steward,
// Manager, Driver, Store Keeper, Chefs, Barmen. Only "Manager" (GroupId 003)
// is authorized to approve voids.
const MANAGER_ROLE_NAMES = ['manager'];

app.post('/api/auth/verify-manager', async (req, res) => {
  try {
    const { username, password } = req.body;

    const usernameErr = validateUsername(username);
    if (usernameErr) return res.status(400).json({ message: usernameErr });

    const passwordErr = validatePassword(password);
    if (passwordErr) return res.status(400).json({ message: passwordErr });

    const pool = await poolPromise;

    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .query(`
        SELECT u.UserId, u.LoginName, u.Password, u.GroupId, g.GroupDes
        FROM Tbl_UserDetails u
        LEFT JOIN Tbl_UserGroups g ON g.GroupId = u.GroupId
        WHERE u.LoginName = @username
      `);

    const user = result.recordset[0];
    if (!user) return res.status(401).json({ message: 'Invalid manager credentials' });

    const passwordMatch = await bcrypt.compare(password, user.Password);
    if (!passwordMatch) return res.status(401).json({ message: 'Invalid manager credentials' });

    const groupDes = String(user.GroupDes || '').trim().toLowerCase();
    const isManager = MANAGER_ROLE_NAMES.includes(groupDes);
    if (!isManager) {
      return res.status(403).json({ message: 'This user is not authorized to approve voids' });
    }

    return res.json({
      message: 'Manager verified',
      manager: {
        userId: user.UserId,
        username: user.LoginName,
        groupId: user.GroupId,
        role: user.GroupDes,
      },
    });
  } catch (error) {
    console.error('[Backend Verify Manager Error]:', error);
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
    const hashedPassword = await bcrypt.hash(password, 10);

    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      // 1. Check if phone number already exists
      const existingPhone = await new sql.Request(transaction)
        .input('phoneNumber', sql.VarChar, phoneNumber)
        .query('SELECT UserId FROM Tbl_UserDetails WHERE ContNo = @phoneNumber');

      if (existingPhone.recordset.length > 0) {
        // Phone exists → just update LoginName and Password
        await new sql.Request(transaction)
          .input('phoneNumber', sql.VarChar, phoneNumber)
          .input('username', sql.VarChar, username)
          .input('password', sql.VarChar, hashedPassword)
          .query(`
            UPDATE Tbl_UserDetails 
            SET LoginName = @username, Password = @password 
            WHERE ContNo = @phoneNumber
          `);

        await transaction.commit();
        return res.json({ message: 'Account credentials updated successfully!' });
      }

      // 2. Check if username already taken
      const existingUser = await new sql.Request(transaction)
        .input('username', sql.VarChar, username)
        .query('SELECT LoginName FROM Tbl_UserDetails WHERE LoginName = @username');

      if (existingUser.recordset.length > 0) {
        await transaction.rollback();
        return res.status(409).json({ message: 'Username already exists.' });
      }

      // 3. Generate next UserId safely — skip any rows with non-numeric UserIds like 'Y      '
      const maxIdResult = await new sql.Request(transaction)
        .query(`
          SELECT ISNULL(MAX(CAST(SUBSTRING(UserId, 2, LEN(UserId)) AS INT)), 0) + 1 AS NextId 
          FROM Tbl_UserDetails
          WHERE UserId LIKE 'U[0-9]%'
            AND ISNUMERIC(SUBSTRING(UserId, 2, LEN(UserId))) = 1
        `);
      const nextId = 'U' + String(maxIdResult.recordset[0].NextId).padStart(3, '0');

      // 4. Insert new user — all columns explicitly provided to avoid bad DB defaults firing
      await new sql.Request(transaction)
        .input('userId',      sql.Char(10),    nextId)
        .input('username',    sql.VarChar(400), username)
        .input('password',    sql.VarChar(255), hashedPassword)
        .input('phoneNumber', sql.VarChar(100), phoneNumber)
        .query(`
          INSERT INTO Tbl_UserDetails (
            UserId, NIC, LogName, PSW,
            LoginName, Password,
            GroupId, UserName, Rmks,
            Add1, Add2, Add3, Add4,
            ContNo, Email,
            DOB, DOJ, DOL,
            CreateUser, Enable, LOCCODE
          ) VALUES (
            @userId, '', '', '',
            @username, @password,
            '0', @username, '',
            '', '', '', '',
            @phoneNumber, '',
            GETDATE(), GETDATE(), GETDATE(),
            '0', 1, '01'
          )
        `);

      await transaction.commit();
      return res.json({ message: 'Account created successfully' });

    } catch (txError) {
      try { await transaction.rollback(); } catch (_) {}
      throw txError;
    }
  } catch (error) {
    console.error("[Backend Error] Signup process failed:", error);
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
      .query('SELECT LoginName, ContNo FROM Tbl_UserDetails WHERE LoginName = @username');

    const user = result.recordset[0];
    if (!user) return res.status(404).json({ message: 'User not found.' });

   
    return res.json({ 
      message: 'Verification code sent', 
      phoneNumber: user.ContNo 
    });
  } catch (error) {
    console.error("[Backend Forgot Password Error]:", error);
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
      .query('UPDATE Tbl_UserDetails SET Password = @password WHERE LoginName = @username');

    if (result.rowsAffected[0] === 0) return res.status(404).json({ message: 'User not found.' });

    return res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error("[Backend Reset Password Error]:", error);
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
      .query('SELECT LoginName, Password FROM Tbl_UserDetails WHERE LoginName = @username');

    const user = result.recordset[0];
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const passwordMatch = await bcrypt.compare(currentPassword, user.Password);
    if (!passwordMatch) return res.status(401).json({ message: 'Current password is incorrect.' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
   
    const updateResult = await pool.request()
      .input('username', sql.VarChar, username)
      .input('password', sql.VarChar, hashedPassword)
      .query('UPDATE Tbl_UserDetails SET Password = @password WHERE LoginName = @username');

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(500).json({ message: 'Failed to update password.' });
    }

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error("[Backend Change Password Error]:", error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Table routes 
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

app.get('/api/void-remarks', async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT VoidRmkId, VoidDescription
      FROM dbo.Tbl_VoidRemarks
      WHERE Enable = 'True'
    `);

    return res.json(Array.isArray(result.recordset) ? result.recordset : []);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Menu/Category routes 
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

    const formattedCategories = result.recordset.map(row => ({
      id: row.Level,
      label: row.LDes,
      type: row.Type,
      price: parseFloat(row.SalesPrice),
      listingOrder: row.L1LitingOrder,
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
    
    const rmksDbConfig = {
      user: sysConfig.REMARKS_DB_USER || sysConfig.DB_USER,
      password: sysConfig.REMARKS_DB_PASS || sysConfig.DB_PASS,
      server: sysConfig.REMARKS_DB_SERVER || sysConfig.DB_SERVER,
      database: sysConfig.REMARKS_DB_NAME || sysConfig.DB_NAME,
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

    remarkPool = await new sql.ConnectionPool(rmksDbConfig).connect();

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

// Menu Items
app.get('/api/menu/items', async (req, res) => {
  try {
    let since = req.query.since;
    console.log('[Backend] GET /api/menu/items since=', since);

    const pool = await poolPromise;
    

    const result = await pool.request().query(`
      SELECT *
      FROM Vw_MenuAssignment WITH (NOLOCK)
      WHERE DisplayInFront = '1'
        AND MenuAssiEnable = '1'
        AND MenuItemEnable = '1'
    `);

    const rows = result && result.recordset ? result.recordset : [];
    console.log('[Backend] /api/menu/items sql returned rows=', rows.length);
    
  
    return res.json({ 
      items: rows, 
      lastSyncTime: new Date().toISOString(), 
      ok: true 
    });

  } catch (error) {
    console.log('[Backend] /api/menu/items error', error && error.message ? error.message : error);
    return res.status(500).json({ 
      ok: false, 
      error: error && error.message ? error.message : String(error) 
    });
  }
});


const PORT = sysConfig.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});

// Graceful shutdown 
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
      
      const decoded = jwt.verify(token, JWT_SECRET_KEY);
      if (decoded && typeof decoded === 'object' && decoded.userId) {
        return pickString(decoded.userId, 50) || fallback;
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

const SQL_SRI_LANKA_NOW = 'DATEADD(MINUTE, 330, GETUTCDATE())';

const confirmCartHandler = async (req, res) => {
  try {
    // Unique invoice number generated once per add-order request.
    // Only used for brand-new rows (fresh INSERTs) — rows that already exist
    // for this table keep whatever InvoiceNo they were originally opened
    // under, since they belong to the same still-open bill.
const sriLankaNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
const datePart = sriLankaNow.toISOString().slice(0, 10).replace(/-/g, '');

const pool = await poolPromise;

const seqResult = await pool.request().query(`
  UPDATE dbo.Tbl_Serials
  SET 
    SeriNo = CASE 
      WHEN SeriDate = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE)
      THEN CAST(CAST(SeriNo AS INT) + 1 AS CHAR(10))
      ELSE '1'
    END,
    SeriDate = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE)
  OUTPUT CAST(INSERTED.SeriNo AS INT) AS SeriNo
  WHERE SeriCode = 'INV'
`);

const seq = Number(seqResult.recordset[0].SeriNo);
const invoiceNo = `INV-${datePart}-${String(seq).padStart(3, '0')}`;
// e.g. INV-20260701-001

    const body = Array.isArray(req.body) ? { items: req.body } : (req.body || {});
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return res.status(400).json({ ok: false, message: 'No items to confirm' });
    }

    const orderTypeVal = pickString(body.orderType ?? body.OrderType ?? '', 10) || 'DI';
    let tableNo = pickString(body.tableNo ?? body.TableNo ?? body.TabelNo ?? body.tableName ?? body.TableName, 50);
    const tableGrpId = pickString(body.tableGrpId ?? body.TableGrpId ?? body.TableGrpID ?? body.TabelGrpID ?? body.tableGroupId, 50);
    const userId = getBearerUserId(req, body.userId ?? body.UserID ?? 'SYSTEM');
    const lPax = pickNumber(body.lPax ?? body.LPax ?? 0, 0);
    const fPax = pickNumber(body.fPax ?? body.FPax ?? 0, 0);

    if (orderTypeVal === 'TA') {
      const serialResult = await pool.request()
        .query("SELECT SeriNo FROM Tbl_Serials WHERE SeriCode = 'TA'");
      
      if (serialResult.recordset.length > 0) {
        const currentSerial = parseInt(serialResult.recordset[0].SeriNo);
        tableNo = `TA-${currentSerial}`; 
        await pool.request()
          .query(`UPDATE Tbl_Serials SET SeriNo = ${currentSerial + 1} WHERE SeriCode = 'TA'`);
        console.log(`[TA-SERIAL] Generated serial: ${tableNo}`);
      }
    }

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
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      let resolvedTableGrpId = tableGrpId;
      try {
        const tblGrpReq = new sql.Request(transaction);
        tblGrpReq.input('TableNo', sql.NVarChar(50), tableNo);
        const tblGrpResult = await tblGrpReq.query(
          'SELECT TableGroup FROM dbo.Tbl_Tables WHERE TableNo = @TableNo'
        );
        if (tblGrpResult.recordset.length > 0 && tblGrpResult.recordset[0].TableGroup != null) {
          resolvedTableGrpId = pickString(tblGrpResult.recordset[0].TableGroup, 50);
        }
      } catch (tblGrpErr) {
        console.warn('[TableGroup Lookup] Failed, falling back to request value:', tblGrpErr?.message);
      }

      for (const item of normalizedItems) {
        try {
          const lookupReq = new sql.Request(transaction);
          lookupReq.input('TabelNo', sql.NVarChar(50), tableNo); 
          lookupReq.input('ItemCode', sql.NVarChar(50), item.ItemCode);

          const existing = await lookupReq.query(`
            SELECT QTY
            FROM dbo.Tbl_HoldUpsCloud WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
            WHERE TabelNo = @TabelNo
              AND ItemCode = @ItemCode
              AND (IsPaid = 0 OR IsPaid IS NULL)
          `);

          const existingQty = Number(existing.recordset?.[0]?.QTY ?? 0);
          const rowExists = (existing.recordset?.length ?? 0) > 0;


          if (rowExists) {
            const updateReq = new sql.Request(transaction);
            updateReq.input('TabelNo', sql.NVarChar(50), tableNo);
            updateReq.input('ItemCode', sql.NVarChar(50), item.ItemCode);
            updateReq.input('QTY', sql.Float, item.QTY);
            updateReq.input('SalesPrice', sql.Decimal(18, 2), item.SalesPrice * item.QTY);
            updateReq.input('ItemRemarks', sql.NVarChar(500), item.ItemRemarks);
            updateReq.input('UserID', sql.NVarChar(50), userId);
            updateReq.input('TabelGrpID', sql.NVarChar(50), resolvedTableGrpId);
            updateReq.input('LPax', sql.Float, lPax);
            updateReq.input('FPax', sql.Float, fPax);
            updateReq.input('OderType', sql.VarChar(5), orderTypeVal); 

            await updateReq.query(`
              UPDATE dbo.Tbl_HoldUpsCloud
              SET QTY = @QTY,
                  SalesPrice = @SalesPrice,
                  ItemRemarks = @ItemRemarks,
                  UserID = @UserID,
                  TabelGrpID = @TabelGrpID,
                  LPax = @LPax,
                  FPax = @FPax,
                  OderType = @OderType, 
                  TxnDateTime = ${SQL_SRI_LANKA_NOW}
              WHERE TabelNo = @TabelNo
                AND ItemCode = @ItemCode
            `);
          } else {
            const insertReq = new sql.Request(transaction);
            insertReq.input('TabelNo', sql.NVarChar(50), tableNo);
            insertReq.input('ItemCode', sql.NVarChar(50), item.ItemCode);
            insertReq.input('QTY', sql.Float, item.QTY);
            insertReq.input('SalesPrice', sql.Decimal(18, 2), item.SalesPrice * item.QTY);
            insertReq.input('ItemRemarks', sql.NVarChar(500), item.ItemRemarks);
            insertReq.input('UserID', sql.NVarChar(50), userId);
            insertReq.input('TabelGrpID', sql.NVarChar(50), resolvedTableGrpId);
            insertReq.input('LPax', sql.Float, lPax);
            insertReq.input('FPax', sql.Float, fPax);
            insertReq.input('OderType', sql.VarChar(5), orderTypeVal); 
            insertReq.input('InvoiceNo', sql.NVarChar(50), invoiceNo);
            insertReq.input('IsPaid', sql.Bit, 0);

            await insertReq.query(`
              INSERT INTO dbo.Tbl_HoldUpsCloud
                (TabelNo, ItemCode, QTY, SalesPrice, ItemRemarks, UserID, TabelGrpID, LPax, FPax, OderType, InvoiceNo, IsPaid, TxnDateTime) 
              VALUES
                (@TabelNo, @ItemCode, @QTY, @SalesPrice, @ItemRemarks, @UserID, @TabelGrpID, @LPax, @FPax, @OderType, @InvoiceNo, @IsPaid, ${SQL_SRI_LANKA_NOW})
            `);
          }

          const deltaQty = rowExists ? (item.QTY - existingQty) : item.QTY;
          if (deltaQty !== 0) {
            const tempReq = new sql.Request(transaction);
            tempReq.input('TabelNo', sql.NVarChar(50), tableNo);
            tempReq.input('UserID', sql.NVarChar(50), userId);
            tempReq.input('ItemCode', sql.NVarChar(50), item.ItemCode);
            tempReq.input('QTY', sql.Float, deltaQty);
            tempReq.input('ItemRemarks', sql.NVarChar(500), item.ItemRemarks);
            tempReq.input('VoidRemark', sql.NVarChar(500), '');
            tempReq.input('TabelGrpID', sql.NVarChar(50), resolvedTableGrpId || null);
            tempReq.input('LPax', sql.Float, lPax);
            tempReq.input('FPax', sql.Float, fPax);
            tempReq.input('SalesPrice', sql.Decimal(18, 2), item.SalesPrice * item.QTY);
            tempReq.input('OderType', sql.VarChar(5), orderTypeVal); // 👈 [FIXED]

            await tempReq.query(`
              INSERT INTO dbo.Tbl_HoldUpsCloudTemp
                (TabelNo, UserID, ItemCode, QTY, ItemRemarks, VoidRemark, TabelGrpID, TxnDateTime, LPax, FPax, SalesPrice, MgrID, OderType, AoR)
              VALUES
                (@TabelNo, @UserID, @ItemCode, @QTY, @ItemRemarks, @VoidRemark, @TabelGrpID, ${SQL_SRI_LANKA_NOW}, @LPax, @FPax, @SalesPrice, '0', @OderType, 'A')
            `);
          }
        } catch (err) {
          console.error(`[DB ERROR] Failed to save item: ${item.ItemCode} -> Error:`, err.message);
          throw err;
        }
      }

      await transaction.commit();
      return res.status(200).json({
        ok: true,
        message: 'Cart confirmed successfully',
        data: { tableNo, itemCount: normalizedItems.length, invoiceNo },
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
    const invoiceNo = pickString(body.invoiceNo ?? body.InvoiceNo ?? null, 50);

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
        try {
          const tempReq = new sql.Request(transaction);
          tempReq.input('TabelNo', sql.NVarChar(50), tableNo);
          tempReq.input('UserID', sql.NVarChar(50), userId);
          tempReq.input('ItemCode', sql.NVarChar(50), item.ItemCode);
          tempReq.input('QTY', sql.Float, item.QTY);
          tempReq.input('SalesPrice', sql.Decimal(18, 2), item.SalesPrice * item.QTY);
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
        }  catch (err) {
  console.error(`[DB ERROR] Failed to save item: ${item.ItemCode} -> Error:`, err.message);
  throw err; 
}
      }

      await transaction.commit();
      return res.status(200).json({
        ok: true,
        message: 'Item added successfully',
        data: { tableNo, itemCount: normalizedItems.length },
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

    if (!TabelNo) return res.status(400).json({ success: false, message: 'TabelNo is required.' });
    if (!QTY || parseFloat(QTY) <= 0) return res.status(400).json({ success: false, message: 'QTY must be greater than zero.' });
    if (!ItemCode) return res.status(400).json({ success: false, message: 'ItemCode is required.' });

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
      return res.status(500).json({ success: false, message: innerErr?.message || 'Failed to remove item.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to remove item.' });
  }
};

const getActiveBillItemsHandler = async (req, res) => {
  try {
    const tableNo = pickString(req.query?.tableNo ?? req.body?.tableNo ?? req.body?.TableNo, 50);
    if (!tableNo) return res.status(400).json({ ok: false, message: 'TableNo is required.' });

    const pool = await poolPromise;
    const result = await pool.request()
      .input('TabelNo', sql.NVarChar(50), tableNo)
      .query(`
        SELECT
          h.TabelNo, h.ItemCode,
          COALESCE(NULLIF(LTRIM(RTRIM(m.MenuItmDes)), ''), h.ItemCode) AS MenuItmDes,
          h.QTY, h.SalesPrice, COALESCE(h.ItemRemarks, '') AS ItemRemarks,
          h.TabelGrpID, h.UserID, h.LPax, h.FPax, h.TxnDateTime, h.InvoiceNo, h.IsPaid
        FROM dbo.Tbl_HoldUpsCloud h
        LEFT JOIN Vw_MenuAssignment m ON m.MenuItemCode = h.ItemCode
        WHERE h.TabelNo = @TabelNo
          AND (h.IsPaid = 0 OR h.IsPaid IS NULL)
        ORDER BY h.TxnDateTime, h.ItemCode
      `);

    const first = result.recordset[0];

    return res.json({
      ok: true,
      data: {
        tableNo,
        invoiceNo: first?.InvoiceNo ?? null,
        lPax: Number(first?.LPax ?? 0),
        fPax: Number(first?.FPax ?? 0),
        tableGrpId: first?.TabelGrpID ?? '',
        userId: first?.UserID ?? '',
        isPaid: first ? Boolean(first.IsPaid) : false,
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

// ── Unpaid Bills (DB-driven billing) ────────────────────────────────────────

const getUnpaidBillsHandler = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        InvoiceNo,
        TabelNo,
        MAX(TxnDateTime) AS OrderTime,
        SUM(QTY * SalesPrice) AS TotalAmount
      FROM dbo.Tbl_HoldUpsCloud
      WHERE IsPaid = 0
      GROUP BY InvoiceNo, TabelNo
      ORDER BY MAX(TxnDateTime) DESC
    `);

    return res.json({
      ok: true,
      data: result.recordset.map((row) => ({
        invoiceNo: row.InvoiceNo,
        tableNo: row.TabelNo,
        orderTime: row.OrderTime,
        totalAmount: Number(row.TotalAmount ?? 0),
      })),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Failed to load unpaid bills.' });
  }
};

const getBillItemsHandler = async (req, res) => {
  try {
    const invoiceNo = pickString(req.query?.invoiceNo, 50);
    const tableNo = pickString(req.query?.tableNo, 50);

    if (!invoiceNo && !tableNo) {
      return res.status(400).json({ ok: false, message: 'invoiceNo or tableNo is required.' });
    }

    const pool = await poolPromise;
    const request = pool.request();
    let whereClause = '';

    if (invoiceNo) {
      request.input('InvoiceNo', sql.NVarChar(50), invoiceNo);
      whereClause = 'WHERE h.InvoiceNo = @InvoiceNo';
    } else {
      request.input('TabelNo', sql.NVarChar(50), tableNo);
      whereClause = 'WHERE h.TabelNo = @TabelNo AND h.IsPaid = 0';
    }

    const result = await request.query(`
      SELECT
        h.InvoiceNo, h.TabelNo, h.ItemCode,
        COALESCE(NULLIF(LTRIM(RTRIM(m.MenuItmDes)), ''), h.ItemCode) AS MenuItmDes,
        h.QTY, h.SalesPrice, COALESCE(h.ItemRemarks, '') AS ItemRemarks,
        h.TabelGrpID, h.UserID, h.LPax, h.FPax, h.TxnDateTime, h.IsPaid
      FROM dbo.Tbl_HoldUpsCloud h
      LEFT JOIN Vw_MenuAssignment m ON m.MenuItemCode = h.ItemCode
      ${whereClause}
      ORDER BY h.TxnDateTime, h.ItemCode
    `);

    if (result.recordset.length === 0) {
      return res.json({ ok: true, data: { invoiceNo: invoiceNo || null, tableNo: tableNo || null, items: [], totalAmount: 0 } });
    }

    const items = result.recordset.map((row) => ({
      menuItemCode: row.ItemCode,
      menuItmDes: row.MenuItmDes,
      salesPrice: Number(row.SalesPrice ?? 0),
      quantity: Number(row.QTY ?? 0),
      itemRemarks: row.ItemRemarks ?? '',
    }));

    const totalAmount = items.reduce((sum, it) => sum + it.salesPrice, 0);
    const first = result.recordset[0];

    return res.json({
      ok: true,
      data: {
        invoiceNo: first.InvoiceNo,
        tableNo: first.TabelNo,
        lPax: Number(first.LPax ?? 0),
        fPax: Number(first.FPax ?? 0),
        orderTime: first.TxnDateTime,
        isPaid: Boolean(first.IsPaid),
        items,
        totalAmount,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Failed to load bill items.' });
  }
};

const payBillHandler = async (req, res) => {
  try {
    const invoiceNo = pickString(req.body?.invoiceNo ?? req.body?.InvoiceNo, 50);
    if (!invoiceNo) {
      return res.status(400).json({ ok: false, message: 'invoiceNo is required.' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('InvoiceNo', sql.NVarChar(50), invoiceNo)
      .query('UPDATE dbo.Tbl_HoldUpsCloud SET IsPaid = 1 WHERE InvoiceNo = @InvoiceNo');

    if (!result.rowsAffected || !result.rowsAffected[0]) {
      return res.status(404).json({ ok: false, message: 'No bill found for that invoice number.' });
    }

    return res.json({ ok: true, message: 'Bill marked as paid', data: { invoiceNo } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Failed to pay bill.' });
  }
};

app.get('/api/unpaid-bills', getUnpaidBillsHandler);
app.get('/api/bill-items', getBillItemsHandler);
app.post('/api/pay-bill', payBillHandler);

app.get('/api/customer/:phone', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('phone', sql.VarChar, req.params.phone)
      .query('SELECT CusName FROM Tbl_CustomerMaster WHERE RegTel = @phone');
      
    if (result.recordset.length > 0) {
      res.json({ exists: true, customerName: result.recordset[0].CusName });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customer/save', async (req, res) => {
  const { RegTel, CusName, Rmks, CusBehaviour } = req.body;
  const cusBehaviourVal = (CusBehaviour !== undefined) ? parseInt(CusBehaviour) : 4;
  const regTelVal  = String(RegTel || '').trim().substring(0, 15);
  const cusNameVal = String(CusName || 'Guest').trim().substring(0, 200);
  const rmksVal    = String(Rmks || '').trim().substring(0, 400);
  const locCodeVal = '01'; 
  const txnTypeVal = 'CUS'; 

  try {
    const pool = await poolPromise;
    const checkResult = await pool.request()
      .input('RegTel', sql.Char(15), regTelVal)
      .query(`SELECT CusCode FROM Tbl_CustomerMaster WHERE LTRIM(RTRIM(RegTel)) = LTRIM(RTRIM(@RegTel))`);

    let finalCusCode = '';
    if (checkResult.recordset.length > 0) {
      finalCusCode = String(checkResult.recordset[0].CusCode).trim();
      await pool.request()
        .input('CusCode', sql.Char(10), finalCusCode)
        .input('CusName', sql.VarChar(200), cusNameVal)
        .input('Rmks',    sql.VarChar(400), rmksVal)
        .query(`UPDATE Tbl_CustomerMaster SET CusName = @CusName, Rmks = @Rmks WHERE CusCode = @CusCode`);
    } else {
      const txnResult = await pool.request()
        .input('LocCode', sql.VarChar(10), locCodeVal)
        .input('TxnType', sql.VarChar(10), txnTypeVal)
        .query(`SELECT Prefix, TxnNo FROM Tbl_TxnNumbers WHERE LocCode = @LocCode AND TxnType = @TxnType AND Enable = '1'`);

      if (txnResult.recordset.length > 0) {
        const row = txnResult.recordset[0];
        const prefix = String(row.Prefix || '').trim(); 
        const nextNo = Number(row.TxnNo);
        finalCusCode = (prefix + String(nextNo).padStart(6, '0')).substring(0, 10);

        await pool.request()
          .input('LocCode', sql.VarChar(10), locCodeVal)
          .input('TxnType', sql.VarChar(10), txnTypeVal)
          .input('NextNo', sql.Float, nextNo + 1)
          .query(`UPDATE Tbl_TxnNumbers SET TxnNo = @NextNo WHERE LocCode = @LocCode AND TxnType = @TxnType`);
      } else {
        finalCusCode = ('A' + Date.now().toString().slice(-9)).substring(0, 10);
      }

      await pool.request()
        .input('LocCode',  sql.Char(10),     locCodeVal)
        .input('CusCode',  sql.Char(10),     finalCusCode)
        .input('CusName',  sql.VarChar(200), cusNameVal)
        .input('RegTel',   sql.Char(15),     regTelVal)
        .input('Rmks',     sql.VarChar(400), rmksVal)
        .input('CusBehaviour', sql.Int,          cusBehaviourVal)
        .query(`
          INSERT INTO Tbl_CustomerMaster (
            LocCode, CusCode, CusName, CusAdd1, CusAdd2, CusAdd3, CusAdd4,
            RegTel, DelRefNo, CusEmail, CusWeb, Enable, CreditCustomer,
            CreditLimit, UsedCredit, Rmks, LoyalCus, CreatedBy, CreateDateTime,
            DeleveryCustomer, DisPre, AllowComplimentry, voiceprompt, notice,
            CusBehaviour, BlackList, BlackListRemarks
          )
          VALUES (
            @LocCode, @CusCode, @CusName, '', '', '', '', 
            @RegTel, @RegTel, '', '', 1, 0, 
            0, 0, @Rmks, 0, 'System', GETDATE(),
            0, 0, 0, '', '', 
            @CusBehaviour, 0, ''
          )`);
    }
    res.json({ success: true, message: "Customer saved successfully.", cusCode: finalCusCode });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get User Groups from Database
app.get('/api/user-groups', async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT GroupId, GroupDes 
      FROM Tbl_UserGroups 
      WHERE GroupDes IS NOT NULL
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

//manage workers
app.get('/api/auth/workers', async (req, res) => {
  try {
    const pool = await poolPromise;
    
   
    const result = await pool.request().query(`
      SELECT 
        UserId, 
        UserName, 
        LoginName, 
        ContNo, 
        GroupId,
        Enable
      FROM Tbl_UserDetails
    `);

    const floorResult = await pool.request().query(`
      SELECT a.UserId, g.GroupName
      FROM Tbl_TableGroupAccess a
      INNER JOIN Tbl_TableGroup g ON g.GroupId = a.TableGroupId
    `);

    const floorsByUser = {};
    floorResult.recordset.forEach((row) => {
      const key = String(row.UserId);
      if (!floorsByUser[key]) floorsByUser[key] = [];
      floorsByUser[key].push(row.GroupName);
    });

    const workers = result.recordset.map((w) => ({
      ...w,
      assignedFloors: floorsByUser[String(w.UserId)] || [],
    }));

    return res.json(workers);
  } catch (error) {
    return res.status(500).json({ message: 'Server error fetching workers', error: error.message });
  }
});

// Get Table Groups (Floor Access options) from Tbl_TableGroup — used for the
// multi-select "Manage Access" dropdown on the Manage Floor Access screen.
app.get('/api/table-groups', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT GroupId, GroupName
      FROM Tbl_TableGroup
      WHERE GroupName IS NOT NULL
      ORDER BY GroupName
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});


// floor access management
app.post('/api/user-floor-access/save', async (req, res) => {
  const { UserId, TableGroupIds, AssignedBy } = req.body;

  if (!UserId || !Array.isArray(TableGroupIds)) {
    return res.status(400).json({ success: false, message: 'Invalid payload. UserId and TableGroupIds array are required.' });
  }

  try {
    const pool = await poolPromise;

    // Delete existing access for this user
    await pool.request()
      .input('UserId', sql.VarChar(50), String(UserId))
      .query('DELETE FROM Tbl_TableGroupAccess WHERE UserId = @UserId');

    // Insert each selected TableGroupId (FloorName is populated from
    // Tbl_TableGroup.GroupName since the column still exists and disallows NULLs)
    for (const groupId of TableGroupIds) {
      await pool.request()
        .input('UserId',       sql.VarChar(50), String(UserId))
        .input('TableGroupId', sql.VarChar(50), String(groupId))
        .input('AssignedBy',   sql.VarChar(50), String(AssignedBy || ''))
        .query(`
          INSERT INTO Tbl_TableGroupAccess (UserId, TableGroupId, FloorName, AssignedBy)
          SELECT @UserId, @TableGroupId, g.GroupName, @AssignedBy
          FROM Tbl_TableGroup g
          WHERE g.GroupId = @TableGroupId
        `);
    }

    return res.json({ success: true, message: 'Floor access updated successfully!' });
  } catch (error) {
    console.error('Error saving floor access:', error);
    return res.status(500).json({ success: false, message: 'Server error saving floor access', error: error.message });
  }
});


// Device Check-in Endpoint
app.post('/api/devices/check-in', async (req, res) => {
  const { deviceId } = req.body;

  console.log(`[Backend] Received device verification request for ID: ${deviceId}`);

  if (!deviceId) {
    return res.status(400).json({ allowed: false, message: "Device ID is required." });
  }

  try {
    const pool = await poolPromise;

  
    const checkResult = await pool.request()
      .input('deviceId', sql.VarChar, deviceId)
      .query('SELECT Warkstation, IsApproved FROM Tbl_Warkstation WHERE Warkstation = @deviceId');

    const rows = checkResult.recordset; 

    if (rows.length > 0) {
      const device = rows[0];

      if (device.IsApproved === 1 || device.IsApproved === true || device.IsApproved === '1') {
        console.log(`[Backend] Device ${deviceId} is APPROVED.`);
        return res.json({ allowed: true, status: "approved" });
      } else {
        console.log(`[Backend] Device ${deviceId} is PENDING approval.`);
        return res.json({ allowed: false, status: "pending", deviceId: deviceId });
      }
    }

  
    console.log(`[Backend] First time device detected. Inserting default config for ID: ${deviceId}`);
    
    await pool.request()
      .input('deviceId', sql.VarChar, deviceId)
      .query(`
        INSERT INTO Tbl_Warkstation (
          Warkstation, LocCode, DirectPrinting, CrystalPrinting, PrinterPort, 
          KOTPrinter, BOTPrinter, OthPrinter, KOTBOTAct, KOTFONTSIZE, 
          BOTFONTSIZE, KOTSLIPFROMBILLPRINTER, BOTSLIPFROMBILLPRINTER, OTHSLIPFROMBILLPRINTER, CrysPrintView, 
          OTHFONTSIZE, ColumnSize, LeftColumnWidth, OrderNoFontSize, TablNoFontSize, 
          OrderNoFontBold, TablNoFontBold, SwipeEnable, OrderCounter, LoadItemsSeparately, 
          DisplayEnable, DisplayPort, MessagingEnable, MessagingPort, FrontFontName, 
          FrontFontBoldYN, FrontFontSize, FrontFontColour, DefaultLoading, ShowMyOrdersOnly, 
          CusSlipEnable, DeliveryEnable, DocutSlipEnable, PickUpEnable, Bay1Printer, 
          Bay2Printer, Bay3Printer, Bay4Printer, HeapPrinter, BAY1FONTSIZE, 
          BAY2FONTSIZE, BAY3FONTSIZE, BAY4FONTSIZE, BAY5FONTSIZE, HeapFONTSIZE, 
          Bay5Printer, ProIncOrders, IsApproved
        ) VALUES (
          @deviceId, '1', 0, 0, '0', 
          '0', '0', '0', 0, 0, 
          0, 0, 0, 0, 0, 
          0, 0, 0, 0, 0, 
          0, 0, 'N', 'N', 'N', 
          0, 0, 0, 0, ' ', 
          0, 0, 0, 'DI', 0, 
          0, 0, 0, 0, '0', 
          '0', '0', '0', '0', 0, 
          0, 0, 0, 0, 0, 
          ' ', 0, 0 -- 
        )
      `);

    return res.json({ allowed: false, status: "pending", deviceId: deviceId });

  } catch (error) {
    console.error("[Backend Error] Device registration failed:", error);
    return res.status(500).json({ error: "Internal server database error.", message: error.message });
  }
});

app.post('/api/orders/confirm-cart', confirmCartHandler);
app.post('/api/cart/confirm', confirmCartHandler);
app.post('/api/confirm-cart', confirmCartHandler);
app.post('/api/billing/add-item', billingAddItemHandler);
app.post('/api/add-billing-item', billingAddItemHandler);
app.post('/api/billing/remove-item', billingRemoveItemHandler);
app.post('/api/remove-billing-item', billingRemoveItemHandler);
app.get('/api/billing/active-items', getActiveBillItemsHandler);