const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const adminOnly = [authenticate, requireRole(['admin'])];

// GET /
router.get('/', ...adminOnly, (req, res) => {
  const rows = db.prepare('SELECT id, name, email, role, active, created_at FROM users ORDER BY name ASC').all();
  res.json(rows);
});

// POST /
router.post('/', ...adminOnly, async (req, res) => {
  const { name, email, password, role, active } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, E-Mail und Passwort erforderlich' });
  if (password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Ungültige Rolle' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'E-Mail bereits vergeben' });

  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?)').run(name, email, hash, role, active !== false ? 1 : 0);
  const user = db.prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// PUT /:id
router.put('/:id', ...adminOnly, (req, res) => {
  const { name, email, role, active } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name und E-Mail erforderlich' });
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Ungültige Rolle' });

  const conflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.params.id);
  if (conflict) return res.status(409).json({ error: 'E-Mail bereits vergeben' });

  db.prepare('UPDATE users SET name = ?, email = ?, role = ?, active = ? WHERE id = ?')
    .run(name, email, role, active ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?').get(req.params.id));
});

// POST /:id/reset-password
router.post('/:id/reset-password', ...adminOnly, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
  const hash = await bcrypt.hash(password, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ message: 'Passwort zurückgesetzt' });
});

// DELETE /:id (deactivate)
router.delete('/:id', ...adminOnly, (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Eigenes Konto kann nicht deaktiviert werden' });
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Benutzer deaktiviert' });
});

module.exports = router;
