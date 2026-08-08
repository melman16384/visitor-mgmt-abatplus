const express = require('express');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const adminOnly = [authenticate, requireRole(['admin'])];

const SECRET_KEYS = ['sso_client_secret'];

const getSettings = async (req, res) => {
  const rows = await db.prepare('SELECT key, value FROM system_settings').all();
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
    'sso_tenant_id', 'sso_client_id', 'sso_client_secret', 'sso_allowed_domains', 'notify_from_email',
  ];
  const upsert = db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value');
  const tx = db.transaction(async (updates) => {
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

module.exports = router;
