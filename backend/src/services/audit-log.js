const fs = require('fs');
const path = require('path');

const LOG_DIR = '/opt/visitor-mgmt/logs';
const RETENTION_DAYS = 90;

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function logFilePath(dateStr) {
  return path.join(LOG_DIR, `audit-${dateStr}.log`);
}

function log(action, actor, detail) {
  try {
    ensureLogDir();
    const entry = JSON.stringify({ ts: new Date().toISOString(), action, actor, detail }) + '\n';
    fs.appendFileSync(logFilePath(todayStr()), entry, 'utf8');
  } catch (e) {
    console.error('[audit-log] Fehler beim Schreiben:', e.message);
  }
}

function cleanup() {
  try {
    ensureLogDir();
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(LOG_DIR);
    for (const file of files) {
      const match = file.match(/^audit-(\d{4}-\d{2}-\d{2})\.log$/);
      if (!match) continue;
      if (new Date(match[1]).getTime() < cutoff) {
        fs.unlinkSync(path.join(LOG_DIR, file));
        console.log(`[audit-log] Gelöscht: ${file}`);
      }
    }
  } catch (e) {
    console.error('[audit-log] Fehler beim Cleanup:', e.message);
  }
}

function listAvailableDates() {
  try {
    ensureLogDir();
    return fs.readdirSync(LOG_DIR)
      .filter(f => /^audit-\d{4}-\d{2}-\d{2}\.log$/.test(f))
      .map(f => f.replace('audit-', '').replace('.log', ''))
      .sort()
      .reverse();
  } catch (e) {
    return [];
  }
}

function readDay(dateStr) {
  try {
    const filePath = logFilePath(dateStr);
    if (!fs.existsSync(filePath)) return [];
    return fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .filter(l => l.trim())
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

module.exports = { log, cleanup, listAvailableDates, readDay, logFilePath, LOG_DIR };
