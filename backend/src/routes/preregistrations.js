const express = require('express');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { log } = require('../services/audit-log');

const router = express.Router();

const SELECT = `
  SELECT p.*, h.name as host_name
  FROM preregistrations p
  LEFT JOIN hosts h ON p.host_id = h.id
`;

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
  const { visitor_first_name, visitor_last_name, visitor_company, host_id, expected_date, expected_time, notes } = req.body;
  if (!visitor_first_name || !visitor_last_name) {
    return res.status(400).json({ error: 'Vor- und Nachname erforderlich' });
  }

  const result = db.prepare(`
    INSERT INTO preregistrations (visitor_first_name, visitor_last_name, visitor_company, host_id, expected_date, expected_time, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(visitor_first_name, visitor_last_name, visitor_company || null, host_id || null, expected_date || null, expected_time || null, notes || null);

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
    INSERT INTO visits (visitor_id, host_id, checked_in_at, status, checked_in_by)
    VALUES (?, ?, ?, 'active', ?)
  `).run(visitor.id, prereg.host_id || null, new Date().toISOString(), req.user.id);

  db.prepare("UPDATE preregistrations SET status = 'checked_in' WHERE id = ?").run(prereg.id);

  const visit = db.prepare(`
    SELECT v.*, h.name as host_name, u.name as checked_in_by_name
    FROM visits v LEFT JOIN hosts h ON v.host_id = h.id LEFT JOIN users u ON v.checked_in_by = u.id
    WHERE v.id = ?
  `).get(visitResult.lastInsertRowid);

  try { log('CHECKIN', req.user.name, `${visitor.first_name} ${visitor.last_name} (Vorregistrierung)`); } catch {}
  res.json({ visitor, visit });
});

// DELETE /:id — admin: permanent delete; user: soft cancel
router.delete('/:id', authenticate, (req, res) => {
  const prereg = db.prepare('SELECT id FROM preregistrations WHERE id = ?').get(req.params.id);
  if (!prereg) return res.status(404).json({ error: 'Vorregistrierung nicht gefunden' });

  if (req.user.role === 'admin') {
    db.prepare('DELETE FROM preregistrations WHERE id = ?').run(req.params.id);
    res.json({ message: 'Vorregistrierung gelöscht' });
  } else {
    db.prepare("UPDATE preregistrations SET status = 'cancelled' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Vorregistrierung storniert' });
  }
});

module.exports = router;
