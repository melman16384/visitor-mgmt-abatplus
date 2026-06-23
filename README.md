# abat+ Besucherverwaltung

Schlanke, mitarbeitergesteuerte Besucherverwaltung für abat+. Mitarbeiter checken Besucher direkt vom eigenen Desktop oder Handy ein — kein Empfangskiosk, keine Selbstbedienung.

**Stack:** React 19 · Vite · Tailwind CSS 4 · Express.js 5 · SQLite · JWT · Microsoft SSO (MSAL)

---

## Features

- **Check-in / Check-out** — Mitarbeiter checkt Besucher ein; „Erfasst am [Zeit] durch [Name]" wird gespeichert
- **Vorregistrierungen** — Besucher vorab eintragen, bei Ankunft per Klick einchecken
- **Microsoft SSO** — Login mit Firmenkonto; User + Mitarbeiter-Eintrag werden automatisch beim ersten Login angelegt
- **Auto-Checkout** — täglich zur konfigurierten Uhrzeit (Standard: 20:00), abschaltbar
- **Datenschutz-Checkbox** — kein Unterschriftspad
- **Vollständig responsiv** — Handy + Desktop

## Rollen

| Rolle | Rechte |
|---|---|
| `admin` | Alles inkl. Benutzerverwaltung & Einstellungen |
| `user` | Einchecken, Auschecken, Besucher & Vorregistrierungen lesen |

---

## Installation

### Voraussetzungen

```bash
# Node.js 22+
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs nginx
npm install -g pm2
```

### 1. Repository klonen

```bash
git clone https://github.com/melman16384/visitor-mgmt-abatplus.git /opt/visitor-mgmt-abatplus
```

### 2. Abhängigkeiten installieren

```bash
cd /opt/visitor-mgmt-abatplus/backend && npm install
cd /opt/visitor-mgmt-abatplus/frontend && npm install
```

### 3. Backend konfigurieren

```bash
cd /opt/visitor-mgmt-abatplus/backend
cp .env.example .env
nano .env
```

`.env` Inhalt:

```env
PORT=3001
JWT_SECRET=<openssl rand -hex 64>
DB_PATH=/opt/visitor-mgmt-abatplus/backend/data/visitors.db
APP_URL=https://deine-domain.de

# Microsoft SSO (Azure App Registration)
AZURE_CLIENT_ID=
AZURE_TENANT_ID=
AZURE_CLIENT_SECRET=

# Initialer Admin (nur beim ersten Start wirksam)
# ADMIN_EMAIL=admin@firma.de
# ADMIN_PASSWORD=SicheresPasswort123!
```

```bash
mkdir -p /opt/visitor-mgmt-abatplus/backend/data
```

### 4. Frontend bauen

```bash
cd /opt/visitor-mgmt-abatplus/frontend
npm run build
```

### 5. Nginx einrichten

```bash
nano /etc/nginx/sites-available/besucher
```

```nginx
server {
    listen 80;
    server_name deine-domain.de;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name deine-domain.de;

    ssl_certificate     /etc/ssl/besucher/cert.pem;
    ssl_certificate_key /etc/ssl/besucher/key.pem;

    root /opt/visitor-mgmt-abatplus/frontend/dist;
    index index.html;

    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        expires 0;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;
    }

    location ~* \.(js|css|png|jpg|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
ln -s /etc/nginx/sites-available/besucher /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 6. SSL-Zertifikat

Hinter Cloudflare reicht ein selbst-signiertes Origin-Zertifikat:

```bash
mkdir -p /etc/ssl/besucher
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -days 3650 -nodes \
  -out /etc/ssl/besucher/cert.pem \
  -keyout /etc/ssl/besucher/key.pem \
  -subj "/CN=deine-domain.de/O=Firma/C=DE"
```

Alternativ: Cloudflare Origin Certificate im Dashboard generieren.

### 7. Backend starten

```bash
cd /opt/visitor-mgmt-abatplus/backend
pm2 start src/index.js --name visitor-mgmt --cwd /opt/visitor-mgmt-abatplus/backend
pm2 save
pm2 startup   # Angezeigten Befehl ausführen
```

### 8. Erster Login

Standard-Zugangsdaten nach Erstinstallation:

| E-Mail | Passwort |
|---|---|
| `admin@example.com` | `ChangeMe123!` |

> Passwort sofort unter **Einstellungen → Passwort** ändern.

---

## Microsoft SSO einrichten

**Azure Portal → Microsoft Entra ID → App-Registrierungen → Neue Registrierung**

| Feld | Wert |
|---|---|
| Kontotypen | Nur diese Organisation |
| Umleitungs-URI | `https://deine-domain.de/api/auth/microsoft/callback` |

Benötigte Werte aus der App-Registrierung in `.env` eintragen:
- `AZURE_CLIENT_ID` — Anwendungs-ID
- `AZURE_TENANT_ID` — Verzeichnis-ID
- `AZURE_CLIENT_SECRET` — Neues Clientgeheimnis

API-Berechtigungen: `openid`, `profile`, `email`, `User.Read` (Administratorzustimmung erteilen).

```bash
pm2 restart visitor-mgmt --update-env
```

**Beim ersten Microsoft-Login** wird automatisch ein Benutzer (Rolle: `user`) und ein Mitarbeiter-Eintrag angelegt.

---

## Updates

```bash
git pull
cd frontend && npm run build
pm2 restart visitor-mgmt
```

## Passwort zurücksetzen

```bash
cd /opt/visitor-mgmt-abatplus/backend
HASH=$(node -e "const b=require('bcryptjs'); b.hash('NeuesPasswort123!',12).then(h=>process.stdout.write(h))")
sqlite3 data/visitors.db "UPDATE users SET password_hash='$HASH' WHERE email='admin@example.com';"
```
