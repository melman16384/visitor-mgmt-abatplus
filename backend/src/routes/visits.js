const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { log } = require('../services/audit-log');

const router = express.Router();

// POST /:id/checkout
router.post('/:id/checkout', authenticate, async (req, res) => {
  const visit = await db.prepare(`
    SELECT v.*, vi.first_name, vi.last_name
    FROM visits v
    JOIN visitors vi ON vi.id = v.visitor_id
    WHERE v.id = ?
  `).get(req.params.id);
  if (!visit) return res.status(404).json({ error: 'Besuch nicht gefunden' });
  if (visit.status === 'completed') return res.status(400).json({ error: 'Bereits ausgecheckt' });

  await db.prepare(`UPDATE visits SET checked_out_at = ?, status = 'completed' WHERE id = ?`)
    .run(db.toSqlDateTime(new Date()), req.params.id);

  try { log('CHECKOUT', req.user.name, `${visit.first_name} ${visit.last_name}`); } catch {}

  const updated = await db.prepare('SELECT * FROM visits WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// POST /:id/reactivate — Checkout am selben Tag rückgängig machen
router.post('/:id/reactivate', authenticate, async (req, res) => {
  const visit = await db.prepare(`
    SELECT v.*, vi.first_name, vi.last_name
    FROM visits v
    JOIN visitors vi ON vi.id = v.visitor_id
    WHERE v.id = ?
  `).get(req.params.id);
  if (!visit) return res.status(404).json({ error: 'Besuch nicht gefunden' });
  if (visit.status !== 'completed') return res.status(400).json({ error: 'Besuch ist nicht ausgecheckt' });

  // mit dateStrings:true liefert mysql2 DATETIME-Spalten als "YYYY-MM-DD HH:MM:SS"
  const checkedOutDay = (visit.checked_out_at || '').slice(0, 10);
  const today = new Date().toISOString().split('T')[0];
  if (checkedOutDay !== today) {
    return res.status(400).json({ error: 'Nur am selben Tag rückgängig machbar' });
  }

  await db.prepare(`UPDATE visits SET checked_out_at = NULL, status = 'active' WHERE id = ?`).run(req.params.id);

  try { log('CHECKOUT_RÜCKGÄNGIG', req.user.name, `${visit.first_name} ${visit.last_name}`); } catch {}

  const updated = await db.prepare('SELECT * FROM visits WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// PUT /:id/times — Check-in-/Check-out-Zeit nachträglich korrigieren
router.put('/:id/times', authenticate, async (req, res) => {
  const { checked_in_at, checked_out_at } = req.body;

  const visit = await db.prepare(`
    SELECT v.*, vi.first_name, vi.last_name
    FROM visits v
    JOIN visitors vi ON vi.id = v.visitor_id
    WHERE v.id = ?
  `).get(req.params.id);
  if (!visit) return res.status(404).json({ error: 'Besuch nicht gefunden' });

  let newCheckedInAt = visit.checked_in_at;
  if (checked_in_at !== undefined) {
    const parsed = new Date(checked_in_at);
    if (isNaN(parsed.getTime())) return res.status(400).json({ error: 'Ungültige Check-in-Zeit' });
    newCheckedInAt = db.toSqlDateTime(parsed);
  }

  let newCheckedOutAt = visit.checked_out_at;
  if (checked_out_at !== undefined) {
    if (checked_out_at === null) {
      newCheckedOutAt = null;
    } else {
      const parsed = new Date(checked_out_at);
      if (isNaN(parsed.getTime())) return res.status(400).json({ error: 'Ungültige Check-out-Zeit' });
      newCheckedOutAt = db.toSqlDateTime(parsed);
    }
  }

  if (newCheckedOutAt && new Date(newCheckedOutAt) < new Date(newCheckedInAt)) {
    return res.status(400).json({ error: 'Check-out-Zeit darf nicht vor Check-in-Zeit liegen' });
  }

  await db.prepare('UPDATE visits SET checked_in_at = ?, checked_out_at = ? WHERE id = ?')
    .run(newCheckedInAt, newCheckedOutAt, req.params.id);

  try { log('ZEIT_KORRIGIERT', req.user.name, `${visit.first_name} ${visit.last_name}`); } catch {}

  const updated = await db.prepare('SELECT * FROM visits WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// GET /:id
router.get('/:id', authenticate, async (req, res) => {
  const visit = await db.prepare(`
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
