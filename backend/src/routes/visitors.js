const express = require('express');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { log } = require('../services/audit-log');
const { findOrCreateHostByEmail } = require('../services/hosts-helper');
const { notifyHostOfArrival } = require('../services/notify-host');

const router = express.Router();

// Liefert offene Vorregistrierungen in der gemeinsamen Zeilenform der Besucherliste
// (kein separates Datenmodell in der UI — "vorregistriert" ist nur ein Status in derselben Liste).
function getPreregRows(search) {
  const s = `%${search}%`;
  const where = search
    ? `WHERE p.status = 'pending' AND (p.visitor_first_name LIKE ? OR p.visitor_last_name LIKE ? OR p.visitor_company LIKE ?)`
    : `WHERE p.status = 'pending'`;
  const params = search ? [s, s, s] : [];

  const rows = db.prepare(`
    SELECT p.id as prereg_id, p.visitor_first_name as first_name, p.visitor_last_name as last_name,
      p.visitor_company as company, p.notes, p.expected_date, p.expected_time, p.created_at,
      h.name as host_name, h.id as host_id, h.email as host_email
    FROM preregistrations p
    LEFT JOIN hosts h ON p.host_id = h.id
    ${where}
  `).all(...params);

  return rows.map(r => ({
    ...r,
    visit_id: null,
    visit_status: 'vorregistriert',
    checked_in_at: null,
    checked_out_at: null,
    checked_in_by_name: null,
    sort_ts: r.expected_date ? `${r.expected_date}T${r.expected_time || '00:00'}` : r.created_at,
  }));
}

