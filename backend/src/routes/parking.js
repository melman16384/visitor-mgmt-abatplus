const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET / - all spots with occupancy (public for kiosk to show available spots)
router.get('/', (req, res) => {
  const spots = db.prepare('SELECT * FROM parking_spots WHERE active = 1 ORDER BY sort_order ASC, name ASC').all();
  const occupied = db.prepare(`
    SELECT parking_spot FROM visits WHERE status = 'active' AND parking_spot IS NOT NULL
  `).all().map(r => r.parking_spot);
  res.json(spots.map(s => ({ ...s, occupied: occupied.includes(s.name) })));
});

// POST /
router.post('/', authenticate, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name erforderlich' });
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM parking_spots').get().m;
  const result = db.prepare('INSERT INTO parking_spots (name, sort_order) VALUES (?, ?)').run(name.trim(), max + 1);
  res.status(201).json(db.prepare('SELECT * FROM parking_spots WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /:id
router.put('/:id', authenticate, (req, res) => {
  const { name, sort_order } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name erforderlich' });
  db.prepare('UPDATE parking_spots SET name = ?, sort_order = COALESCE(?, sort_order) WHERE id = ?')
    .run(name.trim(), sort_order ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM parking_spots WHERE id = ?').get(req.params.id));
});

// DELETE /:id
router.delete('/:id', authenticate, (req, res) => {
  db.prepare('UPDATE parking_spots SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Parkplatz deaktiviert' });
});

module.exports = router;
