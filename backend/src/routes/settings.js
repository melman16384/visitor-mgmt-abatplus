const express = require('express');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const adminOnly = [authenticate, requireRole(['admin'])];

const getSettings = (req, res) => {
  const rows = db.prepare('SELECT key, value FROM system_settings').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
};

router.get('/', ...adminOnly, getSettings);
router.get('/system', ...adminOnly, getSettings);

const putSettings = (req, res) => {
  const allowed = ['auto_checkout_enabled', 'auto_checkout_time', 'data_retention_days'];
  const upsert = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
  const tx = db.transaction((updates) => {
    for (const [key, value] of Object.entries(updates)) {
      if (allowed.includes(key)) upsert.run(key, String(value));
    }
  });
  tx(req.body);
  const rows = db.prepare('SELECT key, value FROM system_settings').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
};

router.put('/', ...adminOnly, putSettings);
router.put('/system', ...adminOnly, putSettings);

module.exports = router;