// GET / - paginated list
router.get('/', authenticate, (req, res) => {
  const { search = '', status = 'all', page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const s = `%${search}%`;

  const searchWhere = search
    ? `AND (vi.first_name LIKE ? OR vi.last_name LIKE ? OR vi.company LIKE ?)`
    : '';
  const searchParams = search ? [s, s, s] : [];

  if (status === 'vorregistriert') {
    const all = getPreregRows(search).sort((a, b) => (a.sort_ts < b.sort_ts ? 1 : -1));
    const total = all.length;
    const rows = all.slice(offset, offset + parseInt(limit));
    return res.json({ visitors: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  }

  if (status === 'completed') {
    const total = db.prepare(`
      SELECT COUNT(DISTINCT vi.id) as total
      FROM visitors vi
      INNER JOIN visits v ON v.visitor_id = vi.id AND v.status = 'completed'
        AND v.id = (SELECT MAX(v2.id) FROM visits v2 WHERE v2.visitor_id = vi.id AND v2.status = 'completed')
      WHERE NOT EXISTS (SELECT 1 FROM visits va WHERE va.visitor_id = vi.id AND va.status = 'active')
      ${searchWhere}
    `).get(...searchParams).total;

    const rows = db.prepare(`
      SELECT vi.id, vi.first_name, vi.last_name, vi.company, vi.email,
        v.id as visit_id, v.status as visit_status, v.checked_in_at, v.checked_out_at, v.privacy_accepted, v.notes,
        h.name as host_name, h.id as host_id,
        u.name as checked_in_by_name
      FROM visitors vi
      INNER JOIN visits v ON v.visitor_id = vi.id AND v.status = 'completed'
        AND v.id = (SELECT MAX(v2.id) FROM visits v2 WHERE v2.visitor_id = vi.id AND v2.status = 'completed')
      LEFT JOIN hosts h ON v.host_id = h.id
      LEFT JOIN users u ON v.checked_in_by = u.id
      WHERE NOT EXISTS (SELECT 1 FROM visits va WHERE va.visitor_id = vi.id AND va.status = 'active')
      ${searchWhere}
      ORDER BY v.checked_out_at DESC
      LIMIT ? OFFSET ?
    `).all(...searchParams, parseInt(limit), offset);

    return res.json({ visitors: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  }

  let where = [];
  let params = [];

  if (search) {
    where.push(`(vi.first_name LIKE ? OR vi.last_name LIKE ? OR vi.company LIKE ?)`);
    params.push(s, s, s);
  }
  if (status === 'active') {
    where.push(`v.status = 'active'`);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const visitJoin = status === 'active'
    ? `LEFT JOIN visits v ON vi.id = v.visitor_id AND v.status = 'active'`
    : `LEFT JOIN visits v ON v.id = (SELECT id FROM visits WHERE visitor_id = vi.id ORDER BY checked_in_at DESC LIMIT 1)`;

  if (status === 'active') {
    const total = db.prepare(`
      SELECT COUNT(DISTINCT vi.id) as total
      FROM visitors vi ${visitJoin}
      ${whereClause}
    `).get(...params).total;

    const rows = db.prepare(`
      SELECT vi.id, vi.first_name, vi.last_name, vi.company, vi.email,
        v.id as visit_id, v.status as visit_status, v.checked_in_at, v.checked_out_at, v.privacy_accepted, v.notes,
        h.name as host_name, h.id as host_id,
        u.name as checked_in_by_name
      FROM visitors vi
      ${visitJoin}
      LEFT JOIN hosts h ON v.host_id = h.id
      LEFT JOIN users u ON v.checked_in_by = u.id
      ${whereClause}
      ORDER BY vi.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    return res.json({ visitors: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  }

  // status === 'all' — Besuche (jeweils letzter Besuch je Besucher) und offene
  // Vorregistrierungen werden in einer gemeinsamen, gemeinsam sortierten Liste zusammengeführt.
  const visitRows = db.prepare(`
    SELECT vi.id, vi.first_name, vi.last_name, vi.company, vi.email,
      v.id as visit_id, v.status as visit_status, v.checked_in_at, v.checked_out_at, v.privacy_accepted, v.notes,
      h.name as host_name, h.id as host_id,
      u.name as checked_in_by_name
    FROM visitors vi
    ${visitJoin}
    LEFT JOIN hosts h ON v.host_id = h.id
    LEFT JOIN users u ON v.checked_in_by = u.id
    ${whereClause}
  `).all(...params).map(r => ({ ...r, sort_ts: r.checked_in_at || '' }));

  const preregRows = getPreregRows(search);

  const combined = [...visitRows, ...preregRows].sort((a, b) => (a.sort_ts < b.sort_ts ? 1 : -1));
  const total = combined.length;
  const rows = combined.slice(offset, offset + parseInt(limit));

  res.json({ visitors: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
});

// GET /active
router.get('/active', authenticate, (req, res) => {
  const rows = db.prepare(`
    SELECT v.*, vi.first_name, vi.last_name, vi.company, vi.email,
           h.name as host_name,
           u.name as checked_in_by_name
    FROM visits v
    JOIN visitors vi ON v.visitor_id = vi.id
    LEFT JOIN hosts h ON v.host_id = h.id
    LEFT JOIN users u ON v.checked_in_by = u.id
    WHERE v.status = 'active'
    ORDER BY v.checked_in_at DESC
  `).all();
  res.json(rows);
});

// POST / - check-in (auth required)
router.post('/', authenticate, (req, res) => {
  const {
    first_name, last_name, company, notes, privacy_accepted, checked_in_at,
    host_id, host_name, host_email, host_ad_object_id,
  } = req.body;
  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'Vor- und Nachname erforderlich' });
  }
  if (!notes || !notes.trim()) {
    return res.status(400).json({ error: 'Notizen sind erforderlich' });
  }

  let resolvedHostId = host_id || null;
  if (!resolvedHostId && host_email) {
    const host = findOrCreateHostByEmail(host_name || host_email, host_email, host_ad_object_id);
    resolvedHostId = host.id;
  }

  // Find or create visitor by name
  let visitor = db.prepare(
    'SELECT * FROM visitors WHERE lower(first_name) = lower(?) AND lower(last_name) = lower(?)'
  ).get(first_name, last_name);

  if (!visitor) {
    const result = db.prepare(
      'INSERT INTO visitors (first_name, last_name, company) VALUES (?, ?, ?)'
    ).run(first_name, last_name, company || null);
    visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(result.lastInsertRowid);
  } else if (company) {
    db.prepare('UPDATE visitors SET company = COALESCE(?, company) WHERE id = ?').run(company, visitor.id);
    visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(visitor.id);
  }

  const checkinTime = checked_in_at ? new Date(checked_in_at) : new Date();

  const visitResult = db.prepare(`
    INSERT INTO visits (visitor_id, host_id, checked_in_at, notes, status, privacy_accepted, checked_in_by)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(visitor.id, resolvedHostId, checkinTime.toISOString(), notes.trim(),
    privacy_accepted ? 1 : 0, req.user.id);

  const visit = db.prepare(`
    SELECT v.*, h.name as host_name, h.email as host_email, u.name as checked_in_by_name
    FROM visits v
    LEFT JOIN hosts h ON v.host_id = h.id
    LEFT JOIN users u ON v.checked_in_by = u.id
    WHERE v.id = ?
  `).get(visitResult.lastInsertRowid);

  try { log('CHECKIN', req.user.name, `${visitor.first_name} ${visitor.last_name}`); } catch {}

  if (visit.host_email) {
    notifyHostOfArrival({ email: visit.host_email }, `${visitor.first_name} ${visitor.last_name}`);
  }

  res.status(201).json({ visitor, visit });
});

// GET /:id
router.get('/:id', authenticate, (req, res) => {
  const visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Besucher nicht gefunden' });

  const visits = db.prepare(`
    SELECT v.*, h.name as host_name, u.name as checked_in_by_name
    FROM visits v
    LEFT JOIN hosts h ON v.host_id = h.id
    LEFT JOIN users u ON v.checked_in_by = u.id
    WHERE v.visitor_id = ?
    ORDER BY v.checked_in_at DESC
  `).all(req.params.id);

  res.json({ visitor, visits });
});

// PUT /:id
router.put('/:id', authenticate, (req, res) => {
  const { first_name, last_name, company, email, phone } = req.body;
  db.prepare('UPDATE visitors SET first_name = ?, last_name = ?, company = ?, email = ?, phone = ? WHERE id = ?')
    .run(first_name, last_name, company || null, email || null, phone || null, req.params.id);
  res.json(db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id));
});

// DELETE /:id — admin only
router.delete('/:id', authenticate, requireRole(['admin']), (req, res) => {
  const visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Besucher nicht gefunden' });

  const activeVisit = db.prepare("SELECT id FROM visits WHERE visitor_id = ? AND status = 'active'").get(req.params.id);
  if (activeVisit) return res.status(409).json({ error: 'Besucher ist noch eingecheckt' });

  db.transaction(() => {
    db.prepare('DELETE FROM visits WHERE visitor_id = ?').run(req.params.id);
    db.prepare('DELETE FROM visitors WHERE id = ?').run(req.params.id);
  })();

  try { log('VISITOR_GELÖSCHT', req.user.name, `${visitor.first_name} ${visitor.last_name}`); } catch {}
  res.json({ message: 'Besucher gelöscht' });
});

module.exports = router;
