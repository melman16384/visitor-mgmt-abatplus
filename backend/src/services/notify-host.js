const db = require('../db/database');
const graphDirectory = require('./graph-directory');

// Best-effort Benachrichtigung des Gastgebers bei Ankunft eines Besuchers.
// Wirft nie — Fehler werden geloggt, der Check-in-Vorgang darf dadurch nie fehlschlagen.
async function notifyHostOfArrival(host, visitorName) {
  if (!host || !host.email) return;
  if (!graphDirectory.isConfigured()) return;

  const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'notify_host_on_arrival'").get();
  if (setting && setting.value === 'false') return;

  try {
    await graphDirectory.sendMail(
      host.email,
      `Ihr Besuch ist eingetroffen: ${visitorName}`,
      `${visitorName} ist soeben eingetroffen und wurde eingecheckt.\n\nabat+ Besucherverwaltung`
    );
  } catch (err) {
    console.error('[Gastgeber-Benachrichtigung] Fehler:', err.message);
  }
}

module.exports = { notifyHostOfArrival };
