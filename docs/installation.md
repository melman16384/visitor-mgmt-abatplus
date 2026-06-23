# Installationsanleitung — Besucherverwaltung abat+

> Zielumgebung: Ubuntu/Debian · Node.js 22+ · Nginx · Cloudflare

---

## Inhaltsverzeichnis

1. [Voraussetzungen](#1-voraussetzungen)
2. [Projekt einrichten](#2-projekt-einrichten)
3. [Backend konfigurieren](#3-backend-konfigurieren)
4. [Frontend bauen](#4-frontend-bauen)
5. [Nginx einrichten](#5-nginx-einrichten)
6. [SSL-Zertifikat (Cloudflare Origin Cert)](#6-ssl-zertifikat-cloudflare-origin-cert)
7. [Backend mit pm2 starten](#7-backend-mit-pm2-starten)
8. [Erster Start & Test](#8-erster-start--test)
9. [Cloudflare konfigurieren](#9-cloudflare-konfigurieren)
10. [Updates einspielen](#10-updates-einspielen)
11. [Datenbank-Backup](#11-datenbank-backup)

---

## 1. Voraussetzungen

```bash
# Node.js 22 installieren
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Nginx installieren
apt install -y nginx

# Versionen prüfen
node -v    # v22.x oder höher
npm -v
nginx -v

# pm2 global installieren
npm install -g pm2
```

---

## 2. Projekt einrichten

```bash
mkdir -p /opt/visitor-mgmt-abatplus
cd /opt/visitor-mgmt-abatplus

# Repository klonen
git clone <repo-url> .

# Abhängigkeiten installieren
cd /opt/visitor-mgmt-abatplus/backend && npm install
npm install
```

---

## 3. Backend konfigurieren

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
APP_URL=https://visitorplus.luwilab.work

# Initialer Admin (nur beim allerersten Start wirksam)
# ADMIN_EMAIL=admin@abat.de
# ADMIN_PASSWORD=SicheresPasswort123!
```

Datenbankverzeichnis anlegen:

```bash
mkdir -p /opt/visitor-mgmt-abatplus/backend/data
```

---

## 4. Frontend bauen

```bash
cd /opt/visitor-mgmt-abatplus/frontend
npm run build
# Erzeugt: /opt/visitor-mgmt-abatplus/frontend/dist/
```

---

## 5. Nginx einrichten

```bash
nano /etc/nginx/sites-available/visitorplus.luwilab.work
```

Inhalt:

```nginx
server {
    listen 80;
    server_name visitorplus.luwilab.work;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name visitorplus.luwilab.work;

    ssl_certificate     /etc/ssl/visitorplus/cert.pem;
    ssl_certificate_key /etc/ssl/visitorplus/key.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none';" always;

    root /opt/visitor-mgmt-abatplus/frontend/dist;
    index index.html;

    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        expires 0;
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        client_max_body_size 10M;
    }

    location ~* \.(js|css|png|jpg|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
        access_log off;
    }

    gzip on;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/javascript application/json;
}
```

Aktivieren:

```bash
ln -s /etc/nginx/sites-available/visitorplus.luwilab.work /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 6. SSL-Zertifikat (Cloudflare Origin Cert)

Da die Domain über Cloudflare proxied wird, reicht ein selbst-signiertes Zertifikat für die Origin-Verbindung (Cloudflare → Server). Der Browser sieht das Cloudflare-Zertifikat.

### Option A — Selbst-signiert (schnell, 10 Jahre gültig)

```bash
mkdir -p /etc/ssl/visitorplus
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -days 3650 -nodes \
  -out /etc/ssl/visitorplus/cert.pem \
  -keyout /etc/ssl/visitorplus/key.pem \
  -subj "/CN=visitorplus.luwilab.work/O=LuwiLab/C=DE"
chmod 600 /etc/ssl/visitorplus/key.pem
```

### Option B — Cloudflare Origin Certificate (empfohlen für Full Strict)

1. Cloudflare Dashboard → SSL/TLS → Origin Server → Create Certificate
2. Zertifikat und Key einfügen:

```bash
mkdir -p /etc/ssl/visitorplus
nano /etc/ssl/visitorplus/cert.pem   # Origin Certificate einfügen
nano /etc/ssl/visitorplus/key.pem    # Private Key einfügen
chmod 600 /etc/ssl/visitorplus/key.pem
```

---

## 7. Backend mit pm2 starten

```bash
cd /opt/visitor-mgmt-abatplus/backend
pm2 start src/index.js --name visitor-mgmt --cwd /opt/visitor-mgmt-abatplus/backend
pm2 save      # Prozessliste speichern
pm2 startup   # Auto-Start nach Reboot konfigurieren (Anweisung ausführen)
```

Status prüfen:

```bash
pm2 list
pm2 logs visitor-mgmt
```

---

## 8. Erster Start & Test

```bash
# API-Gesundheitscheck
curl http://localhost:3001/api/health

# Login testen
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ChangeMe123!"}'
```

Standard-Login:

| E-Mail | Passwort | Rolle |
|---|---|---|
| `admin@example.com` | `ChangeMe123!` | admin |

> Passwort sofort nach erstem Login unter **Einstellungen → Passwort** ändern.

---

## 9. Cloudflare konfigurieren

1. DNS: `A visitorplus.luwilab.work → <Server-IP>` (Proxy: orange Wolke ✓)
2. SSL/TLS-Modus: **Full** (oder Full Strict mit Cloudflare Origin Cert)
3. Automatic HTTPS Rewrites: aktivieren

---

## 10. Updates einspielen

```bash
cd /opt/visitor-mgmt-abatplus
git pull

# Backend-Abhängigkeiten aktualisieren (falls package.json geändert)
cd backend && npm install

# Frontend neu bauen
cd /opt/visitor-mgmt-abatplus/frontend && npm run build

# Backend neu starten
pm2 restart visitor-mgmt
```

---

## 11. Datenbank-Backup

Manuell:

```bash
sqlite3 /opt/visitor-mgmt-abatplus/backend/data/visitors.db \
  ".backup /root/backups/visitors-$(date +%Y%m%d).db"
```

Automatisch per Cron (täglich 03:00):

```bash
mkdir -p /root/backups
crontab -e
# Eintragen:
0 3 * * * sqlite3 /opt/visitor-mgmt-abatplus/backend/data/visitors.db ".backup /root/backups/visitors-$(date +\%Y\%m\%d).db"
```
