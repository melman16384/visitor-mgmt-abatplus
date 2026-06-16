const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET / - public for kiosk
router.get('/', (req, res) => {
  const { search = '', location_id } = req.query;
  let where = ['h.active = 1'];
  let params = [];

  if (search) {
    where.push('(h.name LIKE ? OR h.email LIKE ? OR h.department LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (location_id) {
    where.push('h.location_id = ?');
    params.push(location_id);
  }

  const rows = db.prepare(`
    SELECT h.*, l.name as location_name
    FROM hosts h
    LEFT JOIN locations l ON h.location_id = l.id
    WHERE ${where.join(' AND ')}
    ORDER BY h.name ASC
  `).all(...params);

  res.json(rows);
});

// GET /:id
router.get('/:id', authenticate, (req, res) => {
  const host = db.prepare(`
    SELECT h.*, l.name as location_name
    FROM hosts h
    LEFT JOIN locations l ON h.location_id = l.id
    WHERE h.id = ?
  `).get(req.params.id);
  if (!host) return res.status(404).json({ error: 'Gastgeber nicht gefunden' });
  res.json(host);
});

// POST /
router.post('/', authenticate, (req, res) => {
  const { name, email, phone, department, location_id } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name und E-Mail erforderlich' });

  const result = db.prepare(`
    INSERT INTO hosts (name, email, phone, department, location_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, email, phone || null, department || null, location_id || null);

  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(host);
});

// PUT /:id
router.put('/:id', authenticate, (req, res) => {
  const { name, email, phone, department, location_id } = req.body;
  db.prepare(`
    UPDATE hosts SET name = ?, email = ?, phone = ?, department = ?, location_id = ?
    WHERE id = ?
  `).run(name, email, phone || null, department || null, location_id || null, req.params.id);

  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(req.params.id);
  res.json(host);
});

// DELETE /:id
router.delete('/:id', authenticate, (req, res) => {
  db.prepare('UPDATE hosts SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Gastgeber deaktiviert' });
});

module.exports = router;
