const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET / - public (Kiosk/Check-in-Formular braucht dies)
router.get('/', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM visit_purposes WHERE active = true ORDER BY sort_order ASC, name ASC').all();
  res.json(rows);
});

// POST /
router.post('/', authenticate, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name erforderlich' });
  const maxOrder = (await db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM visit_purposes').get()).m;
  const result = await db.prepare('INSERT INTO visit_purposes (name, sort_order) VALUES (?, ?)').run(name.trim(), maxOrder + 1);
  res.status(201).json(await db.prepare('SELECT * FROM visit_purposes WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /reorder - muss vor /:id stehen, damit Express 'reorder' nicht als id matched
router.put('/reorder', authenticate, async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order array erforderlich' });
  await db.transaction(async (tx) => {
    const update = tx.prepare('UPDATE visit_purposes SET sort_order = ? WHERE id = ?');
    for (const { id, sort_order } of order) await update.run(sort_order, id);
  })();
  res.json({ ok: true });
});

// PUT /:id
router.put('/:id', authenticate, async (req, res) => {
  const { name, sort_order } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name erforderlich' });
  await db.prepare('UPDATE visit_purposes SET name = ?, sort_order = COALESCE(?, sort_order) WHERE id = ?')
    .run(name.trim(), sort_order ?? null, req.params.id);
  res.json(await db.prepare('SELECT * FROM visit_purposes WHERE id = ?').get(req.params.id));
});

// DELETE /:id - soft delete
router.delete('/:id', authenticate, async (req, res) => {
  await db.prepare('UPDATE visit_purposes SET active = false WHERE id = ?').run(req.params.id);
  res.json({ message: 'Besuchszweck deaktiviert' });
});

module.exports = router;
