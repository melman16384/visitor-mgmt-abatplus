const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { getSyncConfig, setSyncConfig, getSyncStatus, runEntraSync } = require('../services/entra-sync');
const graphDirectory = require('../services/graph-directory');

const router = express.Router();
const adminOnly = [authenticate, requireRole(['admin'])];

router.get('/config', ...adminOnly, async (req, res) => {
  res.json(await getSyncConfig());
});

router.put('/config', ...adminOnly, async (req, res) => {
  const { enabled, filter } = req.body;
  await setSyncConfig({ enabled: !!enabled, filter: filter || '' });
  res.json(await getSyncConfig());
});

router.get('/status', ...adminOnly, async (req, res) => {
  res.json(await getSyncStatus());
});

router.post('/sync', ...adminOnly, async (req, res) => {
  if (!(await graphDirectory.isConfigured())) {
    return res.status(503).json({ error: 'Verzeichnis-Zugriff nicht konfiguriert — siehe Tab „Microsoft SSO".' });
  }
  try {
    const result = await runEntraSync();
    res.json(result);
  } catch (err) {
    console.error('[entra-sync] Manueller Sync fehlgeschlagen:', err.message);
    res.status(502).json({ error: 'Sync fehlgeschlagen' });
  }
});

module.exports = router;
