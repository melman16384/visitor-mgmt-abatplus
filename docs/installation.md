# Installationsanleitung — Besucherverwaltung abat+

> Zielumgebung: Ubuntu 22.04 / Debian 12 · Node.js 22+ · Nginx · Cloudflare

Diese Anleitung beschreibt die vollständige Erstinstallation auf einem frischen Server. Voraussetzung ist ein laufender Ubuntu/Debian-Server mit Root-Zugriff und einer bei Cloudflare verwalteten Domain.

---

## Inhaltsverzeichnis

1. [Systemvoraussetzungen](#1-systemvoraussetzungen)
2. [Node.js, Nginx & MariaDB installieren](#2-nodejs-nginx--mariadb-installieren)
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
14. [Deinstallation](#14-deinstallation)

---

## 1. Systemvoraussetzungen

| Anforderung | Minimum |
|---|---|
| Betriebssystem | Ubuntu 22.04 LTS oder Debian 12 |
| RAM | 512 MB (1 GB empfohlen) |
| Disk | 2 GB |
| Node.js | 22.x oder höher |
| Nginx | aktuell |
| MariaDB | 10.6 oder höher |
| Domain | Bei Cloudflare verwaltet, DNS-Eintrag auf Server-IP zeigend |

Das System benötigt im laufenden Betrieb keine externen Netzwerkverbindungen außer zu Microsoft Entra ID (für den SSO-Login).

---

## 2. Node.js, Nginx & MariaDB installieren

```bash
# System aktualisieren
apt update && apt upgrade -y

# Node.js 22 über NodeSource installieren
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Nginx installieren
apt install -y nginx

# MariaDB installieren
apt install -y mariadb-server mariadb-client

# Versionen prüfen
node -v    # Sollte v22.x oder höher anzeigen
npm -v
nginx -v
mariadb --version

# pm2 global installieren (Prozessmanager)
npm install -g pm2
```

Datenbank + eigenen App-Benutzer anlegen (nicht root für die App verwenden):

```bash
mysql -u root <<'SQL'
CREATE DATABASE visitormgmt_abatplus CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'visitormgmt_abatplus'@'localhost' IDENTIFIED BY 'HIER-SICHERES-PASSWORT-EINTRAGEN';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
  ON visitormgmt_abatplus.* TO 'visitormgmt_abatplus'@'localhost';
FLUSH PRIVILEGES;
SQL
```

Das vergebene Passwort wird gleich in `.env` als `DB_PASSWORD` eingetragen.

> **Zeitzone auf UTC pinnen:** Die Anwendung erwartet, dass die MariaDB-Session-Zeitzone `+00:00` ist — sonst weichen `NOW()`/`CURRENT_TIMESTAMP` vom UTC-Zeitstempel ab, den das Backend beim Schreiben verwendet (`toSqlDateTime()` in `db/database.js`). In `/etc/mysql/mariadb.conf.d/60-visitor-mgmt-abatplus.cnf` eintragen:
> ```ini
> [mysqld]
> default-time-zone = '+00:00'
> ```
> Danach `systemctl restart mariadb`. Läuft bereits eine andere App auf demselben MariaDB-Server mit dieser Einstellung (serverweit, nicht pro Datenbank), ist dieser Schritt schon erledigt — mit `SELECT @@global.time_zone;` prüfen.

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

# MariaDB-Verbindung (siehe Schritt 2 — dort angelegte DB/Benutzer)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=visitormgmt_abatplus
DB_USER=visitormgmt_abatplus
DB_PASSWORD=<beim CREATE USER vergebenes Passwort>

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

Schema (Tabellen, Standard-Einstellungen, initialer Admin) wird beim ersten Start automatisch angelegt — kein manueller Migrationsschritt oder Datenverzeichnis nötig.

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

Eine einzige App-Registrierung deckt **beides** ab — den interaktiven Login UND den app-only Verzeichniszugriff (Gastgeber-Autocomplete, Admin-Gegencheck, Ankunfts-Mails):

- **Delegierte Berechtigungen** (Login): `openid`, `profile`, `email`, `User.Read`
- **Anwendungsberechtigungen** (Verzeichnis, Client-Credentials-Flow — **API-Berechtigungen → Berechtigung hinzufügen → Microsoft Graph → Anwendungsberechtigungen**, dann **Administratorzustimmung erteilen**): `User.Read.All`, `Mail.Send`

**Bevorzugt: über die App selbst konfigurieren** — nach dem ersten Start unter **Einstellungen → Microsoft SSO** (Admin-Login) Tenant-ID, Client-ID, Client Secret, optional die Domain-Allowlist und das Absender-Postfach eintragen. Wirkt sofort, kein Neustart nötig.

**Alternativ per `.env`** (dient nur als Fallback für Tenant-ID/Client-ID/Client-Secret, falls in den Einstellungen nichts hinterlegt ist):

```env
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Postfach, das als Absender für Gastgeber-Ankunfts-Mails dient (muss im Tenant existieren)
NOTIFY_FROM_EMAIL=besucher@deine-domain.de
```

```bash
pm2 restart visitor-mgmt --update-env
```

> **Clientgeheimnis-Ablauf:** Das Geheimnis läuft nach dem gewählten Zeitraum ab. Bei Ablauf schlägt sowohl der Microsoft-Login als auch die Verzeichnis-Anbindung fehl. Vor Ablauf ein neues Geheimnis erstellen und in Einstellungen → Microsoft SSO (oder `.env`) aktualisieren.

> **Erst nach Eintragen aller drei Werte aktiv:** Solange Tenant-ID, Client-ID oder Client Secret leer sind (weder in den Einstellungen noch in `.env`), liefern `GET /api/auth/microsoft`, `/hosts/search-ad` und `/hosts/:id/ad-check` einen `503`-Fehler. Der lokale Admin-Login bleibt in diesem Zustand die einzige Anmeldemöglichkeit; Gastgeber lassen sich nur über bereits lokal bekannte Einträge zuordnen.

### Zugriffsliste pflegen — wer darf sich per SSO anmelden

Anders als Tenant-ID/Client-ID/Client-Secret hat die Zugriffsliste **keinen** `.env`-Fallback — sie lebt ausschließlich in der Datenbank und muss über die UI gepflegt werden:

1. Admin-Login (lokaler Fallback-Account) → **Einstellungen → Microsoft SSO → Zugriffsliste**
2. E-Mail-Adresse + gewünschte Rolle (`user`/`admin`) eintragen, **„Hinzufügen"**
3. Erst danach kann sich diese Person per Microsoft SSO anmelden — ohne Eintrag: `?error=not_allowed`

Die Prüfung läuft bei **jedem** Login, nicht nur beim ersten — ein Entfernen aus der Liste sperrt auch bereits bestehende Accounts sofort aus. Die Rolle wird bei jedem Login mit dem lokalen Konto synchronisiert.

> Details und API-Endpunkte: [dokumentation.md, Kapitel 7](./dokumentation.md#7-microsoft-sso).

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

Das Projekt bringt ein eigenes Backup-Skript mit: `/opt/visitor-mgmt-abatplus/backup.sh`. Es sichert die MariaDB-Datenbank per `mysqldump` (gzip-komprimiertes SQL) und zusätzlich `backend/uploads/` nach `/opt/visitor-mgmt-abatplus/backups/`, löscht dort Backups, die älter als 30 Tage sind. Die Verbindungsdaten liest es aus `backend/.env` (`DB_*`).

```bash
#!/bin/bash
BACKUP_DIR="/opt/visitor-mgmt-abatplus/backups"
ENV_FILE="/opt/visitor-mgmt-abatplus/backend/.env"
KEEP_DAYS=30
DATE=$(date +%Y-%m-%d)

get_env() { grep -E "^${1}=" "$ENV_FILE" | tail -1 | cut -d '=' -f2-; }
DB_HOST=$(get_env DB_HOST); DB_PORT=$(get_env DB_PORT)
DB_USER=$(get_env DB_USER); DB_PASSWORD=$(get_env DB_PASSWORD); DB_NAME=$(get_env DB_NAME)

mkdir -p "$BACKUP_DIR"
MYSQL_PWD="$DB_PASSWORD" mysqldump --single-transaction --routines --triggers \
  -h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "$DB_USER" "$DB_NAME" \
  | gzip > "${BACKUP_DIR}/visitors-${DATE}.sql.gz"
find "$BACKUP_DIR" -name "visitors-*.sql.gz" -mtime +${KEEP_DAYS} -delete
```

Rücksicherung im Notfall:

```bash
gunzip -c /opt/visitor-mgmt-abatplus/backups/visitors-<datum>.sql.gz \
  | MYSQL_PWD=<DB_PASSWORD aus .env> mysql -h 127.0.0.1 -u visitormgmt_abatplus visitormgmt_abatplus
```

> **Historischer Hinweis:** In einer früheren Fassung verwies das Skript durch einen Copy-Paste-Fehler (vom Schwesterprojekt `visitor-mgmt`) auf falsche, fest kodierte Pfade des anderen Projekts. Bei einer eigenständigen Installation unbedingt prüfen, dass `BACKUP_DIR` und die `.env`-Verbindungsdaten auf die **eigene** Datenbank zeigen, bevor das Skript eingeplant wird — besonders wenn es von einer anderen Installation kopiert wurde.

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

---

## 14. Deinstallation

Das Projekt bringt ein eigenes Deinstallations-Skript mit: `/opt/visitor-mgmt-abatplus/uninstall.sh`. Es fasst nur Artefakte **dieses** Projekts an — pm2-Prozess, Nginx-Site, SSL-Zertifikat, den abatplus-Eintrag im geteilten Backup-Cron, DB + Rolle, den Systembenutzer, pm2-Logs und zuletzt das Projektverzeichnis selbst. Andere Apps auf demselben Server (z.B. `visitor-mgmt`) bleiben unberührt.

```bash
# Erst ansehen, was passieren würde — ändert nichts:
sudo /opt/visitor-mgmt-abatplus/uninstall.sh --dry-run

# Interaktiv, mit Rückfrage vor jedem Schritt (empfohlen):
sudo /opt/visitor-mgmt-abatplus/uninstall.sh

# Ohne Rückfragen — nur wenn wirklich sicher:
sudo /opt/visitor-mgmt-abatplus/uninstall.sh --yes
```

Vor dem letzten, größten Schritt (Löschen des Projektverzeichnisses inkl. `.env`, Backups und Uploads) fragt das Skript zusätzlich eine Tipp-Bestätigung (`DEINSTALLIEREN`) ab — auch im `--yes`-Modus **nicht**, dort läuft alles ohne Rückfrage durch.

**Nicht automatisch entfernt** (bewusst — geteilte Datei bzw. externe Systeme):
- Der `visitor-mgmt-abatplus`-Eintrag in `/opt/ecosystem.config.js` — Datei wird von mehreren Apps auf dem Server genutzt, daher kein automatisches Suchen/Ersetzen; Eintrag manuell löschen.
- Die Azure App Registration (Azure Portal → Microsoft Entra ID → App-Registrierungen) — falls sie ausschließlich für abat+ angelegt wurde, dort manuell entfernen.
- Der Cloudflare-DNS-Eintrag für die Domain.

**Manuell, ohne Skript** (falls nur einzelne Schritte gebraucht werden):

```bash
# pm2-Prozess
pm2 delete visitor-mgmt-abatplus && pm2 save

# Nginx
rm -f /etc/nginx/sites-enabled/visitorplus.luwilab.work /etc/nginx/sites-available/visitorplus.luwilab.work
nginx -t && systemctl reload nginx

# SSL-Zertifikat
rm -rf /etc/ssl/visitorplus

# Cron-Backup-Zeile (nur die abatplus-Zeile, Datei bleibt für visitor-mgmt bestehen)
sed -i '\|/opt/visitor-mgmt-abatplus|d' /etc/cron.d/visitor-mgmt-backups

# Datenbank
mysql -u root -e "DROP DATABASE IF EXISTS visitormgmt_abatplus; DROP USER IF EXISTS 'visitormgmt_abatplus'@'localhost';"

# Systembenutzer
userdel svc-visitormgmtplus

# Projektverzeichnis (zuletzt!)
rm -rf /opt/visitor-mgmt-abatplus
```
