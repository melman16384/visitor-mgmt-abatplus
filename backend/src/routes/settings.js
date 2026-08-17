const express = require('express');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { runRetention } = require('../services/data-retention');

const router = express.Router();
const adminOnly = [authenticate, requireRole(['admin'])];

const SECRET_KEYS = ['sso_client_secret'];

const getSettings = async (req, res) => {
  const rows = await db.prepare('SELECT `key`, value FROM system_settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  for (const key of SECRET_KEYS) {
    settings[`${key}_set`] = !!settings[key];
    delete settings[key];
  }
  res.json(settings);
};

router.get('/', ...adminOnly, getSettings);
router.get('/system', ...adminOnly, getSettings);

const putSettings = async (req, res) => {
  const allowed = [
    'auto_checkout_enabled', 'auto_checkout_time', 'data_retention_days', 'notify_host_on_arrival',
    'sso_tenant_id', 'sso_client_id', 'sso_client_secret', 'notify_from_email',
    'privacy_policy_enabled', 'privacy_policy_text',
  ];
  const tx = db.transaction(async (t, updates) => {
    const upsert = t.prepare('INSERT INTO system_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)');
    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue;
      // Secret fields: blank submission means "leave unchanged", not "clear it".
      if (SECRET_KEYS.includes(key) && !value) continue;
      await upsert.run(key, String(value));
    }
  });
  await tx(req.body);
  await getSettings(req, res);
};

router.put('/', ...adminOnly, putSettings);
router.put('/system', ...adminOnly, putSettings);

// GET /privacy-policy - public (Kiosk/Check-in-Formular)
router.get('/privacy-policy', async (req, res) => {
  const rows = await db.prepare(
    "SELECT `key`, value FROM system_settings WHERE `key` IN ('privacy_policy_enabled', 'privacy_policy_text')"
  ).all();
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({
    enabled: s.privacy_policy_enabled !== 'false' && s.privacy_policy_enabled !== '0',
    text: s.privacy_policy_text || '',
  });
});

// POST /gdpr/cleanup - manuelle Datenschutz-Bereinigung, admin-only
router.post('/gdpr/cleanup', ...adminOnly, async (req, res) => {
  try {
    const result = await runRetention();
    res.json(result || { visits: 0, visitors: 0, prereg: 0 });
  } catch (err) {
    console.error('[GDPR-Bereinigung] Fehler:', err.message);
    res.status(500).json({ error: 'Bereinigung fehlgeschlagen' });
  }
});

// ---- Zugriffsliste für SSO-Login (einzelne Benutzer) ----

router.get('/sso-allowed-users', ...adminOnly, async (req, res) => {
  const rows = await db.prepare('SELECT email, role, created_at FROM sso_allowed_users ORDER BY email ASC').all();
  res.json(rows);
});

router.post('/sso-allowed-users', ...adminOnly, async (req, res) => {
  const { email, role } = req.body;
  if (!email || !email.trim()) return res.status(400).json({ error: 'E-Mail erforderlich' });
  const normalizedRole = role === 'admin' ? 'admin' : 'user';
  await db.prepare(`
    INSERT INTO sso_allowed_users (email, role) VALUES (?, ?)
    ON DUPLICATE KEY UPDATE role = VALUES(role)
  `).run(email.trim().toLowerCase(), normalizedRole);
  res.status(201).json({ email: email.trim().toLowerCase(), role: normalizedRole });
});

router.delete('/sso-allowed-users/:email', ...adminOnly, async (req, res) => {
  await db.prepare('DELETE FROM sso_allowed_users WHERE email = ?').run(req.params.email.toLowerCase());
  res.json({ message: 'Von Zugriffsliste entfernt' });
});

module.exports = router;
