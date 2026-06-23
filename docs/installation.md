# Installationsanleitung — Besucherverwaltung abat+

> Zielumgebung: Ubuntu 22.04 / Debian 12 · Node.js 22+ · Nginx · Cloudflare

Diese Anleitung beschreibt die vollständige Erstinstallation auf einem frischen Server. Voraussetzung ist ein laufender Ubuntu/Debian-Server mit Root-Zugriff und einer bei Cloudflare verwalteten Domain.

---

## Inhaltsverzeichnis

1. [Systemvoraussetzungen](#1-systemvoraussetzungen)
2. [Node.js & Nginx installieren](#2-nodejs--nginx-installieren)
3. [Repository klonen](#3-repository-klonen)
4. [Backend konfigurieren](#4-backend-konfigurieren)
5. [Microsoft SSO einrichten (Azure)](#5-microsoft-sso-einrichten-azure)
6. [Frontend bauen](#6-frontend-bauen)
7. [SSL-Zertifikat einrichten](#7-ssl-zertifikat-einrichten)
8. [Nginx einrichten](#8-nginx-einrichten)
9. [Backend mit pm2 starten](#9-backend-mit-pm2-starten)
10. [Cloudflare konfigurieren](#10-cloudflare-konfigurieren)
11. [Erster Start & Test](#11-erster-start--test)
12. [Updates einspielen](#12-updates-einspielen)
13. [Automatisches Backup](#13-automatisches-backup)

---

## 1. Systemvoraussetzungen

| Anforderung | Minimum |
|---|---|
| Betriebssystem | Ubuntu 22.04 LTS oder Debian 12 |
| RAM | 512 MB (1 GB empfohlen) |
| Disk | 2 GB |
| Node.js | 22.x oder höher |
| Nginx | aktuell |
| Domain | Bei Cloudflare verwaltet, DNS-Eintrag auf Server-IP zeigend |

Das System benötigt im laufenden Betrieb keine externen Netzwerkverbindungen außer zu Microsoft Entra ID (für den SSO-Login).

---

## 2. Node.js & Nginx installieren

```bash
# System aktualisieren
apt update && apt upgrade -y

# Node.js 22 über NodeSource installieren
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Nginx installieren
apt install -y nginx

# sqlite3 CLI installieren (für Wartungsaufgaben)
apt install -y sqlite3

# Build-Tools installieren (benötigt für native Node-Module wie better-sqlite3)
apt install -y build-essential

# Versionen prüfen
node -v    # Sollte v22.x oder höher anzeigen
npm -v
nginx -v

# pm2 global installieren (Prozessmanager)
npm install -g pm2
```

---

## 3. Repository klonen

```bash
# Zielverzeichnis erstellen
mkdir -p /opt/visitor-mgmt-abatplus

# Repository klonen (SSH oder HTTPS)
git clone https://github.com/melman16384/visitor-mgmt-abatplus.git /opt/visitor-mgmt-abatplus

# Abhängigkeiten installieren — Backend
cd /opt/visitor-mgmt-abatplus/backend
NODE_OPTIONS=--use-system-ca npm install

# Abhängigkeiten installieren — Frontend
cd /opt/visitor-mgmt-abatplus/frontend
NODE_OPTIONS=--use-system-ca npm install
```

---

## 4. Backend konfigurieren

```bash
cd /opt/visitor-mgmt-abatplus/backend

# Vorlage kopieren
cp .env.example .env

# Bearbeiten
nano .env
```

**.env ausfüllen:**

```env
PORT=3001

# Langen zufälligen String generieren:
# openssl rand -hex 64
JWT_SECRET=<hier-eintragen>

# Absoluter Pfad — nicht relativ!
DB_PATH=/opt/visitor-mgmt-abatplus/backend/data/visitors.db

# Öffentliche URL der App (ohne abschließenden Slash)
APP_URL=https://deine-domain.de

# Microsoft SSO — nach Azure-Setup eintragen (Schritt 5)
AZURE_CLIENT_ID=
AZURE_TENANT_ID=
AZURE_CLIENT_SECRET=

# Initialer Admin — nur beim allerersten Start wirksam
# Nach erstem Start diese Zeilen auskommentieren lassen
# ADMIN_EMAIL=admin@abat.de
# ADMIN_PASSWORD=SicheresPasswort123!
```

Datenbankverzeichnis anlegen:

```bash
mkdir -p /opt/visitor-mgmt-abatplus/backend/data
```

> **Wichtig:** `JWT_SECRET` muss ein langer, zufälliger String sein. Niemals leer lassen, niemals in Git einchecken. Änderungen invalidieren alle bestehenden Tokens.

---

## 5. Microsoft SSO einrichten (Azure)

> Dieser Schritt kann auch nach der Erstinstallation nachgeholt werden. Ohne SSO-Konfiguration ist der lokale Admin-Login weiterhin nutzbar.

### App-Registrierung erstellen

1. **Azure Portal** öffnen: https://portal.azure.com
2. Navigieren zu: **Microsoft Entra ID → App-Registrierungen → Neue Registrierung**
3. Felder ausfüllen:

| Feld | Wert |
|---|---|
| Name | `abat+ Besucherverwaltung` |
| Unterstützte Kontotypen | Nur Konten in diesem Organisationsverzeichnis (Single Tenant) |
| Umleitungs-URI | Typ: **Web** — URL: `https://deine-domain.de/api/auth/microsoft/callback` |

4. Klick auf **Registrieren**

### Werte notieren

Nach der Registrierung auf der Übersichtsseite:
- **Anwendungs-ID (Client-ID)** → `AZURE_CLIENT_ID`
- **Verzeichnis-ID (Mandant)** → `AZURE_TENANT_ID`

### Clientgeheimnis erstellen

1. Linke Menüleiste → **Zertifikate & Geheimnisse**
2. **Neuer geheimer Clientschlüssel** → Beschreibung eingeben → Ablauf wählen (max. 24 Monate)
3. Klick auf **Hinzufügen**
4. Den angezeigten **Wert** sofort kopieren — er wird nur einmal angezeigt! → `AZURE_CLIENT_SECRET`

### API-Berechtigungen prüfen

1. Linke Menüleiste → **API-Berechtigungen**
2. Folgende delegierte Berechtigungen müssen vorhanden sein (meist Standard):
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
3. Falls nicht vorhanden: **Berechtigung hinzufügen → Microsoft Graph → Delegiert**
4. **Administratorzustimmung erteilen** (Schaltfläche oben)

### Werte in .env eintragen

```bash
nano /opt/visitor-mgmt-abatplus/backend/.env
```

```env
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **Clientgeheimnis-Ablauf:** Das Geheimnis läuft nach dem gewählten Zeitraum ab. Bei Ablauf schlägt der Microsoft-Login fehl. Vor Ablauf ein neues Geheimnis erstellen und `.env` aktualisieren, dann `pm2 restart visitor-mgmt --update-env`.

---

## 6. Frontend bauen

```bash
cd /opt/visitor-mgmt-abatplus/frontend
npm run build
```

Der Build-Prozess dauert ca. 5–10 Sekunden und erzeugt das Verzeichnis `frontend/dist/`. Dieses wird von Nginx ausgeliefert.

Erwartete Ausgabe:
```
✓ built in ~1s
dist/index.html        ~0.7 kB
dist/assets/index.js   ~360 kB (gzip: ~110 kB)
dist/assets/index.css  ~27 kB  (gzip: ~6 kB)
```

---

## 7. SSL-Zertifikat einrichten

Da die Domain über Cloudflare proxied wird, kommuniziert Cloudflare mit dem Server über ein Origin-Zertifikat. Für den Endnutzer ist immer das Cloudflare-Zertifikat sichtbar.

### Option A — Selbst-signiert (einfach, 10 Jahre gültig)

Funktioniert mit Cloudflare SSL-Modus **Full**.

```bash
mkdir -p /etc/ssl/visitorplus

openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -days 3650 -nodes \
  -out /etc/ssl/visitorplus/cert.pem \
  -keyout /etc/ssl/visitorplus/key.pem \
  -subj "/CN=deine-domain.de/O=abat AG/C=DE"

chmod 600 /etc/ssl/visitorplus/key.pem
```

### Option B — Cloudflare Origin Certificate (empfohlen)

Funktioniert mit Cloudflare SSL-Modus **Full (Strict)** — sicherer, da die Verbindung Cloudflare→Server verifiziert wird.

1. **Cloudflare Dashboard** → gewünschte Domain → **SSL/TLS → Origin Server**
2. **Zertifikat erstellen** → Gültigkeit: 15 Jahre → Erstellen
3. Zertifikat und Private Key anzeigen und kopieren

```bash
mkdir -p /etc/ssl/visitorplus

# Zertifikat einfügen (öffnet Editor — Inhalt einfügen, speichern)
nano /etc/ssl/visitorplus/cert.pem

# Private Key einfügen
nano /etc/ssl/visitorplus/key.pem

chmod 600 /etc/ssl/visitorplus/key.pem
```

---

## 8. Nginx einrichten

```bash
nano /etc/nginx/sites-available/visitorplus
```

Inhalt (domain anpassen):

```nginx
server {
    listen 80;
    server_name deine-domain.de;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name deine-domain.de;

    ssl_certificate     /etc/ssl/visitorplus/cert.pem;
    ssl_certificate_key /etc/ssl/visitorplus/key.pem;

    # Security-Header
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer-when-downgrade always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none';" always;

    # Komprimierung
    gzip on;
    gzip_comp_level 6;
    gzip_vary on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    # React SPA — statische Dateien
    root /opt/visitor-mgmt-abatplus/frontend/dist;
    index index.html;

    # index.html nie cachen — SPA-Routing funktioniert nach Updates sofort
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        expires 0;
        try_files $uri =404;
    }

    # Alle anderen Routen → index.html (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API → Backend-Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        client_max_body_size 10M;
    }

    # Statische Assets — 1 Jahr cachen (Vite erzeugt Hash-Dateinamen)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
        access_log off;
    }
}
```

Aktivieren und testen:

```bash
# Symlink erstellen
ln -s /etc/nginx/sites-available/visitorplus /etc/nginx/sites-enabled/

# Konfiguration testen — immer vor reload!
nginx -t

# Nginx neu laden
systemctl reload nginx
```

---

## 9. Backend mit pm2 starten

```bash
# Backend starten
cd /opt/visitor-mgmt-abatplus/backend
pm2 start src/index.js \
  --name visitor-mgmt \
  --cwd /opt/visitor-mgmt-abatplus/backend

# Prozessliste für Neustarts speichern
pm2 save

# Auto-Start nach Server-Reboot einrichten
pm2 startup
# Den angezeigten Befehl ausführen (sieht etwa so aus):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
```

Status prüfen:

```bash
pm2 list
# Spalte "status" sollte "online" zeigen

pm2 logs visitor-mgmt
# Erwartete Ausgabe:
# ✓ Besucherverwaltung Backend läuft auf Port 3001
# [auto-checkout] Nächster Lauf: ...
```

---

## 10. Cloudflare konfigurieren

1. **DNS:** `A deine-domain.de → <Server-IP>` — Proxy-Status: **Proxied** (orange Wolke ✓)
2. **SSL/TLS:** Dashboard → SSL/TLS → Übersicht → Modus:
   - Selbst-signiertes Cert (Option A): **Full**
   - Cloudflare Origin Cert (Option B): **Full (Strict)**
3. **Automatic HTTPS Rewrites:** SSL/TLS → Edge-Zertifikate → Aktivieren

---

## 11. Erster Start & Test

```bash
# API-Erreichbarkeit lokal testen
curl http://localhost:3001/api/health
# Erwartete Antwort: {"status":"ok","timestamp":"..."}

# API über Domain testen
curl https://deine-domain.de/api/health

# Login testen
curl -s -X POST https://deine-domain.de/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ChangeMe123!"}' | python3 -m json.tool
# Erwartete Antwort: {"token":"eyJ...","user":{...}}
```

Standard-Zugangsdaten:

| E-Mail | Passwort | Rolle |
|---|---|---|
| `admin@example.com` | `ChangeMe123!` | admin |

**Nach dem ersten Login:**
1. Passwort unter **Einstellungen → Passwort** ändern
2. Eigenes Microsoft-Konto über den Microsoft-Button anmelden
3. Konto in **Einstellungen → Benutzer** auf `admin` hochstufen
4. Den `admin@example.com`-Account ggf. löschen oder deaktivieren

---

## 12. Updates einspielen

```bash
# Ins Projektverzeichnis wechseln
cd /opt/visitor-mgmt-abatplus

# Neueste Version holen
git pull

# Backend-Abhängigkeiten aktualisieren (nur wenn package.json geändert)
cd backend && npm install

# Frontend neu bauen
cd /opt/visitor-mgmt-abatplus/frontend && npm run build

# Backend neu starten
pm2 restart visitor-mgmt
```

> Nach `npm run build` wird das neue Frontend sofort ausgeliefert — kein Nginx-Reload nötig, da die Dateien direkt ersetzt werden.

---

## 13. Automatisches Backup

Tägliches Backup der SQLite-Datenbank per Cron:

```bash
# Backup-Verzeichnis anlegen
mkdir -p /root/backups

# Crontab bearbeiten
crontab -e
```

Folgende Zeile einfügen (täglich 03:00 Uhr):

```
0 3 * * * sqlite3 /opt/visitor-mgmt-abatplus/backend/data/visitors.db ".backup /root/backups/visitors-$(date +\%Y\%m\%d).db"
```

Altes Backup aufräumen (Backups älter als 30 Tage löschen):

```
0 4 * * * find /root/backups -name "visitors-*.db" -mtime +30 -delete
```

Manuelles Backup:

```bash
sqlite3 /opt/visitor-mgmt-abatplus/backend/data/visitors.db \
  ".backup /root/backups/visitors-$(date +%Y%m%d-%H%M).db"
```
