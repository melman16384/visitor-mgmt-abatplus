const express = require('express');
const nodemailer = require('nodemailer');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const adminOnly = [authenticate, requireRole(['superadmin', 'admin'])];

// GET /system — all settings
router.get('/system', ...adminOnly, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM system_settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json(settings);
});

// PUT /system — update one or more settings
router.put('/system', ...adminOnly, (req, res) => {
  const allowed = ['gdpr_retention_days', 'visitor_email_confirmation', 'printer_enabled', 'printer_ip', 'printer_port', 'smtp_security', 'privacy_policy_text', 'privacy_policy_enabled'];
  const upsert = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
  const updateMany = db.transaction((updates) => {
    for (const [key, value] of Object.entries(updates)) {
      if (allowed.includes(key)) upsert.run(key, String(value));
    }
  });
  updateMany(req.body);
  const rows = db.prepare('SELECT key, value FROM system_settings').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

function getSecurityOptions(security) {
  switch (security) {
    case 'ssl':  return { secure: true };
    case 'none': return { secure: false, ignoreTLS: true };
    default:     return { secure: false };
  }
}

// GET /privacy-policy - PUBLIC - kiosk reads this without auth
router.get('/privacy-policy', (req, res) => {
  const textRow = db.prepare("SELECT value FROM system_settings WHERE key = 'privacy_policy_text'").get();
  const enabledRow = db.prepare("SELECT value FROM system_settings WHERE key = 'privacy_policy_enabled'").get();
  res.json({
    text: textRow?.value || '',
    enabled: enabledRow?.value !== 'false',
  });
});

// GET /smtp-config — current SMTP config from .env (password masked)
router.get('/smtp-config', ...adminOnly, (req, res) => {
  const hasPass = !!(process.env.SMTP_PASS && process.env.SMTP_PASS !== 'your-app-password');
  const secRow  = db.prepare("SELECT value FROM system_settings WHERE key = 'smtp_security'").get();
  const PORT_MAP = { starttls: '587', ssl: '465', none: '25' };
  const security = secRow?.value || process.env.SMTP_SECURITY || 'starttls';
  res.json({
    smtp_host:    process.env.SMTP_HOST    || '',
    smtp_port:    PORT_MAP[security]       || process.env.SMTP_PORT || '587',
    smtp_user:    process.env.SMTP_USER    || '',
    smtp_pass:    hasPass ? '••••••••' : '',
    from_email:   process.env.FROM_EMAIL   || '',
    company_name: process.env.COMPANY_NAME || '',
  });
});

// POST /email-test — send a test email using current SMTP config
router.post('/email-test', ...adminOnly, async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Empfänger-E-Mail erforderlich' });

  const host     = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port     = parseInt(process.env.SMTP_PORT || '587');
  const user     = process.env.SMTP_USER;
  const pass     = process.env.SMTP_PASS;
  const from     = process.env.FROM_EMAIL || 'noreply@abat.de';
  const company  = process.env.COMPANY_NAME || 'abat AG';

  if (!user || user === 'your@email.com') {
    return res.status(400).json({ error: 'SMTP nicht konfiguriert — bitte .env-Datei prüfen' });
  }

  const secRow   = db.prepare("SELECT value FROM system_settings WHERE key = 'smtp_security'").get();
  const security = secRow?.value || process.env.SMTP_SECURITY || 'starttls';
  const secOpts  = getSecurityOptions(security);

  const SECURITY_LABELS = { starttls: 'STARTTLS', ssl: 'SSL/TLS', none: 'Keine' };

  try {
    const transport = nodemailer.createTransport({ host, port, ...secOpts, auth: { user, pass } });
    await transport.verify();
    await transport.sendMail({
      from: `"${company} Besucherverwaltung" <${from}>`,
      to,
      subject: `Test-E-Mail — ${company} Besucherverwaltung`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#004B87;">Test-E-Mail</h2>
          <p>Diese E-Mail bestätigt, dass die SMTP-Konfiguration der <strong>${company} Besucherverwaltung</strong> korrekt funktioniert.</p>
          <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
            <tr><td style="padding:4px 16px 4px 0;color:#666;">SMTP-Server</td><td style="font-weight:600;">${host}:${port}</td></tr>
            <tr><td style="padding:4px 16px 4px 0;color:#666;">Verschlüsselung</td><td style="font-weight:600;">${SECURITY_LABELS[security] || security}</td></tr>
            <tr><td style="padding:4px 16px 4px 0;color:#666;">Absender</td><td style="font-weight:600;">${from}</td></tr>
            <tr><td style="padding:4px 16px 4px 0;color:#666;">Gesendet um</td><td style="font-weight:600;">${new Date().toLocaleString('de-DE')}</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="color:#999;font-size:12px;">Automatisch generiert von der Besucherverwaltung.</p>
        </div>
      `,
    });
    res.json({ message: `Test-E-Mail erfolgreich an ${to} gesendet` });
  } catch (err) {
    res.status(502).json({ error: `SMTP-Fehler: ${err.message}` });
  }
});

// POST /gdpr/cleanup — anonymize old visitor data
router.post('/gdpr/cleanup', ...adminOnly, (req, res) => {
  const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'gdpr_retention_days'").get();
  const days = parseInt(setting?.value || '365');
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const result = db.prepare(`
    UPDATE visitors SET
      first_name = '[GELÖSCHT]',
      last_name = '[GELÖSCHT]',
      email = NULL,
      phone = NULL,
      company = NULL,
      photo_path = NULL
    WHERE created_at < ?
    AND id NOT IN (SELECT DISTINCT visitor_id FROM visits WHERE status = 'active')
    AND first_name != '[GELÖSCHT]'
  `).run(cutoff);

  res.json({ anonymized: result.changes, cutoff_date: cutoff, retention_days: days });
});

module.exports = router;
