const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

for (const v of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
  if (!process.env[v]) throw new Error(`${v} environment variable is required`);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  timezone: 'Z',
});

// Ohne diesen Handler wirft ein Fehler auf einer idle Connection ein uncaught
// 'error'-Event und reißt den ganzen Prozess mit runter.
pool.on('error', (err) => {
  console.error('[db] Unerwarteter Fehler auf idle Connection:', err.message);
});

// `executor` ist entweder der Pool (Autocommit je Query) oder eine per
// transaction() gepinnte Connection (alle Queries auf derselben Connection,
// zwischen BEGIN/COMMIT) — dieselbe prepare()/exec()-Logik für beide, damit
// Code innerhalb einer Transaktion tatsächlich auf der transaktionalen
// Connection läuft statt querbeet über den Pool.
function makeQueryable(executor) {
  function prepare(sql) {
    return {
      async get(...params) {
        const [rows] = await executor.query(sql, params);
        return rows[0];
      },
      async all(...params) {
        const [rows] = await executor.query(sql, params);
        return rows;
      },
      async run(...params) {
        const [result] = await executor.query(sql, params);
        return { changes: result.affectedRows, lastInsertRowid: result.insertId };
      },
    };
  }

  async function exec(sql) {
    await executor.query(sql);
  }

  return { prepare, exec };
}

const { prepare, exec } = makeQueryable(pool);

// fn erhält als erstes Argument ein auf die transaktionale Connection
// gebundenes { prepare, exec } — darüber müssen alle Queries innerhalb der
// Transaktion laufen, sonst landen sie (über den Pool) auf einer anderen
// Connection als BEGIN/COMMIT und die Atomarität geht verloren.
function transaction(fn) {
  return async (...args) => {
    const conn = await pool.getConnection();
    const tx = makeQueryable(conn);
    try {
      await conn.beginTransaction();
      const result = await fn(tx, ...args);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  };
}

const CHARSET = 'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci';

// Reihenfolge wichtig — FOREIGN KEY-Klauseln brauchen die referenzierte
// Tabelle bereits angelegt (visits verweist u.a. auf visit_purposes).
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB ${CHARSET}`,

  `CREATE TABLE IF NOT EXISTS hosts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    department VARCHAR(255),
    active TINYINT(1) DEFAULT 1,
    ad_object_id VARCHAR(191),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB ${CHARSET}`,

  `CREATE TABLE IF NOT EXISTS visitors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB ${CHARSET}`,

  `CREATE TABLE IF NOT EXISTS visit_purposes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) UNIQUE NOT NULL,
    sort_order INT DEFAULT 0,
    active TINYINT(1) DEFAULT 1
  ) ENGINE=InnoDB ${CHARSET}`,

  `CREATE TABLE IF NOT EXISTS visits (
    id INT PRIMARY KEY AUTO_INCREMENT,
    visitor_id INT NOT NULL,
    host_id INT,
    checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    checked_out_at DATETIME,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'active',
    privacy_accepted TINYINT(1) DEFAULT 0,
    checked_in_by INT,
    purpose_id INT,
    FOREIGN KEY (visitor_id) REFERENCES visitors(id),
    FOREIGN KEY (host_id) REFERENCES hosts(id),
    FOREIGN KEY (checked_in_by) REFERENCES users(id),
    FOREIGN KEY (purpose_id) REFERENCES visit_purposes(id)
  ) ENGINE=InnoDB ${CHARSET}`,

  `CREATE TABLE IF NOT EXISTS preregistrations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    visitor_first_name VARCHAR(255) NOT NULL,
    visitor_last_name VARCHAR(255) NOT NULL,
    visitor_company VARCHAR(255),
    host_id INT,
    expected_date DATE,
    expected_time TIME,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES hosts(id)
  ) ENGINE=InnoDB ${CHARSET}`,

  `CREATE TABLE IF NOT EXISTS system_settings (
    \`key\` VARCHAR(191) PRIMARY KEY,
    value TEXT NOT NULL
  ) ENGINE=InnoDB ${CHARSET}`,

  // Einzelne per SSO zum Login berechtigte Benutzer (ersetzt die frühere
  // domainweite Allowlist) — Rolle wird bei jedem SSO-Login synchronisiert.
  `CREATE TABLE IF NOT EXISTS sso_allowed_users (
    email VARCHAR(255) PRIMARY KEY,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB ${CHARSET}`,
];

