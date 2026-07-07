const db = require('../db/database');

// Findet einen Host per E-Mail oder legt ihn an (z.B. aus SSO-Login oder AD-Autocomplete).
// ad_object_id wird nachgetragen, falls ein bestehender Host noch keinen hat.
function findOrCreateHostByEmail(name, email, adObjectId) {
  const lowerEmail = email.toLowerCase();
  const existing = db.prepare('SELECT * FROM hosts WHERE LOWER(email) = ?').get(lowerEmail);

  if (existing) {
    if (adObjectId && !existing.ad_object_id) {
      db.prepare('UPDATE hosts SET ad_object_id = ? WHERE id = ?').run(adObjectId, existing.id);
    }
    return db.prepare('SELECT * FROM hosts WHERE id = ?').get(existing.id);
  }

  const result = db.prepare(`
    INSERT INTO hosts (name, email, active, ad_object_id)
    VALUES (?, ?, 1, ?)
  `).run(name, lowerEmail, adObjectId || null);

  return db.prepare('SELECT * FROM hosts WHERE id = ?').get(result.lastInsertRowid);
}

// Für Gastgeber ohne AD-Treffer / ohne E-Mail: manuelle Freitext-Eingabe.
// Ohne E-Mail kann nicht sauber dedupliziert werden — wir vermeiden zumindest
// Duplikate bei wiederholt demselben eingegebenen Namen.
function findOrCreateManualHost(name) {
  const existing = db.prepare('SELECT * FROM hosts WHERE email IS NULL AND name = ?').get(name);
  if (existing) return existing;

  const result = db.prepare('INSERT INTO hosts (name, email, active) VALUES (?, NULL, 1)').run(name);
  return db.prepare('SELECT * FROM hosts WHERE id = ?').get(result.lastInsertRowid);
}

module.exports = { findOrCreateHostByEmail, findOrCreateManualHost };
