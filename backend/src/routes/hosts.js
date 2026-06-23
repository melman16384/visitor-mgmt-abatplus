const express = require('express');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET / - public for check-in form dropdown
router.get('/', (req, res) => {
  const { search = '' } = req.query;
  let where = ['h.active = 1'];
  let params = [];

  if (search) {
    where.push('(h.name LIKE ? OR h.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const rows = db.prepare(`
    SELECT h.id, h.name, h.email, h.active, h.created_at
    FROM hosts h
    WHERE ${where.join(' AND ')}
    ORDER BY h.name ASC
  `).all(...params);

  res.json(rows);
});

// GET /:id
router.get('/:id', authenticate, (req, res) => {
  const host = db.prepare('SELECT id, name, email, active, created_at FROM hosts WHERE id = ?').get(req.params.id);
  if (!host) return res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
  res.json(host);
});

// POST /
router.post('/', authenticate, requireRole(['admin']), (req, res) => {
  const { name, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Name erforderlich' });

  const result = db.prepare('INSERT INTO hosts (name, email) VALUES (?, ?)').run(name, email || null);
  res.status(201).json(db.prepare('SELECT id, name, email, active, created_at FROM hosts WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /:id
router.put('/:id', authenticate, requireRole(['admin']), (req, res) => {
  const { name, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Name erforderlich' });
  db.prepare('UPDATE hosts SET name = ?, email = ? WHERE id = ?').run(name, email || null, req.params.id);
  res.json(db.prepare('SELECT id, name, email, active, created_at FROM hosts WHERE id = ?').get(req.params.id));
});

// DELETE /:id — soft delete
router.delete('/:id', authenticate, requireRole(['admin']), (req, res) => {
  db.prepare('UPDATE hosts SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Mitarbeiter deaktiviert' });
});

module.exports = router;
