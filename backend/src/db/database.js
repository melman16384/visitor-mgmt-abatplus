const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.PG_HOST || '127.0.0.1',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

// Ohne diesen Handler wirft ein Fehler auf einem idle Client ein uncaught
// 'error'-Event und reißt den ganzen Prozess mit runter.
pool.on('error', (err) => {
  console.error('[db] Unerwarteter Fehler auf idle Client:', err.message);
});

// Converts a `?`-style query (better-sqlite3 convention, kept across all call sites)
// into Postgres's `$1, $2, ...` positional syntax.
function toPgQuery(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// All tables that use .run() for INSERT have an `id` SERIAL primary key — except
// system_settings, keyed by `key` — so we can auto-append RETURNING id to preserve
// the better-sqlite3 `lastInsertRowid` shape everywhere else.
function withReturningId(sql) {
  const trimmed = sql.trim();
  if (/^insert\s+into\s+system_settings/i.test(trimmed)) return sql;
  if (/^insert/i.test(trimmed) && !/returning/i.test(trimmed)) {
    return `${sql} RETURNING id`;
  }
  return sql;
}

// `executor` ist entweder der Pool (Autocommit je Query) oder ein per
// transaction() ausgecheckter Client (alle Queries auf derselben Connection,
// zwischen BEGIN/COMMIT) — dieselbe prepare()/exec()-Logik für beide, damit
// Code innerhalb einer Transaktion tatsächlich auf der transaktionalen
// Connection läuft statt querbeet über den Pool.
function makeQueryable(executor) {
  function prepare(sql) {
    const pgSql = toPgQuery(sql);
    const pgSqlWithReturning = toPgQuery(withReturningId(sql));
    return {
      async get(...params) {
        const { rows } = await executor.query(pgSql, params);
        return rows[0];
      },
      async all(...params) {
        const { rows } = await executor.query(pgSql, params);
        return rows;
      },
      async run(...params) {
        const { rows, rowCount } = await executor.query(pgSqlWithReturning, params);
        return { changes: rowCount, lastInsertRowid: rows[0] ? rows[0].id : undefined };
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
    const client = await pool.connect();
    const tx = makeQueryable(client);
    try {
      await client.query('BEGIN');
      const result = await fn(tx, ...args);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };
}

async function initializeDatabase() {
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hosts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      department TEXT,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS visitors (
      id SERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      visitor_id INTEGER NOT NULL REFERENCES visitors(id),
      host_id INTEGER REFERENCES hosts(id),
      checked_in_at TIMESTAMPTZ DEFAULT now(),
      checked_out_at TIMESTAMPTZ,
      notes TEXT,
      status TEXT DEFAULT 'active',
      privacy_accepted BOOLEAN DEFAULT false,
      checked_in_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS preregistrations (
      id SERIAL PRIMARY KEY,
      visitor_first_name TEXT NOT NULL,
      visitor_last_name TEXT NOT NULL,
      visitor_company TEXT,
      host_id INTEGER REFERENCES hosts(id),
      expected_date DATE,
      expected_time TIME,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visit_purposes (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      sort_order INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT true
    );

    -- Einzelne per SSO zum Login berechtigte Benutzer (ersetzt die frühere
    -- domainweite Allowlist) — Rolle wird bei jedem SSO-Login synchronisiert.
    CREATE TABLE IF NOT EXISTS sso_allowed_users (
      email TEXT PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_visits_visitor_id ON visits(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_visits_host_id ON visits(host_id);
    CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
    CREATE INDEX IF NOT EXISTS idx_visits_checked_in_at ON visits(checked_in_at);
    CREATE INDEX IF NOT EXISTS idx_visits_checked_out_at ON visits(checked_out_at);
    CREATE INDEX IF NOT EXISTS idx_hosts_email_lower ON hosts(LOWER(email));
    CREATE INDEX IF NOT EXISTS idx_preregistrations_expected_date ON preregistrations(expected_date);
    CREATE INDEX IF NOT EXISTS idx_preregistrations_status ON preregistrations(status);
  `);

  // Default system settings
  const settingDefaults = {
    auto_checkout_enabled: 'true',
    auto_checkout_time: '20:00',
    data_retention_days: '365',
    notify_host_on_arrival: 'true',
    privacy_policy_enabled: 'true',
    privacy_policy_text: '',
    entra_sync_enabled: 'false',
    entra_sync_filter: '',
  };
  const insertSetting = prepare('INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING');
  for (const [k, v] of Object.entries(settingDefaults)) {
    await insertSetting.run(k, v);
  }

  // --- Migrations from old schema ---
  await exec('DROP TABLE IF EXISTS watchlist');
  await exec('DROP TABLE IF EXISTS parking_spots');
  await exec('DROP TABLE IF EXISTS visit_documents');
  await exec('DROP TABLE IF EXISTS user_locations');
  await exec('DROP TABLE IF EXISTS locations');

  await exec('ALTER TABLE visits ADD COLUMN IF NOT EXISTS checked_in_by INTEGER REFERENCES users(id)');
  await exec('ALTER TABLE visits ADD COLUMN IF NOT EXISTS privacy_accepted BOOLEAN DEFAULT false');
  await exec('ALTER TABLE visits ADD COLUMN IF NOT EXISTS purpose_id INTEGER REFERENCES visit_purposes(id)');
  await exec('ALTER TABLE hosts ADD COLUMN IF NOT EXISTS ad_object_id TEXT');
  await exec('ALTER TABLE preregistrations ALTER COLUMN expected_date DROP NOT NULL');
  await exec('CREATE INDEX IF NOT EXISTS idx_hosts_ad_object_id ON hosts(ad_object_id)');

  await exec("UPDATE users SET role = 'admin' WHERE role IN ('superadmin', 'admin')");
  await exec("UPDATE users SET role = 'user' WHERE role = 'receptionist'");

  // Default-Besuchszwecke, falls noch keine angelegt
  const purposeCount = await prepare('SELECT COUNT(*) as c FROM visit_purposes').get();
  if (parseInt(purposeCount.c, 10) === 0) {
    const insertPurpose = prepare('INSERT INTO visit_purposes (name, sort_order) VALUES (?, ?) ON CONFLICT (name) DO NOTHING');
    const defaults = ['Besprechung', 'Lieferung', 'Interview', 'Wartung', 'Sonstiges'];
    for (let i = 0; i < defaults.length; i++) {
      await insertPurpose.run(defaults[i], i);
    }
  }

  // Ensure initial admin exists
  const userCount = await prepare('SELECT COUNT(*) as c FROM users').get();
  if (parseInt(userCount.c, 10) === 0) {
    const email    = process.env.ADMIN_EMAIL    || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const name     = process.env.ADMIN_NAME     || 'Administrator';
    const hash = bcrypt.hashSync(password, 12);
    await prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, hash, 'admin', true);
    console.log(`[init] Admin-Benutzer erstellt: ${email}`);
  }
}

const dbReady = initializeDatabase().catch((err) => {
  console.error('[db] Initialisierung fehlgeschlagen:', err);
  process.exit(1);
});

module.exports = { prepare, exec, transaction, dbReady, pool };
