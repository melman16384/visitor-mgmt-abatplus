const express = require('express');
const msal = require('@azure/msal-node');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const APP_URL = process.env.APP_URL || 'http://localhost:3001';
const REDIRECT_URI = `${APP_URL}/api/auth/microsoft/callback`;

function getMsalClient() {
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!clientId || !tenantId || !clientSecret) return null;

  return new msal.ConfidentialClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientSecret,
    },
  });
}

// GET /api/auth/microsoft — initiate login
router.get('/', async (req, res) => {
  const cca = getMsalClient();
  if (!cca) return res.status(503).json({ error: 'Microsoft SSO nicht konfiguriert' });

  try {
    const url = await cca.getAuthCodeUrl({
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      redirectUri: REDIRECT_URI,
    });
    res.redirect(url);
  } catch (err) {
    console.error('[MS SSO] Auth URL Fehler:', err);
    res.redirect(`${APP_URL}/login?error=sso_failed`);
  }
});

// GET /api/auth/microsoft/callback — handle Azure redirect
router.get('/callback', async (req, res) => {
  const cca = getMsalClient();
  if (!cca) return res.redirect(`${APP_URL}/login?error=sso_not_configured`);

  const { code, error: msError } = req.query;
  if (msError || !code) {
    console.error('[MS SSO] Callback-Fehler:', msError);
    return res.redirect(`${APP_URL}/login?error=sso_cancelled`);
  }

  try {
    const result = await cca.acquireTokenByCode({
      code,
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      redirectUri: REDIRECT_URI,
    });

    const graphRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName', {
      headers: { Authorization: `Bearer ${result.accessToken}` },
    });
    const graphUser = await graphRes.json();

    const msEmail = (graphUser.mail || graphUser.userPrincipalName || result.account.username || '').toLowerCase();
    const msName = graphUser.displayName || result.idTokenClaims?.name || result.account.name || msEmail.split('@')[0];

    if (!msEmail) {
      return res.redirect(`${APP_URL}/login?error=no_email`);
    }

    // Existing user → login
    let user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? AND active = 1').get(msEmail);

    if (!user) {
      // First login → create user + host
      const insertUser = db.prepare(`
        INSERT INTO users (name, email, password_hash, role, active)
        VALUES (?, ?, '', 'user', 1)
      `);
      const userResult = insertUser.run(msName, msEmail);
      const newUserId = userResult.lastInsertRowid;

      // Auto-create host entry
      const existingHost = db.prepare('SELECT id FROM hosts WHERE LOWER(email) = ?').get(msEmail);
      if (!existingHost) {
        db.prepare(`
          INSERT INTO hosts (name, email, active)
          VALUES (?, ?, 1)
        `).run(msName, msEmail);
      }

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId);
      console.log(`[MS SSO] Neuer Benutzer erstellt: ${msEmail}`);
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });

    // Redirect to frontend with token
    res.redirect(`${APP_URL}/auth-callback?token=${token}`);
  } catch (err) {
    console.error('[MS SSO] Token-Fehler:', err.message);
    res.redirect(`${APP_URL}/login?error=sso_token_failed`);
  }
});

module.exports = router;
