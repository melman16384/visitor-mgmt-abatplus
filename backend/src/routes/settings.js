const express = require('express');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const adminOnly = [authenticate, requireRole(['admin'])];

const getSettings = async (req, res) => {
  const rows = await db.prepare('SELECT key, value FROM system_settings').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
};

router.get('/', ...adminOnly, getSettings);
router.get('/system', ...adminOnly, getSettings);

const putSettings = async (req, res) => {
  const allowed = ['auto_checkout_enabled', 'auto_checkout_time', 'data_retention_days', 'notify_host_on_arrival'];
  const upsert = db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value');
  const tx = db.transaction(async (updates) => {
    for (const [key, value] of Object.entries(updates)) {
      if (allowed.includes(key)) await upsert.run(key, String(value));
    }
  });
  await tx(req.body);
  const rows = await db.prepare('SELECT key, value FROM system_settings').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
};

router.put('/', ...adminOnly, putSettings);
router.put('/system', ...adminOnly, putSettings);

module.exports = router;
