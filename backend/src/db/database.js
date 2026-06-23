const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/visitors.db';
const dbDir = path.dirname(path.resolve(dbPath));

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(path.resolve(dbPath));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hosts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      department TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS visitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id INTEGER NOT NULL,
      host_id INTEGER,
      checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      checked_out_at DATETIME,
      notes TEXT,
      status TEXT DEFAULT 'active',
      privacy_accepted INTEGER DEFAULT 0,
      checked_in_by INTEGER,
      FOREIGN KEY (visitor_id) REFERENCES visitors(id),
      FOREIGN KEY (host_id) REFERENCES hosts(id),
      FOREIGN KEY (checked_in_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS preregistrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_first_name TEXT NOT NULL,
      visitor_last_name TEXT NOT NULL,
      visitor_company TEXT,
      host_id INTEGER,
      expected_date DATE NOT NULL,
      expected_time TIME,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (host_id) REFERENCES hosts(id)
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

initializeDatabase();

// Default system settings
const settingDefaults = {
  auto_checkout_enabled: 'true',
  auto_checkout_time: '20:00',
};
const insertSetting = db.prepare('INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)');
Object.entries(settingDefaults).forEach(([k, v]) => insertSetting.run(k, v));

// --- Migrations from old schema ---

// Drop old tables
db.exec('DROP TABLE IF EXISTS watchlist');
db.exec('DROP TABLE IF EXISTS parking_spots');
db.exec('DROP TABLE IF EXISTS visit_documents');
db.exec('DROP TABLE IF EXISTS user_locations');
db.exec('DROP TABLE IF EXISTS visit_purposes');
db.exec('DROP TABLE IF EXISTS locations');

// Migrate visits: add checked_in_by + privacy_accepted if missing
const visitsInfo = db.prepare('PRAGMA table_info(visits)').all();
if (!visitsInfo.find(c => c.name === 'checked_in_by')) {
  db.exec('ALTER TABLE visits ADD COLUMN checked_in_by INTEGER REFERENCES users(id)');
}
if (!visitsInfo.find(c => c.name === 'privacy_accepted')) {
  db.exec('ALTER TABLE visits ADD COLUMN privacy_accepted INTEGER DEFAULT 0');
}

// Remove unused visits columns (SQLite only supports DROP COLUMN from 3.35+)
// We leave extra columns in place — they are simply ignored in queries.

// Migrate user roles: superadmin/admin → admin, receptionist → user
db.exec("UPDATE users SET role = 'admin' WHERE role IN ('superadmin', 'admin')");
db.exec("UPDATE users SET role = 'user' WHERE role = 'receptionist'");

// Ensure initial admin exists
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (userCount.c === 0) {
  const email    = process.env.ADMIN_EMAIL    || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const name     = process.env.ADMIN_NAME     || 'Administrator';
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)')
    .run(name, email, hash, 'admin');
  console.log(`[init] Admin-Benutzer erstellt: ${email}`);
}

module.exports = db;
