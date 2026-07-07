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

> **Erst nach Eintragen aller drei `AZURE_*`-Werte aktiv:** Solange `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` oder `AZURE_CLIENT_SECRET` leer sind, liefert `GET /api/auth/microsoft` einen `503`-Fehler (`„Microsoft SSO nicht konfiguriert"`). Der lokale Admin-Login bleibt in diesem Zustand die einzige Anmeldemöglichkeit. Erst wenn alle drei Werte gesetzt sind und das Backend neugestartet wurde, ist der SSO-Flow tatsächlich nutzbar.

### Optional: Domain-Allowlist für Auto-Provisionierung

Standardmäßig kann sich **jeder** Benutzer, der sich erfolgreich gegen den konfigurierten Azure-Tenant authentifiziert, per SSO einen neuen Account anlegen (Auto-Provisionierung beim ersten Login). Über die optionale Variable `SSO_ALLOWED_DOMAINS` kann das auf bestimmte E-Mail-Domains eingeschränkt werden:

```env
# Kommagetrennt, ohne @ — nur diese Domains dürfen sich neu registrieren
SSO_ALLOWED_DOMAINS=abatplus.de,abat.de
```

Bereits bestehende Accounts können sich weiterhin unabhängig von dieser Einstellung anmelden — die Prüfung greift ausschließlich bei der Neuanlage. Ist die Variable nicht gesetzt, ändert sich nichts am bisherigen Verhalten.

> **Empfehlung:** Sobald die Ziel-Domain(s) für den Produktivbetrieb feststehen, `SSO_ALLOWED_DOMAINS` setzen — das verhindert, dass sich versehentlich Konten aus fremden, im selben Azure-Tenant befindlichen Domains automatisch anlegen.

### Optional: App-only Verzeichniszugriff (Gastgeber-Autocomplete, Admin-Gegencheck, Mail-Benachrichtigung)

Für die Gastgeber-Autocomplete beim Check-in, den Admin-Gegencheck (Einstellungen → Gastgeber) und die Ankunfts-Mail an den Gastgeber wird eine **zweite, von der SSO-App getrennte** Azure-App-Registrierung benötigt (Client-Credentials-Flow, kein Nutzerkontext — Least-Privilege gegenüber der interaktiven SSO-App).

1. **Azure Portal → Microsoft Entra ID → App-Registrierungen → Neue Registrierung** (z.B. `abat+ Besucherverwaltung – Verzeichnis`, kein Redirect-URI nötig)
2. **Zertifikate & Geheimnisse** → neues Client Secret erstellen, Wert sofort kopieren
3. **API-Berechtigungen → Berechtigung hinzufügen → Microsoft Graph → Anwendungsberechtigungen (nicht delegiert):**
   - `User.Read.All`
   - `Mail.Send`
4. **Administratorzustimmung erteilen** (zwingend bei Anwendungsberechtigungen)
5. Werte in `.env` eintragen:

```env
AZURE_DIRECTORY_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_DIRECTORY_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_DIRECTORY_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Postfach, das als Absender für Gastgeber-Ankunfts-Mails dient (muss im Tenant existieren)
NOTIFY_FROM_EMAIL=besucher@deine-domain.de
```

```bash
pm2 restart visitor-mgmt --update-env
```

> **Ohne diese Konfiguration** bleibt die App voll nutzbar — Gastgeber-Autocomplete und Admin-Gegencheck liefern `503` (analog zum SSO-Verhalten), der Mailversand wird still übersprungen. Gastgeber lassen sich in diesem Fall nur über bereits lokal bekannte Einträge zuordnen (z.B. aus vorherigen SSO-Logins).

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

> **Sicherheitshinweis:** In der Produktivumgebung läuft dieser Prozess **nicht als root**, sondern unter einem dedizierten, unprivilegierten Systembenutzer. Zusätzlich bindet Express in `backend/src/index.js` explizit an `127.0.0.1` (nicht `0.0.0.0`) — das Backend ist von außen nur über den Nginx-Reverse-Proxy erreichbar, nicht direkt über seinen eigenen Port. Diese beiden Punkte sollten bei jeder Neuinstallation übernommen werden:

```bash
# Dedizierten Systembenutzer ohne Login-Shell anlegen
adduser --system --group --no-create-home svc-visitormgmtplus

# Projektverzeichnis diesem Benutzer übertragen
chown -R svc-visitormgmtplus:svc-visitormgmtplus /opt/visitor-mgmt-abatplus
```

Backend starten (entweder direkt als dieser Benutzer, oder über einen Eintrag mit `uid`/`gid` in einer zentralen `ecosystem.config.js`):

