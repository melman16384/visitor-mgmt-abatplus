const jwt = require('jsonwebtoken');
const db = require('../db/database');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht autorisiert' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.prepare('SELECT id, name, email, role, password_hash FROM users WHERE id = ? AND active = true').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'Benutzer nicht gefunden' });
    // SSO-provisionierte Nutzer haben password_hash = '' — has_password sagt dem
    // Frontend, ob "Passwort ändern" überhaupt möglich ist, ohne den Hash selbst preiszugeben.
    const { password_hash, ...safeUser } = user;
    req.user = { ...safeUser, has_password: !!password_hash };
    next();
  } catch {
    return res.status(401).json({ error: 'Ungültiger Token' });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht autorisiert' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
