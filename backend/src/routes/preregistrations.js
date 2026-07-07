const express = require('express');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { log } = require('../services/audit-log');
const { findOrCreateHostByEmail, findOrCreateManualHost } = require('../services/hosts-helper');
const { notifyHostOfArrival } = require('../services/notify-host');

const router = express.Router();

const SELECT = `
  SELECT p.*, h.name as host_name, h.email as host_email
  FROM preregistrations p
  LEFT JOIN hosts h ON p.host_id = h.id
`;

function resolveHostId(body) {
  const { host_id, host_name, host_email, host_ad_object_id } = body;
  if (host_id) return host_id;
  if (host_email) return findOrCreateHostByEmail(host_name || host_email, host_email, host_ad_object_id).id;
  if (host_name) return findOrCreateManualHost(host_name).id;
  return null;
}

// GET /
router.get('/', authenticate, (req, res) => {
  const { status } = req.query;
  let where = [];
  let params = [];

  if (status) { where.push('p.status = ?'); params.push(status); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`${SELECT} ${whereClause} ORDER BY p.expected_date ASC, p.expected_time ASC`).all(...params);
  res.json(rows);
});

// POST / - create preregistration
router.post('/', authenticate, (req, res) => {
  const { visitor_first_name, visitor_last_name, visitor_company, expected_date, expected_time, notes } = req.body;
  if (!visitor_first_name || !visitor_last_name) {
    return res.status(400).json({ error: 'Vor- und Nachname erforderlich' });
  }

  const hostId = resolveHostId(req.body);

  const result = db.prepare(`
    INSERT INTO preregistrations (visitor_first_name, visitor_last_name, visitor_company, host_id, expected_date, expected_time, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(visitor_first_name, visitor_last_name, visitor_company || null, hostId, expected_date || null, expected_time || null, notes ? notes.trim() : null);

  const prereg = db.prepare(`${SELECT} WHERE p.id = ?`).get(result.lastInsertRowid);
  try { log('VORREGISTRIERUNG', req.user.name, `${visitor_first_name} ${visitor_last_name}`); } catch {}
  res.status(201).json(prereg);
});

// PUT /:id
router.put('/:id', authenticate, (req, res) => {
  const { visitor_first_name, visitor_last_name, visitor_company, host_id, expected_date, expected_time, notes } = req.body;
  db.prepare(`
    UPDATE preregistrations SET visitor_first_name = ?, visitor_last_name = ?, visitor_company = ?,
      host_id = ?, expected_date = ?, expected_time = ?, notes = ?
    WHERE id = ?
  `).run(visitor_first_name, visitor_last_name, visitor_company || null, host_id || null, expected_date, expected_time || null, notes || null, req.params.id);
  res.json(db.prepare(`${SELECT} WHERE p.id = ?`).get(req.params.id));
});

// POST /:id/checkin — employee checks in a preregistered visitor
router.post('/:id/checkin', authenticate, (req, res) => {
  const prereg = db.prepare('SELECT * FROM preregistrations WHERE id = ? AND status = ?').get(req.params.id, 'pending');
  if (!prereg) return res.status(404).json({ error: 'Vorregistrierung nicht gefunden oder bereits eingecheckt' });

  const { checked_in_at } = req.body;
  const checkinTime = checked_in_at ? new Date(checked_in_at) : new Date();

  // Find or create visitor
  let visitor = db.prepare(
    'SELECT * FROM visitors WHERE lower(first_name) = lower(?) AND lower(last_name) = lower(?)'
  ).get(prereg.visitor_first_name, prereg.visitor_last_name);

  if (!visitor) {
    const r = db.prepare('INSERT INTO visitors (first_name, last_name, company) VALUES (?, ?, ?)')
      .run(prereg.visitor_first_name, prereg.visitor_last_name, prereg.visitor_company || null);
    visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(r.lastInsertRowid);
  }

  const visitResult = db.prepare(`
    INSERT INTO visits (visitor_id, host_id, checked_in_at, notes, status, checked_in_by)
    VALUES (?, ?, ?, ?, 'active', ?)
  `).run(visitor.id, prereg.host_id || null, checkinTime.toISOString(), prereg.notes || null, req.user.id);

  db.prepare("UPDATE preregistrations SET status = 'checked_in' WHERE id = ?").run(prereg.id);

  const visit = db.prepare(`
    SELECT v.*, h.name as host_name, h.email as host_email, u.name as checked_in_by_name
    FROM visits v LEFT JOIN hosts h ON v.host_id = h.id LEFT JOIN users u ON v.checked_in_by = u.id
    WHERE v.id = ?
  `).get(visitResult.lastInsertRowid);

  try { log('CHECKIN', req.user.name, `${visitor.first_name} ${visitor.last_name} (Vorregistrierung)`); } catch {}

  if (visit.host_email) {
    notifyHostOfArrival({ email: visit.host_email }, `${visitor.first_name} ${visitor.last_name}`);
  }

  res.json({ visitor, visit });
});

// DELETE /:id — bei offener (pending) Vorregistrierung: Absagen (Status → cancelled),
// erlaubt für Admin oder zugeordneten Gastgeber. Bei bereits abgesagter Vorregistrierung:
// endgültiges Löschen, nur Admin.
router.delete('/:id', authenticate, (req, res) => {
  const prereg = db.prepare(`${SELECT} WHERE p.id = ?`).get(req.params.id);
  if (!prereg) return res.status(404).json({ error: 'Vorregistrierung nicht gefunden' });

  const isAdmin = req.user.role === 'admin';
  const isAssignedHost = prereg.host_email && prereg.host_email.toLowerCase() === req.user.email.toLowerCase();

  if (prereg.status === 'pending') {
    if (!isAdmin && !isAssignedHost) {
      return res.status(403).json({ error: 'Nur der zugeordnete Gastgeber oder ein Administrator kann absagen' });
    }
    db.prepare("UPDATE preregistrations SET status = 'cancelled' WHERE id = ?").run(req.params.id);
    return res.json({ message: 'Vorregistrierung storniert' });
  }

  if (!isAdmin) {
    return res.status(403).json({ error: 'Nur ein Administrator kann endgültig löschen' });
  }
  db.prepare('DELETE FROM preregistrations WHERE id = ?').run(req.params.id);
  res.json({ message: 'Vorregistrierung gelöscht' });
});

module.exports = router;