```bash
# Backend starten
cd /opt/visitor-mgmt-abatplus/backend
sudo -u svc-visitormgmtplus pm2 start src/index.js \
  --name visitor-mgmt \
  --cwd /opt/visitor-mgmt-abatplus/backend

# Prozessliste für Neustarts speichern
sudo -u svc-visitormgmtplus pm2 save

# Auto-Start nach Server-Reboot einrichten
pm2 startup
# Den angezeigten Befehl ausführen — Benutzer entsprechend anpassen (nicht root):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u svc-visitormgmtplus --hp /home/svc-visitormgmtplus
```

> Wird der Server mit mehreren Apps über eine gemeinsame `/opt/ecosystem.config.js` verwaltet, genügt pro App ein Eintrag mit `uid: 'svc-visitormgmtplus'` / `gid: 'svc-visitormgmtplus'` — pm2 startet den Prozess dann automatisch unter diesem Benutzer, ganz ohne `sudo -u`.

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

> **Vor dem produktiven Go-Live prüfen:** Generisch benannte Accounts wie `admin@example.com` oder ein evtl. angelegter `user@example.com`-Test-Account sollten nicht unkommentiert stehen bleiben. Für jeden solchen Account entscheiden: umbenennen/mit echter Person verknüpfen, Passwortstärke verifizieren, oder deaktivieren — bevor der Zugang für den Regelbetrieb freigegeben wird.

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

Das Projekt bringt ein eigenes Backup-Skript mit: `/opt/visitor-mgmt-abatplus/backup.sh`. Es sichert die SQLite-Datenbank per `.backup`-Kommando nach `/opt/visitor-mgmt-abatplus/backups/` und löscht dort Backups, die älter als 30 Tage sind.

```bash
#!/bin/bash
BACKUP_DIR="/opt/visitor-mgmt-abatplus/backups"
DB_PATH="/opt/visitor-mgmt-abatplus/backend/data/visitors.db"
KEEP_DAYS=30
DATE=$(date +%Y-%m-%d)

mkdir -p "$BACKUP_DIR"
sqlite3 "$DB_PATH" ".backup ${BACKUP_DIR}/visitors-${DATE}.db"
find "$BACKUP_DIR" -name "visitors-*.db" -mtime +${KEEP_DAYS} -delete
```

> **Bekannter, behobener Fehler:** In einer früheren Fassung verwies das Skript durch einen Copy-Paste-Fehler (vom Schwesterprojekt `visitor-mgmt`) auf `/opt/visitor-mgmt/backups` und `/opt/visitor-mgmt/backend/data/visitors.db` — also auf die **falsche** Datenbank. Beim Ausführen wäre dadurch nicht diese, sondern die Datenbank des anderen Projekts gesichert worden. Bei einer eigenständigen Installation unbedingt prüfen, dass `BACKUP_DIR` und `DB_PATH` im Skript auf das **eigene** Projektverzeichnis zeigen, bevor es eingeplant wird — besonders wenn das Skript von einer anderen Installation kopiert wurde.

Verzeichnis anlegen und Skript ausführbar machen:

```bash
mkdir -p /opt/visitor-mgmt-abatplus/backups /opt/visitor-mgmt-abatplus/logs
chmod +x /opt/visitor-mgmt-abatplus/backup.sh
chown svc-visitormgmtplus:svc-visitormgmtplus /opt/visitor-mgmt-abatplus/backups /opt/visitor-mgmt-abatplus/logs
```

**Als Cron-Job einplanen** — produktiv über `/etc/cron.d/` (läuft dann auch ohne Nutzer-Crontab des Systemnutzers), täglich 02:00 Uhr, unter dem unprivilegierten Prozessbenutzer statt root:

```bash
nano /etc/cron.d/visitor-mgmt-backups
```

```
0 2 * * * svc-visitormgmtplus /opt/visitor-mgmt-abatplus/backup.sh >> /opt/visitor-mgmt-abatplus/logs/backup.log 2>&1
```

> **Wichtig:** Ein reines Vorhandensein des Skripts im Projekt reicht nicht — ohne diesen (oder einen gleichwertigen) Cron-Eintrag wird `backup.sh` von nichts aufgerufen und es entstehen schlicht keine Backups. Nach dem Einrichten mit `cat /etc/cron.d/visitor-mgmt-backups` und einem Blick in `logs/backup.log` am Folgetag verifizieren, dass der Lauf tatsächlich stattfindet.

Manuelles Backup (z.B. vor einem Update):

```bash
sudo -u svc-visitormgmtplus /opt/visitor-mgmt-abatplus/backup.sh
```
