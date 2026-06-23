# Besucherverwaltung abat+ — Projektdokumentation

> Erstellt: 15. Juni 2026 | Zuletzt aktualisiert: 23. Juni 2026  
> Kunde: **abat AG**  
> URL: https://visitorplus.luwilab.work  
> Server-Pfad: `/opt/visitor-mgmt-abatplus`  
> PM2-Prozess: `visitor-mgmt` (Port 3001)

---

## Inhaltsverzeichnis

1. [Projektübersicht](#1-projektübersicht)
2. [Benutzerrollen](#2-benutzerrollen)
3. [Systemarchitektur](#3-systemarchitektur)
4. [Verzeichnisstruktur](#4-verzeichnisstruktur)
5. [Datenbank](#5-datenbank)
6. [Backend API](#6-backend-api)
7. [Frontend & Seiten](#7-frontend--seiten)
8. [Check-in Ablauf](#8-check-in-ablauf)
9. [Vorregistrierungen](#9-vorregistrierungen)
10. [Auto-Checkout](#10-auto-checkout)
11. [Einstellungen](#11-einstellungen)
12. [Infrastruktur & Deployment](#12-infrastruktur--deployment)
13. [Umgebungsvariablen (.env)](#13-umgebungsvariablen-env)
14. [Wichtige Befehle](#14-wichtige-befehle)
15. [Fehlerbehebung](#15-fehlerbehebung)

---

## 1. Projektübersicht

Schlanke, mitarbeitergesteuerte Besucherverwaltung für abat+. Mitarbeiter checken Besucher direkt vom eigenen Desktop oder Handy ein — kein Empfangskiosk, keine Selbstbedienung.

### Features im Überblick

| Feature | Beschreibung |
|---|---|
| Check-in | Mitarbeiter checkt Besucher ein (Login erforderlich) |
| Check-out | Manuell per Klick oder automatisch um konfigurierbare Uhrzeit |
| „Erfasst durch" | Jeder Besuch speichert, welcher Mitarbeiter eingecheckt hat |
| Vorregistrierungen | Besucher voranmelden; anderer Mitarbeiter checkt bei Ankunft ein |
| Datenschutz | Einfache Checkbox (kein Unterschriftspad) |
| Mobil-optimiert | Vollständig responsiv — Handy + Desktop |
| Auto-Checkout | Konfigurierbar (Standard 20:00), abschaltbar |
| Rollen | `admin` (Vollzugriff) / `user` (einchecken + lesen) |

### Bewusst entfernte Features

Kiosk-Modus, Host-Portal, QR-Scanner, Badge-/Etikettendrucker, E-Mail-Benachrichtigungen, Mehrsprachigkeit, 2FA, GDPR-Cleanup, Evakuierungsliste, Berichte, Audit-Log UI, abat-ID, Dokumenten-Upload, Unterschriftspad.

---

## 2. Benutzerrollen

| Rolle | Zugriffsrechte |
|---|---|
| `admin` | Alles: Einchecken, Auschecken, Löschen, Mitarbeiter- und Benutzerverwaltung, Einstellungen |
| `user` | Einchecken, Auschecken, Besucher/Vorregistrierungen lesen |

Rollenzuweisung über **Einstellungen → Benutzer** (nur admin).

Standard-Login nach Erstinstallation:

| E-Mail | Passwort | Rolle |
|---|---|---|
| `admin@example.com` | `ChangeMe123!` | admin |

---

## 3. Systemarchitektur

```
Browser / Handy
      │ HTTPS
      ▼
  Cloudflare CDN
      │ HTTPS (self-signed Origin Cert)
      ▼
  Nginx (Port 443)
      ├── /           → /opt/visitor-mgmt-abatplus/frontend/dist  (React SPA)
      └── /api/       → Proxy → Node.js Backend (Port 3001)
                                      │
                                      └── SQLite DB
                                          /opt/visitor-mgmt-abatplus/backend/data/visitors.db
```

**Stack:**
- Frontend: React 19 + Vite 8 + Tailwind CSS 4
- Backend: Express.js 5 + better-sqlite3
- Auth: JWT (8h Gültigkeit)
- DB: SQLite via better-sqlite3 (synchron, kein Pool nötig)
- Prozessmanager: pm2

---

## 4. Verzeichnisstruktur

```
/opt/visitor-mgmt-abatplus/
├── backend/
│   ├── src/
│   │   ├── db/database.js          # Schema + Migrationen
│   │   ├── middleware/auth.js      # JWT-Middleware
│   │   ├── routes/
│   │   │   ├── auth.js             # Login, Logout, Passwort ändern
│   │   │   ├── visitors.js         # Besucher-CRUD + Check-in
│   │   │   ├── visits.js           # Check-out
│   │   │   ├── hosts.js            # Mitarbeiter-CRUD
│   │   │   ├── preregistrations.js # Vorregistrierungen + Einchecken
│   │   │   ├── users.js            # Benutzerverwaltung (admin)
│   │   │   ├── settings.js         # Auto-Checkout Einstellungen
│   │   │   └── dashboard.js        # Stats + Aktivitäten
│   │   ├── services/
│   │   │   ├── auto-checkout.js    # Automatischer Checkout per setTimeout
│   │   │   └── audit-log.js        # Dateibasiertes Audit-Log
│   │   └── index.js                # Express App, Routes mounten
│   ├── data/visitors.db            # SQLite-Datenbank
│   └── .env                        # Secrets (nicht in Git!)
├── frontend/
│   ├── src/
│   │   ├── pages/                  # Login, Dashboard, Visitors, Hosts, PreRegistration, Settings
│   │   ├── components/             # Layout, Sidebar, VisitorCheckinForm, Modal, StatCard
│   │   ├── context/AuthContext.jsx
│   │   └── api/client.js           # Axios-Client mit JWT-Header
│   └── dist/                       # Build-Output (von Nginx ausgeliefert)
└── docs/                           # Diese Dokumentation
```

---

## 5. Datenbank

**Datei:** `/opt/visitor-mgmt-abatplus/backend/data/visitors.db`

### Tabellen

#### `users`
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | Anzeigename |
| email | TEXT UNIQUE | Login-E-Mail |
| password_hash | TEXT | bcrypt |
| role | TEXT | `admin` oder `user` |
| active | INTEGER | 0 = deaktiviert |
| created_at | TEXT | ISO-Timestamp |

#### `visitors`
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| first_name | TEXT | |
| last_name | TEXT | |
| company | TEXT | Optional |
| created_at | TEXT | |

#### `visits`
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| visitor_id | INTEGER FK | → visitors |
| host_id | INTEGER FK | → hosts (Mitarbeiter) |
| checked_in_at | TEXT | ISO-Timestamp |
| checked_out_at | TEXT | NULL wenn noch anwesend |
| status | TEXT | `active` / `completed` |
| privacy_accepted | INTEGER | 1 = Checkbox gesetzt |
| checked_in_by | INTEGER FK | → users (erfassender Mitarbeiter) |
| notes | TEXT | |

#### `hosts`
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | |
| email | TEXT | |
| phone | TEXT | |
| department | TEXT | |
| active | INTEGER | |

#### `preregistrations`
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| visitor_first_name | TEXT | |
| visitor_last_name | TEXT | |
| visitor_company | TEXT | |
| host_id | INTEGER FK | → hosts |
| expected_date | TEXT | YYYY-MM-DD |
| expected_time | TEXT | HH:MM (optional) |
| notes | TEXT | |
| status | TEXT | `pending` / `checked_in` / `cancelled` |
| created_by | INTEGER FK | → users |
| created_at | TEXT | |

#### `system_settings`
| Key | Default | Beschreibung |
|---|---|---|
| `auto_checkout_enabled` | `1` | Auto-Checkout aktiv |
| `auto_checkout_time` | `20:00` | Uhrzeit HH:MM |

---

## 6. Backend API

Basis-URL: `https://visitorplus.luwilab.work/api`  
Alle Endpunkte außer `/auth/login` und `GET /hosts` erfordern `Authorization: Bearer <JWT>`.

### Auth
| Methode | Pfad | Beschreibung |
|---|---|---|
| POST | `/auth/login` | Login → JWT |
| GET | `/auth/me` | Eigenes Profil |
| POST | `/auth/logout` | Token invalidieren |
| PUT | `/auth/change-password` | Eigenes Passwort ändern |

### Dashboard
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/dashboard/stats` | Statistiken (heute, anwesend, Vorregistrierungen offen) |
| GET | `/dashboard/recent` | Letzte 10 Aktivitäten |

### Besucher
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/visitors` | Liste (Filter: status, search, page, limit) |
| POST | `/visitors` | Einchecken (setzt `checked_in_by = req.user.id`) |
| GET | `/visitors/:id` | Einzelner Besucher |
| DELETE | `/visitors/:id` | Löschen (nur admin) |

**POST /visitors Body:**
```json
{
  "first_name": "Max",
  "last_name": "Mustermann",
  "company": "Beispiel GmbH",
  "host_id": 3,
  "notes": "",
  "privacy_accepted": true
}
```

### Visits (Check-out)
| Methode | Pfad | Beschreibung |
|---|---|---|
| POST | `/visits/:id/checkout` | Besucher auschecken |
| GET | `/visits/:id` | Visit-Detail |

### Hosts (Mitarbeiter)
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/hosts` | Alle Mitarbeiter (public, für Dropdown) |
| POST | `/hosts` | Erstellen (admin) |
| PUT | `/hosts/:id` | Bearbeiten (admin) |
| DELETE | `/hosts/:id` | Löschen (admin) |

### Vorregistrierungen
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/preregistrations` | Alle |
| POST | `/preregistrations` | Erstellen |
| PUT | `/preregistrations/:id` | Bearbeiten |
| DELETE | `/preregistrations/:id` | Löschen (admin) / Abbrechen (user) |
| POST | `/preregistrations/:id/checkin` | Besucher einchecken → erstellt Visit, setzt `checked_in_by` |

### Einstellungen
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/settings` | Aktuelle Einstellungen |
| PUT | `/settings` | Aktualisieren (admin) — Keys: `auto_checkout_enabled`, `auto_checkout_time` |

### Benutzer
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/users` | Alle Benutzer (admin) |
| POST | `/users` | Erstellen (admin) |
| PUT | `/users/:id` | Bearbeiten (admin) |
| DELETE | `/users/:id` | Löschen (admin) |

---

## 7. Frontend & Seiten

| Route | Seite | Zugriff |
|---|---|---|
| `/login` | Anmeldung | öffentlich |
| `/dashboard` | Übersicht + Check-in-Button | alle |
| `/visitors` | Besucherliste (Anwesend/Ausgecheckt/Alle) | alle |
| `/preregistrations` | Vorregistrierungen | alle |
| `/hosts` | Mitarbeiterverwaltung | alle (Edit/Delete nur admin) |
| `/settings` | Einstellungen | Passwort: alle; Rest: admin |

### Sidebar-Navigation
- Dashboard
- Besucher
- Vorregistrierungen
- Mitarbeiter
- Einstellungen _(nur admin)_

Mobile: Burger-Menü (oben links). Desktop: kollabierbare Sidebar.

---

## 8. Check-in Ablauf

1. Mitarbeiter öffnet **visitorplus.luwilab.work** (Login erforderlich)
2. Dashboard oder Besucher-Seite → **„Einchecken"**-Button
3. Modal öffnet: Vorname*, Nachname*, Firma (optional), Mitarbeiter* (Dropdown), Notizen, Datenschutz-Checkbox*
4. Absenden → Backend erstellt `visitor` + `visit`, setzt `checked_in_by = req.user.id`
5. Besucher erscheint in Liste mit **„Erfasst am [Zeit] durch [Name]"**

Check-out: Klick auf **„Auschecken"** in der Zeile → `POST /visits/:id/checkout`

---

## 9. Vorregistrierungen

**Ablauf:**
1. Mitarbeiter trägt Besucher vorab ein (Name, Mitarbeiter, Datum, Uhrzeit optional)
2. Status: `pending` → Tab „Ausstehend"
3. Wenn Besucher ankommt: anderer Mitarbeiter klickt **„Einchecken"**
4. Backend erstellt Visit, setzt `checked_in_by`, Status → `checked_in`

Kein QR-Code, keine E-Mail, keine Gruppenregistrierung.

---

## 10. Auto-Checkout

Service: `/opt/visitor-mgmt-abatplus/backend/src/services/auto-checkout.js`

- Läuft täglich zur konfigurierten Uhrzeit (Standard: 20:00)
- Checkt alle Visits mit `status = 'active'` aus
- Konfigurierbar über **Einstellungen → Auto-Checkout** (admin)
- Abschaltbar (Toggle)
- Implementierung: `setTimeout` basiert auf Differenz zu Zieluhrzeit

---

## 11. Einstellungen

Drei Tabs im Frontend (`/settings`):

| Tab | Sichtbar für | Inhalt |
|---|---|---|
| Auto-Checkout | admin | Ein/Aus-Toggle + Uhrzeit (HH:MM) |
| Passwort | alle | Eigenes Passwort ändern |
| Benutzer | admin | Benutzer-CRUD (Name, E-Mail, Passwort, Rolle) |

Mitarbeiterverwaltung: eigene Seite `/hosts`.

---

## 12. Infrastruktur & Deployment

### Nginx

Config: `/etc/nginx/sites-available/visitorplus.luwilab.work`  
Symlink aktiv: `/etc/nginx/sites-enabled/visitorplus.luwilab.work`

- HTTP → HTTPS Redirect (301)
- SSL: selbst-signiertes Zertifikat (Origin Cert für Cloudflare)
- Static Files: `/opt/visitor-mgmt-abatplus/frontend/dist`
- API Proxy: `http://127.0.0.1:3001`
- `index.html` ohne Cache (SPA-Routing)
- JS/CSS/Assets: 1 Jahr Cache (Vite-Hashes)

**SSL-Zertifikat** (selbst-signiert, gültig 10 Jahre):
```
/etc/ssl/visitorplus/cert.pem
/etc/ssl/visitorplus/key.pem
```

Cloudflare proxied → Browser vertraut Cloudflare-Zertifikat; Origin-Zert nur für Cloudflare→Server nötig.

### PM2

Prozessname: `visitor-mgmt`  
Arbeitsverzeichnis: `/opt/visitor-mgmt-abatplus/backend`

```bash
pm2 list                          # Status
pm2 restart visitor-mgmt          # Nach Updates
pm2 logs visitor-mgmt             # Live-Logs
pm2 logs visitor-mgmt --lines 50  # Letzte 50 Zeilen
```

---

## 13. Umgebungsvariablen (.env)

Datei: `/opt/visitor-mgmt-abatplus/backend/.env`

```env
PORT=3001
JWT_SECRET=<langer-zufälliger-string>   # openssl rand -hex 64
DB_PATH=/opt/visitor-mgmt-abatplus/backend/data/visitors.db
APP_URL=https://visitorplus.luwilab.work

# Optionaler initialer Admin (nur beim ersten Start wirksam)
# ADMIN_EMAIL=admin@abat.de
# ADMIN_PASSWORD=SicheresPasswort123!
```

> `JWT_SECRET` nie leer lassen, nie in Git einchecken.  
> `DB_PATH` immer absolut angeben — verhindert doppelte DB bei unterschiedlichem Startverzeichnis.

---

## 14. Wichtige Befehle

```bash
# Frontend neu bauen (nach Code-Änderungen)
cd /opt/visitor-mgmt-abatplus/frontend
npm run build

# Backend neu starten
pm2 restart visitor-mgmt

# Nginx neu laden (nach Config-Änderungen)
nginx -t && systemctl reload nginx

# Datenbank prüfen
sqlite3 /opt/visitor-mgmt-abatplus/backend/data/visitors.db ".tables"
sqlite3 /opt/visitor-mgmt-abatplus/backend/data/visitors.db "SELECT * FROM users;"

# Passwort zurücksetzen
cd /opt/visitor-mgmt-abatplus/backend
HASH=$(node -e "const b=require('./node_modules/bcryptjs'); b.hash('NeuesPasswort123!',12).then(h=>process.stdout.write(h))")
sqlite3 data/visitors.db "UPDATE users SET password_hash='$HASH' WHERE email='admin@example.com';"

# Datenbank-Backup
sqlite3 /opt/visitor-mgmt-abatplus/backend/data/visitors.db \
  ".backup /root/backups/visitors-$(date +%Y%m%d).db"

# API-Test
curl https://visitorplus.luwilab.work/api/health
curl -X POST https://visitorplus.luwilab.work/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ChangeMe123!"}'
```

---

## 15. Fehlerbehebung

| Symptom | Ursache | Lösung |
|---|---|---|
| „Anmeldung fehlgeschlagen" ohne Netzwerkfehler | Backend läuft nicht | `pm2 list` → `pm2 restart visitor-mgmt` |
| 502 Bad Gateway | Backend nicht erreichbar | `pm2 logs visitor-mgmt` prüfen |
| Seite lädt altes Frontend | Browser-Cache | Nginx `index.html` kein Cache gesetzt; Hard-Reload Strg+Shift+R |
| Auto-Checkout läuft nicht zur richtigen Zeit | DB-Einstellung alt | Einstellungen → Auto-Checkout neu speichern → `pm2 restart visitor-mgmt` |
| „checked_in_by" leer bei alten Einträgen | Vor Migration erstellt | Normal — nur neue Visits haben dieses Feld |
| Nginx-Fehler nach Config-Änderung | Syntax-Fehler | `nginx -t` ausführen vor `systemctl reload nginx` |
