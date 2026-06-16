const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /
router.get('/', authenticate, (req, res) => {
  const { active = '1' } = req.query;
  const rows = db.prepare(`
    SELECT w.*, u.name as added_by_name
    FROM watchlist w
    LEFT JOIN users u ON w.added_by = u.id
    WHERE w.active = ?
    ORDER BY w.created_at DESC
  `).all(active === '1' ? 1 : 0);
  res.json(rows);
});

// GET /:id
router.get('/:id', authenticate, (req, res) => {
  const entry = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Eintrag nicht gefunden' });
  res.json(entry);
});

// POST /
router.post('/', authenticate, (req, res) => {
  const { first_name, last_name, email, company, reason, severity } = req.body;
  if (!first_name || !last_name || !reason) {
    return res.status(400).json({ error: 'Name und Grund erforderlich' });
  }

  const result = db.prepare(`
    INSERT INTO watchlist (first_name, last_name, email, company, reason, severity, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(first_name, last_name, email || null, company || null, reason, severity || 'medium', req.user.id);

  const entry = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(entry);
});

// PUT /:id
router.put('/:id', authenticate, (req, res) => {
  const { first_name, last_name, email, company, reason, severity, active } = req.body;
  db.prepare(`
    UPDATE watchlist SET first_name = ?, last_name = ?, email = ?, company = ?, reason = ?,
    severity = ?, active = COALESCE(?, active)
    WHERE id = ?
  `).run(first_name, last_name, email || null, company || null, reason, severity || 'medium',
    active !== undefined ? (active ? 1 : 0) : null, req.params.id);

  const entry = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(req.params.id);
  res.json(entry);
});

// DELETE /:id (deactivate)
router.delete('/:id', authenticate, (req, res) => {
  db.prepare('UPDATE watchlist SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Eintrag deaktiviert' });
});

module.exports = router;
