const db = require('../db/database');

async function runRetention() {
  const row = await db.prepare("SELECT value FROM system_settings WHERE key = 'data_retention_days'").get();
  const days = parseInt(row?.value || '0', 10);
  if (!days || days <= 0) return;

  const tx = db.transaction(async () => {
    // Delete old completed visits
    const visits = await db.prepare(`
      DELETE FROM visits
      WHERE checked_in_at < now() - (? || ' days')::interval
        AND status = 'completed'
    `).run(days);

    // Delete visitors with no remaining visits
    const visitors = await db.prepare(`
      DELETE FROM visitors
      WHERE id NOT IN (SELECT DISTINCT visitor_id FROM visits)
        AND created_at < now() - (? || ' days')::interval
    `).run(days);

    // Delete old non-pending preregistrations
    const prereg = await db.prepare(`
      DELETE FROM preregistrations
      WHERE created_at < now() - (? || ' days')::interval
        AND status != 'pending'
    `).run(days);

    return { visits: visits.changes, visitors: visitors.changes, prereg: prereg.changes };
  });

  const result = await tx();
  const total = result.visits + result.visitors + result.prereg;
  if (total > 0) {
    console.log(`[data-retention] Gelöscht: ${result.visits} Besuche, ${result.visitors} Besucher, ${result.prereg} Vorregistrierungen (>${days} Tage)`);
  }
}

function scheduleRetention() {
  // Run once at startup (catches up if server was down), then every 24h
  runRetention();
  setInterval(runRetention, 24 * 60 * 60 * 1000);
}

module.exports = { scheduleRetention };
