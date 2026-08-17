const { getSyncConfig, runEntraSync } = require('./entra-sync');

async function runIfEnabled() {
  try {
    const { enabled } = await getSyncConfig();
    if (!enabled) return;
    await runEntraSync();
  } catch (err) {
    console.error('[entra-sync] Fehler:', err.message);
  }
}

function scheduleEntraSync() {
  // Einmal beim Start (falls Server länger aus war), danach alle 24h
  runIfEnabled();
  setInterval(runIfEnabled, 24 * 60 * 60 * 1000);
}

module.exports = { scheduleEntraSync };
