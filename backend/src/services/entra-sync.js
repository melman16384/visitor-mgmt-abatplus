const db = require('../db/database');
const graphDirectory = require('./graph-directory');

// Geplanter Gastgeber-Sync: zieht alle Benutzer aus dem Microsoft-Verzeichnis
// (dieselbe App-Registrierung wie SSO/Verzeichnis-Zugriff, Application-Permission
// User.Read.All) und pflegt sie als Gastgeber ein. Nutzt hosts.ad_object_id als
// stabilen Schlüssel — dieselbe Spalte, die auch beim SSO-Login und der
// AD-Autocomplete gesetzt wird.

async function getSetting(key) {
  const row = await db.prepare('SELECT value FROM system_settings WHERE `key` = ?').get(key);
  return row?.value ?? '';
}

async function setSetting(key, value) {
  await db.prepare(`
    INSERT INTO system_settings (\`key\`, value) VALUES (?, ?)
    ON DUPLICATE KEY UPDATE value = VALUES(value)
  `).run(key, value);
}

async function getSyncConfig() {
  const enabled = (await getSetting('entra_sync_enabled')) === 'true';
  const filter = await getSetting('entra_sync_filter');
  return { enabled, filter };
}

async function setSyncConfig({ enabled, filter }) {
  await setSetting('entra_sync_enabled', enabled ? 'true' : 'false');
  await setSetting('entra_sync_filter', filter || '');
}

async function getSyncStatus() {
  const lastSyncAt = await getSetting('entra_last_sync_at');
  const raw = await getSetting('entra_last_sync_result');
  let lastResult = null;
  try { lastResult = raw ? JSON.parse(raw) : null; } catch { lastResult = null; }
  return { lastSyncAt: lastSyncAt || null, lastResult };
}

async function fetchAllGraphUsers(filter) {
  const token = await graphDirectory.getAppToken();
  const users = [];
  let url = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,accountEnabled&$top=999';
  if (filter && filter.trim()) url += `&$filter=${encodeURIComponent(filter.trim())}`;

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Graph-Verzeichnisabruf fehlgeschlagen: ${res.status}`);
    const data = await res.json();
    users.push(...(data.value || []));
    url = data['@odata.nextLink'] || null;
  }
  return users;
}

async function runEntraSync() {
  const { filter } = await getSyncConfig();
  const graphUsers = (await fetchAllGraphUsers(filter))
    .filter(u => (u.mail || u.userPrincipalName) && u.accountEnabled !== false);

  let created = 0;
  let updated = 0;

  for (const gu of graphUsers) {
    const email = (gu.mail || gu.userPrincipalName).toLowerCase();
    const name = gu.displayName || email.split('@')[0];

    const existing = await db.prepare('SELECT * FROM hosts WHERE ad_object_id = ?').get(gu.id);
    if (existing) {
      if (existing.name !== name || existing.email !== email || !existing.active) {
        await db.prepare('UPDATE hosts SET name = ?, email = ?, active = true WHERE id = ?').run(name, email, existing.id);
        updated++;
      }
      continue;
    }

    const byEmail = await db.prepare('SELECT * FROM hosts WHERE LOWER(email) = ? AND ad_object_id IS NULL').get(email);
    if (byEmail) {
      await db.prepare('UPDATE hosts SET ad_object_id = ?, name = ?, active = true WHERE id = ?').run(gu.id, name, byEmail.id);
      updated++;
      continue;
    }

    await db.prepare('INSERT INTO hosts (name, email, active, ad_object_id) VALUES (?, ?, true, ?)').run(name, email, gu.id);
    created++;
  }

  // Gastgeber deaktivieren, deren AD-Objekt im aktuellen Sync-Ergebnis fehlt
  // (nur solche, die zuvor per Verzeichnis-Sync/Login verknüpft wurden).
  const currentIds = graphUsers.map(u => u.id);
  const linkedHosts = await db.prepare('SELECT id, ad_object_id FROM hosts WHERE ad_object_id IS NOT NULL AND active = true').all();
  let deactivated = 0;
  for (const h of linkedHosts) {
    if (!currentIds.includes(h.ad_object_id)) {
      await db.prepare('UPDATE hosts SET active = false WHERE id = ?').run(h.id);
      deactivated++;
    }
  }

  const result = { created, updated, deactivated, total: graphUsers.length };
  await setSetting('entra_last_sync_at', new Date().toISOString());
  await setSetting('entra_last_sync_result', JSON.stringify(result));
  console.log(`[entra-sync] ${created} neu, ${updated} aktualisiert, ${deactivated} deaktiviert (von ${graphUsers.length} Verzeichnis-Benutzern)`);
  return result;
}

module.exports = { getSyncConfig, setSyncConfig, getSyncStatus, runEntraSync };
