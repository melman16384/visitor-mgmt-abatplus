const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { log } = require('../services/audit-log');

const router = express.Router();

// POST /:id/checkout
router.post('/:id/checkout', authenticate, (req, res) => {
  const visit = db.prepare(`
    SELECT v.*, vi.first_name, vi.last_name
    FROM visits v
    JOIN visitors vi ON vi.id = v.visitor_id
    WHERE v.id = ?
  `).get(req.params.id);
  if (!visit) return res.status(404).json({ error: 'Besuch nicht gefunden' });
  if (visit.status === 'completed') return res.status(400).json({ error: 'Bereits ausgecheckt' });

  db.prepare(`UPDATE visits SET checked_out_at = ?, status = 'completed' WHERE id = ?`)
    .run(new Date().toISOString(), req.params.id);

  try { log('CHECKOUT', req.user.name, `${visit.first_name} ${visit.last_name}`); } catch {}

  const updated = db.prepare('SELECT * FROM visits WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// GET /:id
router.get('/:id', authenticate, (req, res) => {
  const visit = db.prepare(`
    SELECT v.*, vi.first_name, vi.last_name, vi.company,
           h.name as host_name
    FROM visits v
    JOIN visitors vi ON v.visitor_id = vi.id
    LEFT JOIN hosts h ON v.host_id = h.id
    WHERE v.id = ?
  `).get(req.params.id);
  if (!visit) return res.status(404).json({ error: 'Besuch nicht gefunden' });
  res.json(visit);
});

module.exports = router;