// Boot-time idempotente Migrationen. MariaDB (10.0.2+) unterstützt IF [NOT]
// EXISTS nativ auf ADD/DROP COLUMN und CREATE INDEX, daher keine
// PRAGMA-artige Introspektion nötig. FOREIGN-KEY-Spalten (visitor_id,
// host_id, checked_in_by, purpose_id) bekommen von InnoDB automatisch einen
// Index — hier nur die übrigen, häufig gefilterten Spalten.
const MIGRATION_STATEMENTS = [
  'CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status)',
  'CREATE INDEX IF NOT EXISTS idx_visits_checked_in_at ON visits(checked_in_at)',
  'CREATE INDEX IF NOT EXISTS idx_visits_checked_out_at ON visits(checked_out_at)',
  'CREATE INDEX IF NOT EXISTS idx_hosts_email ON hosts(email)',
  'CREATE INDEX IF NOT EXISTS idx_hosts_ad_object_id ON hosts(ad_object_id)',
  'CREATE INDEX IF NOT EXISTS idx_preregistrations_expected_date ON preregistrations(expected_date)',
  'CREATE INDEX IF NOT EXISTS idx_preregistrations_status ON preregistrations(status)',
];

const SETTING_DEFAULTS = {
  auto_checkout_enabled: 'true',
  auto_checkout_time: '20:00',
  data_retention_days: '365',
  notify_host_on_arrival: 'true',
  privacy_policy_enabled: 'true',
  privacy_policy_text: '',
  entra_sync_enabled: 'false',
  entra_sync_filter: '',
};

async function initializeDatabase() {
  for (const stmt of SCHEMA_STATEMENTS) {
    await pool.query(stmt);
  }
  for (const stmt of MIGRATION_STATEMENTS) {
    await pool.query(stmt);
  }

  await exec("UPDATE users SET role = 'admin' WHERE role IN ('superadmin', 'admin')");
  await exec("UPDATE users SET role = 'user' WHERE role = 'receptionist'");

  for (const [k, v] of Object.entries(SETTING_DEFAULTS)) {
    await pool.query('INSERT IGNORE INTO system_settings (`key`, value) VALUES (?, ?)', [k, v]);
  }

  // Default-Besuchszwecke, falls noch keine angelegt
  const purposeCount = await prepare('SELECT COUNT(*) as c FROM visit_purposes').get();
  if (purposeCount.c === 0) {
    const defaults = ['Besprechung', 'Lieferung', 'Interview', 'Wartung', 'Sonstiges'];
    for (let i = 0; i < defaults.length; i++) {
      await pool.query('INSERT IGNORE INTO visit_purposes (name, sort_order) VALUES (?, ?)', [defaults[i], i]);
    }
  }

  // Ensure initial admin exists
  const userCount = await prepare('SELECT COUNT(*) as c FROM users').get();
  if (userCount.c === 0) {
    const email    = process.env.ADMIN_EMAIL    || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const name     = process.env.ADMIN_NAME     || 'Administrator';
    const hash = bcrypt.hashSync(password, 12);
    await prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, hash, 'admin', 1);
    console.log(`[init] Admin-Benutzer erstellt: ${email}`);
  }
}

// MariaDB DATETIME-Spalten lehnen JS' ISO-8601-Format (new Date().toISOString())
// ab — das 'T'/'Z'/die Millisekunden brechen es. Überall verwenden, wo ein
// JS Date in eine DATETIME-Spalte geschrieben oder dagegen verglichen wird.
function toSqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

const dbReady = initializeDatabase().catch((err) => {
  console.error('[db] Initialisierung fehlgeschlagen:', err);
  process.exit(1);
});

module.exports = { prepare, exec, transaction, dbReady, pool, toSqlDateTime };
