const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /stats
router.get('/stats', authenticate, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const todayTotal = db.prepare(`SELECT COUNT(*) as c FROM visits WHERE date(checked_in_at) = ?`).get(today).c;
  const currentlyIn = db.prepare(`SELECT COUNT(*) as c FROM visits WHERE status = 'active'`).get().c;
  const checkedOutToday = db.prepare(`SELECT COUNT(*) as c FROM visits WHERE date(checked_out_at) = ? AND status = 'completed'`).get(today).c;
  const thisWeekTotal = db.prepare(`SELECT COUNT(*) as c FROM visits WHERE date(checked_in_at) >= ?`).get(weekStart).c;
  const thisMonthTotal = db.prepare(`SELECT COUNT(*) as c FROM visits WHERE date(checked_in_at) >= ?`).get(monthStart).c;

  res.json({
    todayTotal,
    currentlyIn,
    checkedOutToday,
    thisWeekTotal,
    thisMonthTotal,
  });
});

// GET /recent
router.get('/recent', authenticate, (req, res) => {
  const rows = db.prepare(`
    SELECT v.id, v.checked_in_at, v.checked_out_at, v.status, v.badge_number, v.purpose,
           vi.first_name, vi.last_name, vi.company, vi.abat_id,
           h.name as host_name,
           vi.id as visitor_id
    FROM visits v
    JOIN visitors vi ON v.visitor_id = vi.id
    LEFT JOIN hosts h ON v.host_id = h.id
    ORDER BY v.checked_in_at DESC
    LIMIT 10
  `).all();
  res.json(rows);
});

// GET /chart
router.get('/chart', authenticate, (req, res) => {
  const rows = db.prepare(`
    SELECT date(checked_in_at) as date, COUNT(*) as count
    FROM visits
    WHERE date(checked_in_at) >= date('now', '-14 days')
    GROUP BY date(checked_in_at)
    ORDER BY date ASC
  `).all();

  // Fill in missing days
  const data = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    const found = rows.find(r => r.date === dateStr);
    data.push({ date: dateStr, count: found ? found.count : 0 });
  }
  res.json(data);
});

module.exports = router;
