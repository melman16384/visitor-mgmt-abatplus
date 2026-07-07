const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { log } = require('../services/audit-log');

const router = express.Router();
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;

// POST /login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
  if (!user) {
    try { log('LOGIN_FAILED', email, 'Benutzer nicht gefunden'); } catch {}
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    try { log('LOGIN_FAILED', email, 'Falsches Passwort'); } catch {}
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  try { log('LOGIN', email, 'Login erfolgreich'); } catch {}
  const { password_hash, ...clean } = user;
  res.json({ token, user: clean });
});

// GET /me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /logout
router.post('/logout', (req, res) => {
  res.json({ message: 'Erfolgreich abgemeldet' });
});

// PUT /change-password
router.put('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Aktuelles und neues Passwort erforderlich' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen lang sein' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
  }
  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
  res.json({ message: 'Passwort erfolgreich geändert' });
});

module.exports = router;
