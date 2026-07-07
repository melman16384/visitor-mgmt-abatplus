const msal = require('@azure/msal-node');

// App-only Microsoft-Graph-Zugriff (Client-Credentials-Flow) — separat von der
// interaktiven SSO-App-Registrierung (auth-microsoft.js). Wird für die
// Gastgeber-AD-Autocomplete, den Admin-Gegencheck und den Mailversand genutzt.

class DirectoryNotConfiguredError extends Error {
  constructor() {
    super('Verzeichnis-Zugriff nicht konfiguriert');
    this.code = 'DIRECTORY_NOT_CONFIGURED';
  }
}

function getConfig() {
  const tenantId = process.env.AZURE_DIRECTORY_TENANT_ID;
  const clientId = process.env.AZURE_DIRECTORY_CLIENT_ID;
  const clientSecret = process.env.AZURE_DIRECTORY_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) return null;
  return { tenantId, clientId, clientSecret };
}

let cachedClient = null;
function getClient() {
  const config = getConfig();
  if (!config) return null;
  if (!cachedClient) {
    cachedClient = new msal.ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        clientSecret: config.clientSecret,
      },
    });
  }
  return cachedClient;
}

async function getAppToken() {
  const client = getClient();
  if (!client) throw new DirectoryNotConfiguredError();
  const result = await client.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  return result.accessToken;
}

function isConfigured() {
  return getConfig() !== null;
}

// Sucht Benutzer im Verzeichnis (Name oder Mail beginnt mit query), min. 3 Zeichen.
async function searchUsers(query) {
  const token = await getAppToken();
  const q = query.replace(/'/g, "''");
  const url = `https://graph.microsoft.com/v1.0/users?$filter=startswith(displayName,'${q}') or startswith(mail,'${q}')&$select=id,displayName,mail,userPrincipalName,accountEnabled&$top=10&$count=true`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      ConsistencyLevel: 'eventual',
    },
  });
  if (!res.ok) {
    throw new Error(`Graph-Suche fehlgeschlagen: ${res.status}`);
  }
  const data = await res.json();
  return (data.value || [])
    .filter((u) => u.mail || u.userPrincipalName)
    .map((u) => ({
      id: u.id,
      name: u.displayName,
      email: (u.mail || u.userPrincipalName).toLowerCase(),
      accountEnabled: u.accountEnabled,
    }));
}

// Einzel-Lookup für den Admin-Gegencheck.
async function checkUser(email) {
  const token = await getAppToken();
  const url = `https://graph.microsoft.com/v1.0/users?$filter=mail eq '${email.replace(/'/g, "''")}' or userPrincipalName eq '${email.replace(/'/g, "''")}'&$select=id,displayName,mail,userPrincipalName,accountEnabled`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      ConsistencyLevel: 'eventual',
    },
  });
  if (!res.ok) {
    throw new Error(`Graph-Lookup fehlgeschlagen: ${res.status}`);
  }
  const data = await res.json();
  const found = (data.value || [])[0];
  if (!found) return null;
  return {
    id: found.id,
    name: found.displayName,
    email: (found.mail || found.userPrincipalName || '').toLowerCase(),
    accountEnabled: found.accountEnabled,
  };
}

// Best-effort Mailversand — Fehler werden von den Aufrufern abgefangen.
async function sendMail(to, subject, body) {
  const fromMailbox = process.env.NOTIFY_FROM_EMAIL;
  if (!fromMailbox) throw new DirectoryNotConfiguredError();
  const token = await getAppToken();

  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromMailbox)}/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'Text', content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Mailversand fehlgeschlagen: ${res.status}`);
  }
}

module.exports = { isConfigured, searchUsers, checkUser, sendMail, DirectoryNotConfiguredError };
