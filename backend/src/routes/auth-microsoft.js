const express = require('express');
const crypto = require('crypto');
const msal = require('@azure/msal-node');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { findOrCreateHostByEmail } = require('../services/hosts-helper');

const router = express.Router();
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;
const APP_URL = process.env.APP_URL || 'http://localhost:3001';
const REDIRECT_URI = `${APP_URL}/api/auth/microsoft/callback`;
const SSO_ALLOWED_DOMAINS = (process.env.SSO_ALLOWED_DOMAINS || '')
  .split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);

// CSRF-Schutz für den OAuth-Callback: state-Werte und kurzlebige One-Time-Codes,
// über die das JWT ausgetauscht wird statt es per URL-Query zu übergeben.
const STATE_TTL_MS = 5 * 60 * 1000;
const CODE_TTL_MS = 60 * 1000;
const pendingStates = new Map();
const oneTimeCodes = new Map();

function pruneExpired(map, getExpiresAt) {
  const now = Date.now();
  for (const [key, value] of map) {
    if (getExpiresAt(value) < now) map.delete(key);
  }
}

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
    pruneExpired(pendingStates, (expiresAt) => expiresAt);
    const state = crypto.randomBytes(24).toString('hex');
    pendingStates.set(state, Date.now() + STATE_TTL_MS);

    const url = await cca.getAuthCodeUrl({
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      redirectUri: REDIRECT_URI,
      state,
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

  const { code, state, error: msError } = req.query;
  if (msError || !code) {
    console.error('[MS SSO] Callback-Fehler:', msError);
    return res.redirect(`${APP_URL}/login?error=sso_cancelled`);
  }

  pruneExpired(pendingStates, (expiresAt) => expiresAt);
  if (!state || !pendingStates.has(state)) {
    console.error('[MS SSO] Ungültiger oder abgelaufener state-Parameter (mögliches CSRF)');
    return res.redirect(`${APP_URL}/login?error=invalid_state`);
  }
  pendingStates.delete(state);

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
      const emailDomain = msEmail.split('@')[1];
      if (SSO_ALLOWED_DOMAINS.length > 0 && !SSO_ALLOWED_DOMAINS.includes(emailDomain)) {
        console.error(`[MS SSO] Auto-Provisionierung abgelehnt, Domain nicht erlaubt: ${msEmail}`);
        return res.redirect(`${APP_URL}/login?error=domain_not_allowed`);
      }

      // First login → create user + host
      const insertUser = db.prepare(`
        INSERT INTO users (name, email, password_hash, role, active)
        VALUES (?, ?, '', 'user', 1)
      `);
      const userResult = insertUser.run(msName, msEmail);
      const newUserId = userResult.lastInsertRowid;

      // Auto-create host entry
      findOrCreateHostByEmail(msName, msEmail);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId);
      console.log(`[MS SSO] Neuer Benutzer erstellt: ${msEmail}`);
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });

    // Token nicht per URL übergeben (landet sonst in Logs/Browser-Historie) —
    // stattdessen kurzlebigen, einmalig einlösbaren Code ausstellen.
    pruneExpired(oneTimeCodes, (v) => v.expiresAt);
    const exchangeCode = crypto.randomBytes(24).toString('hex');
    oneTimeCodes.set(exchangeCode, { token, expiresAt: Date.now() + CODE_TTL_MS });

    res.redirect(`${APP_URL}/auth-callback?code=${exchangeCode}`);
  } catch (err) {
    console.error('[MS SSO] Token-Fehler:', err.message);
    res.redirect(`${APP_URL}/login?error=sso_token_failed`);
  }
});

// POST /api/auth/microsoft/exchange — einmaligen Code gegen JWT tauschen
router.post('/exchange', (req, res) => {
  const { code } = req.body || {};
  pruneExpired(oneTimeCodes, (v) => v.expiresAt);

  const entry = code ? oneTimeCodes.get(code) : null;
  if (!entry) {
    return res.status(400).json({ error: 'invalid_or_expired_code' });
  }
  oneTimeCodes.delete(code);
  res.json({ token: entry.token });
});

module.exports = router;
