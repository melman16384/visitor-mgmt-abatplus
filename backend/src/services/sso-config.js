const db = require('../db/database');

// Single source of truth for the Microsoft app registration used both for
// interactive SSO login (auth-microsoft.js) and app-only Graph directory
// access (graph-directory.js) — one Azure app registration, not two.
// DB-backed (system_settings), falling back to .env so existing installs
// that only set AZURE_* env vars keep working without a forced migration.
async function getSetting(key, envFallback) {
  const row = await db.prepare('SELECT value FROM system_settings WHERE `key` = ?').get(key);
  const value = row?.value?.trim();
  return value || envFallback || '';
}

async function getSsoConfig() {
  const tenantId = await getSetting('sso_tenant_id', process.env.AZURE_TENANT_ID);
  const clientId = await getSetting('sso_client_id', process.env.AZURE_CLIENT_ID);
  const clientSecret = await getSetting('sso_client_secret', process.env.AZURE_CLIENT_SECRET);
  if (!tenantId || !clientId || !clientSecret) return null;
  return { tenantId, clientId, clientSecret };
}

async function getNotifyFromEmail() {
  return getSetting('notify_from_email', process.env.NOTIFY_FROM_EMAIL);
}

// Zugriffsliste: nur hier gelistete E-Mails dürfen sich per SSO anmelden.
// Ersetzt die frühere domainweite Allowlist durch eine Liste einzelner Benutzer.
async function getAllowedUser(email) {
  const row = await db.prepare('SELECT email, role FROM sso_allowed_users WHERE LOWER(email) = ?').get(email.toLowerCase());
  return row || null;
}

module.exports = { getSsoConfig, getNotifyFromEmail, getAllowedUser };
