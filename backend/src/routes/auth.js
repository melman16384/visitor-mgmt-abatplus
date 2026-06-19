const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateSecret, verifySync, generateURI } = require('otplib');
const QRCode = require('qrcode');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { log } = require('../services/audit-log');

const router = express.Router();

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const COMPANY = process.env.COMPANY_NAME || 'abat AG';

function recordFailedLogin(table, id) {
  db.prepare(`
    UPDATE ${table}
    SET failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE
          WHEN failed_login_attempts + 1 >= ? THEN datetime('now', '+${LOCK_MINUTES} minutes')
          ELSE locked_until
        END
    WHERE id = ?
  `).run(MAX_ATTEMPTS, id);
}

function recordSuccessfulLogin(table, id) {
  db.prepare(`UPDATE ${table} SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?`).run(id);
}

function checkLocked(user) {
  if (user.locked_until && new Date(user.locked_until + 'Z') > new Date()) {
    const remaining = Math.ceil((new Date(user.locked_until + 'Z') - new Date()) / 60000);
    return `Account gesperrt. Bitte in ${remaining} Minute${remaining !== 1 ? 'n' : ''} erneut versuchen.`;
  }
  return null;
}

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

  const lockMsg = checkLocked(user);
  if (lockMsg) {
    try { log('LOGIN_BLOCKED', email, `Account gesperrt bis ${user.locked_until}`); } catch {}
    return res.status(429).json({ error: lockMsg });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    recordFailedLogin('users', user.id);
    const updated = db.prepare('SELECT failed_login_attempts FROM users WHERE id = ?').get(user.id);
    const remaining = MAX_ATTEMPTS - updated.failed_login_attempts;
    try { log('LOGIN_FAILED', email, `Falsches Passwort (Versuch ${updated.failed_login_attempts}/${MAX_ATTEMPTS})`); } catch {}
    if (remaining <= 0) {
      return res.status(429).json({ error: `Account gesperrt. Bitte in ${LOCK_MINUTES} Minuten erneut versuchen.` });
    }
    return res.status(401).json({ error: `Ungültige Anmeldedaten (noch ${remaining} Versuch${remaining !== 1 ? 'e' : ''})` });
  }

  recordSuccessfulLogin('users', user.id);

  // 2FA enabled → issue short-lived partial token
  if (user.totp_enabled && user.totp_secret) {
    const partialToken = jwt.sign(
      { type: 'pending_2fa', userId: user.id },
      JWT_SECRET,
      { expiresIn: '5m' }
    );
    try { log('LOGIN_2FA_REQUIRED', email, '2FA-Code angefordert'); } catch {}
    return res.json({ requires_2fa: true, partial_token: partialToken });
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  try { log('LOGIN', email, 'Admin-Login erfolgreich'); } catch {}
  const { password_hash, failed_login_attempts, locked_until, totp_secret, ...clean } = user;
  res.json({ token, user: clean });
});

// POST /2fa/verify  — second step: submit TOTP code after password
router.post('/2fa/verify', (req, res) => {
  const { partial_token, code } = req.body;
  if (!partial_token || !code) {
    return res.status(400).json({ error: 'Token und Code erforderlich' });
  }
  let payload;
  try {
    payload = jwt.verify(partial_token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Sitzung abgelaufen – bitte neu anmelden' });
  }
  if (payload.type !== 'pending_2fa') {
    return res.status(401).json({ error: 'Ungültiger Token' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(payload.userId);
  if (!user || !user.totp_secret) {
    return res.status(401).json({ error: 'Benutzer nicht gefunden' });
  }

  const valid = verifySync({ token: code.replace(/\s/g, ''), secret: user.totp_secret }).valid;
  if (!valid) {
    try { log('LOGIN_2FA_FAILED', user.email, 'Falscher 2FA-Code'); } catch {}
    return res.status(401).json({ error: 'Ungültiger Code. Bitte erneut versuchen.' });
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  try { log('LOGIN', user.email, 'Admin-Login mit 2FA erfolgreich'); } catch {}
  const { password_hash, failed_login_attempts, locked_until, totp_secret, ...clean } = user;
  res.json({ token, user: clean });
});

// POST /2fa/setup  — generate a new TOTP secret for current user
router.post('/2fa/setup', authenticate, async (req, res) => {
  const secret = generateSecret();
  const uri = generateURI({ type: 'totp', label: req.user.email, secret, issuer: `${COMPANY} Besucherverwaltung` });
  const qrDataUrl = await QRCode.toDataURL(uri);

  // Store secret temporarily (not yet enabled — only confirmed after verify-setup)
  db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?').run(secret, req.user.id);
  res.json({ qr: qrDataUrl, secret });
});

// POST /2fa/confirm  — user scanned QR, enters code to activate
router.post('/2fa/confirm', authenticate, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code erforderlich' });

  const user = db.prepare('SELECT totp_secret FROM users WHERE id = ?').get(req.user.id);
  if (!user?.totp_secret) {
    return res.status(400).json({ error: '2FA noch nicht eingerichtet. Bitte erst /2fa/setup aufrufen.' });
  }

  const valid = verifySync({ token: code.replace(/\s/g, ''), secret: user.totp_secret }).valid;
  if (!valid) return res.status(401).json({ error: 'Ungültiger Code. QR-Code korrekt gescannt?' });

  db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(req.user.id);
  try { log('2FA_ENABLED', req.user.email, '2FA aktiviert'); } catch {}
  res.json({ message: '2FA erfolgreich aktiviert' });
});

// POST /2fa/disable  — user disables own 2FA (needs password + current totp)
router.post('/2fa/disable', authenticate, (req, res) => {
  const { password, code } = req.body;
  if (!password || !code) {
    return res.status(400).json({ error: 'Passwort und 2FA-Code erforderlich' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Passwort falsch' });
  }
  if (user.totp_secret) {
    const valid = verifySync({ token: code.replace(/\s/g, ''), secret: user.totp_secret }).valid;
    if (!valid) return res.status(401).json({ error: 'Ungültiger 2FA-Code' });
  }

  db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').run(req.user.id);
  try { log('2FA_DISABLED', req.user.email, '2FA deaktiviert'); } catch {}
  res.json({ message: '2FA erfolgreich deaktiviert' });
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
  const valid = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
  res.json({ message: 'Passwort erfolgreich geändert' });
});

module.exports = router;
