const ldap = require('ldapjs');
const db = require('../db/database');

function getConfig() {
  const keys = [
    'ldap_enabled', 'ldap_url', 'ldap_bind_dn', 'ldap_bind_password',
    'ldap_base_dn', 'ldap_filter', 'ldap_attr_name', 'ldap_attr_email',
    'ldap_attr_department', 'ldap_attr_phone',
  ];
  const cfg = {};
  keys.forEach(k => {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(k);
    cfg[k] = row?.value ?? '';
  });
  return cfg;
}

function createClient(url) {
  return ldap.createClient({ url, connectTimeout: 8000, timeout: 10000 });
}

function bindClient(client, dn, password) {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, err => err ? reject(err) : resolve());
  });
}

function searchAll(client, baseDn, opts) {
  return new Promise((resolve, reject) => {
    const entries = [];
    client.search(baseDn, opts, (err, res) => {
      if (err) return reject(err);
      res.on('searchEntry', e => entries.push(e.object));
      res.on('error', reject);
      res.on('end', () => resolve(entries));
    });
  });
}

async function testConnection() {
  const cfg = getConfig();
  if (!cfg.ldap_url) throw new Error('LDAP-URL nicht konfiguriert');
  const client = createClient(cfg.ldap_url);
  try {
    await bindClient(client, cfg.ldap_bind_dn, cfg.ldap_bind_password);
    return true;
  } finally {
    client.destroy();
  }
}

async function syncHosts() {
  const cfg = getConfig();
  if (cfg.ldap_enabled !== 'true') throw new Error('LDAP nicht aktiviert');
  if (!cfg.ldap_url || !cfg.ldap_base_dn) throw new Error('LDAP-URL und Base-DN erforderlich');

  const client = createClient(cfg.ldap_url);
  try {
    await bindClient(client, cfg.ldap_bind_dn, cfg.ldap_bind_password);

    const attrName = cfg.ldap_attr_name || 'displayName';
    const attrEmail = cfg.ldap_attr_email || 'mail';
    const attrDept = cfg.ldap_attr_department || 'department';
    const attrPhone = cfg.ldap_attr_phone || 'telephoneNumber';

    const entries = await searchAll(client, cfg.ldap_base_dn, {
      filter: cfg.ldap_filter || '(objectClass=user)',
      scope: 'sub',
      attributes: ['dn', attrName, attrEmail, attrDept, attrPhone],
    });

    let synced = 0;
    let skipped = 0;

    for (const entry of entries) {
      const name = entry[attrName] || entry.cn || null;
      const email = entry[attrEmail] || null;
      const department = entry[attrDept] || null;
      const phone = entry[attrPhone] || null;
      const dn = entry.dn;

      if (!email || !name) { skipped++; continue; }

      const existing = db.prepare('SELECT id FROM hosts WHERE email = ? OR ldap_dn = ?').get(email, dn);
      if (existing) {
        db.prepare('UPDATE hosts SET name=?, email=?, department=?, phone=?, ldap_dn=?, active=1 WHERE id=?')
          .run(name, email, department, phone, dn, existing.id);
      } else {
        db.prepare('INSERT INTO hosts (name, email, department, phone, ldap_dn, active) VALUES (?,?,?,?,?,1)')
          .run(name, email, department, phone, dn);
      }
      synced++;
    }

    return { synced, skipped, total: entries.length };
  } finally {
    client.destroy();
  }
}

module.exports = { testConnection, syncHosts, getConfig };
