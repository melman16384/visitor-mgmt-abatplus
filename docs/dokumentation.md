# Besucherverwaltung abat+ — Projektdokumentation

> Erstellt: 15. Juni 2026 | Zuletzt aktualisiert: 17. August 2026 (Gastgeber-Sync aus Entra ID, Besuchszwecke, editierbare Check-in/-out-Zeit, SSO-Zugriffsliste statt Domain-Allowlist, Datenschutztext, Produktiv-Härtung)  
> Kunde: **abat AG**  
> URL: https://visitorplus.luwilab.work  
> Repository: https://github.com/melman16384/visitor-mgmt-abatplus  
> Server-Pfad: `/opt/visitor-mgmt-abatplus`  
> PM2-Prozess: `visitor-mgmt` (Port 3001)

---

## Inhaltsverzeichnis

1. [Projektübersicht](#1-projektübersicht)
2. [Benutzerrollen & Berechtigungen](#2-benutzerrollen--berechtigungen)
3. [Systemarchitektur](#3-systemarchitektur)
4. [Verzeichnisstruktur](#4-verzeichnisstruktur)
5. [Datenbank](#5-datenbank)
6. [Backend API](#6-backend-api)
7. [Microsoft SSO](#7-microsoft-sso)
8. [Frontend & Seiten](#8-frontend--seiten)
9. [Check-in Ablauf](#9-check-in-ablauf)
10. [Vorregistrierungen](#10-vorregistrierungen)
11. [Auto-Checkout](#11-auto-checkout)
12. [Datenspeicherung (Data Retention)](#12-datenspeicherung-data-retention)
13. [Einstellungen](#13-einstellungen)
14. [Infrastruktur & Deployment](#14-infrastruktur--deployment)
15. [Umgebungsvariablen (.env)](#15-umgebungsvariablen-env)
16. [Wichtige Befehle](#16-wichtige-befehle)
17. [Sicherheit](#17-sicherheit)
18. [Fehlerbehebung](#18-fehlerbehebung)

---

## 1. Projektübersicht

Schlanke, mitarbeitergesteuerte Besucherverwaltung, entwickelt ausschließlich für den internen Einsatz bei abat+. Mitarbeiter melden sich mit ihrem Microsoft-Firmenkonto an und checken Besucher direkt vom eigenen Desktop oder Handy ein — ohne Empfangskiosk, ohne Selbstbedienung durch den Besucher.

> **Begriffe:** *Mitarbeiter* = Personen die sich im System anmelden. *Gastgeber* = Ansprechpartner für einen Besucher (wählbar im Check-in-Formular, Seite `/hosts`).

### Designprinzipien

- **Kein Kiosk, keine Selbstbedienung** — Besucher werden immer durch einen Mitarbeiter erfasst
- **Nachvollziehbarkeit** — jeder Besuch speichert, wer wann eingecheckt hat (`Erfasst am … durch …`)
- **Minimaler Aufwand** — zwei Klicks zum Einchecken, kein zusätzliches Passwort (Microsoft SSO)
- **Abgeschlossene Instanz** — läuft nur auf dem abat+-Server, keine externe Abhängigkeit im Betrieb

### Features im Überblick

| Feature | Beschreibung |
|---|---|
| Check-in | Mitarbeiter checkt Besucher über ein einfaches Formular ein; Check-in-Datum/-Uhrzeit sind vorbelegt (jetzt), aber änderbar |
| Check-out | Manuell per Klick mit Bestätigungsdialog, oder automatisch zur konfigurierten Uhrzeit |
| Zeiten nachträglich korrigierbar | Check-in- und (falls bereits ausgecheckt) Check-out-Zeit lassen sich über ein Stift-Symbol in der Besucherliste nachträglich anpassen (`PUT /visits/:id/times`) |
| Checkout rückgängig | Ein am selben Tag ausgecheckter Besuch kann per Klick reaktiviert werden |
| „Erfasst durch" | Speichert Name + Zeitstempel des einchecke­nden Mitarbeiters |
| Gemeinsame Besucherliste | Vorregistriert, Anwesend, Ausgecheckt und Abgesagt sind Tabs **einer** Liste (`/visitors`) — keine getrennte Datenpflege |
| Vorregistrierungen | Besucher vorab eintragen (in der Besucherliste integriert); bei Ankunft per Klick einchecken, Uhrzeit dabei leicht korrigierbar |
| Besuchszwecke | Konfigurierbare, sortierbare Liste (Einstellungen → Besuchszwecke); im Check-in-Formular auswählbar, in der Besucherliste sichtbar |
| Gastgeber aus Active Directory | Autocomplete ab 3 Zeichen gegen das Firmen-AD (separates App-only-Verzeichniskonto); lokale Gastgeber-Verwaltungsseite entfällt |
| Gastgeber-Sync (Entra ID) | Täglicher automatischer Abgleich aller Verzeichnis-Benutzer als Gastgeber (dieselbe App-Registrierung wie SSO), inkl. manuellem Sync-Button und Status-Anzeige (Einstellungen → Gastgeber-Sync) |
| Gastgeber-Benachrichtigung | Optionale Mail an den Gastgeber bei Ankunft des Besuchers (Microsoft Graph `sendMail`) |
| Admin-AD-Gegencheck | Einstellungen → Gastgeber: prüft lokale Gastgeber-Einträge gegen das Verzeichnis |
| Microsoft SSO | Login mit Firmenkonto; nur Adressen auf der Zugriffsliste (Einstellungen → Microsoft SSO) dürfen sich anmelden, Rolle wird bei jedem Login synchronisiert |
| Datenschutzhinweis | Checkbox „Besucher wurde auf die Datenschutzerklärung hingewiesen"; Text konfigurierbar (Einstellungen → Datenschutz), Default verlinkt auf https://www.abat.de/datenschutz — statt Unterschriftspad |
| Datenschutz-Bereinigung | Automatische tägliche Löschung nach Aufbewahrungsfrist, zusätzlich manuell auslösbar (Einstellungen → Datenschutz → „Jetzt bereinigen") |
| Notizen | Optionales Feld beim Check-in/bei der Vorregistrierung, sichtbar in der Besucherliste |
| Tages-Filter | Besucherliste zeigt standardmäßig den heutigen Tag; per Datumsfeld auf einen anderen Tag umschaltbar |
| Mobil-optimiert | Vollständig responsiv — Handy + Desktop gleichwertig |
| Auto-Checkout | Täglich zur konfigurierbaren Uhrzeit (Standard: 20:00), abschaltbar |
| Zwei Rollen | `admin` (Vollzugriff) / `user` (einchecken + lesen); Vorregistrierung absagen: nur zugeordneter Gastgeber oder Admin |

### Bewusst nicht enthalten

Folgende Features wurden gegenüber der Ausgangsversion bewusst entfernt, da sie für den abat+-Betrieb nicht benötigt werden:

Kiosk-Modus · Host-Portal · QR-Scanner · Badge-/Etikettendrucker · E-Mail-Benachrichtigungen · Mehrsprachigkeit (EN/LT/RU) · Zwei-Faktor-Authentifizierung · Evakuierungsliste · Berichte/Exports · Audit-Log UI · abat-ID · Dokumenten-Upload · Unterschriftspad · Standortbasierte Zugriffskontrolle · Gruppenregistrierungen

> Die zugehörigen Backend-Routen (`documents.js`, `locations.js`, `reports.js`) liegen zwar noch als Altlast aus einem früheren Fork im Repository, sind aber in `index.js` nicht eingebunden und über die API nicht erreichbar — reiner Aufräumkandidat, kein aktives Feature.

---

## 2. Benutzerrollen & Berechtigungen

Das System kennt genau zwei Rollen:

| Rolle | Wer | Rechte |
|---|---|---|
| `admin` | Ausgewählte Personen (IT, Facility) | Alles: einchecken, auschecken, löschen, Mitarbeiter verwalten, Benutzer verwalten, Einstellungen ändern |
| `user` | Alle übrigen Mitarbeiter | Einchecken, Auschecken, Besucher- und Vorregistrierungsliste lesen |

**Rollenvergabe:** Einstellungen → Benutzer → Rolle bearbeiten (nur admin).

**Microsoft SSO:** Neue Benutzer erhalten automatisch die Rolle `user`. Admins müssen die Rolle manuell auf `admin` hochstufen.

**Lokaler Admin-Fallback:** Der initiale `admin@example.com`-Account nutzt Passwort-Login und dient als Notfallzugang, falls SSO nicht verfügbar ist.

Standard-Zugangsdaten nach Erstinstallation:

| E-Mail | Passwort | Rolle |
|---|---|---|
| `admin@example.com` | `ChangeMe123!` | admin |

> Passwort nach dem ersten Login sofort ändern.

---

## 3. Systemarchitektur

```
Browser / Handy (Mitarbeiter)
        │ HTTPS
        ▼
  Cloudflare CDN
  (TLS-Terminierung, DDoS-Schutz, Caching)
        │ HTTPS — selbst-signiertes Origin-Zertifikat
        ▼
  Nginx (Port 443)
  ├── GET /          → statische React-App aus /frontend/dist
  ├── GET /api/*     → Proxy → Express.js Backend (Port 3001)
  └── GET /api/auth/microsoft/* → OAuth2-Flow zu Microsoft Entra ID
                                      │
                              Express.js Backend
                              ├── JWT-Authentifizierung
                              ├── Routen: auth, visitors, visits,
                              │   hosts, preregistrations, users,
                              │   settings, dashboard
                              └── MariaDB-Datenbank
                                  (mysql2 Pool, asynchron)
```

**Technologie-Stack:**

| Schicht | Technologie | Version |
|---|---|---|
| Frontend | React | 19 |
| Build-Tool | Vite | 8 |
| CSS-Framework | Tailwind CSS | 4 |
| Backend | Express.js | 5 |
| Datenbank | MariaDB via `mysql2` | 10.11 |
| Authentifizierung | JWT (8h) + MSAL (Microsoft SSO) | — |
| Prozessmanager | pm2 | — |
| Webserver | Nginx | — |
| CDN/Proxy | Cloudflare | — |

**Warum MariaDB?** Ursprünglich lief die App auf SQLite (einzelne Instanz, kein separater Datenbankdienst nötig), dann kurzzeitig auf PostgreSQL. Seit August 2026 auf MariaDB (lokale Instanz auf demselben Server) umgestellt — vereinheitlicht die Infrastruktur mit dem Schwesterprojekt `visitor-mgmt`, das bereits auf MariaDB läuft (ein Datenbank-Server, ein Backup-/Tooling-Ansatz für beide Apps statt zwei verschiedener DB-Engines auf demselben Host). `backend/src/db/database.js` kapselt den Zugriff über eine dünne Adapter-Schicht (`prepare(sql).get/all/run`, `exec`, `transaction`) mit derselben Aufrufsyntax wie zuvor — darunter läuft es aber vollständig asynchron über einen `mysql2/promise`-Connection-Pool.

---

## 4. Verzeichnisstruktur

```
/opt/visitor-mgmt-abatplus/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   └── database.js          # Schema-Definition + automatische Migrationen
│   │   ├── middleware/
│   │   │   └── auth.js              # JWT-Verifizierung, requireRole()-Helper
│   │   ├── routes/
│   │   │   ├── auth.js              # POST /login, GET /me, PUT /change-password
│   │   │   ├── auth-microsoft.js    # GET /microsoft, GET /microsoft/callback (MSAL)
│   │   │   ├── visitors.js          # Besucher-CRUD, Check-in (POST /), gemeinsame Liste inkl. Vorregistrierung
│   │   │   ├── visits.js            # Check-out (POST /:id/checkout), Rückgängig (POST /:id/reactivate)
│   │   │   ├── hosts.js             # Gastgeber-CRUD, AD-Suche (/search-ad), Admin-Gegencheck (/:id/ad-check)
│   │   │   ├── preregistrations.js  # Vorregistrierungen + POST /:id/checkin
│   │   │   ├── users.js             # Benutzerverwaltung (admin only)
│   │   │   ├── settings.js          # Auto-Checkout-, Retention-, Datenschutz- und Benachrichtigungs-Einstellungen, SSO-Zugriffsliste, GDPR-Bereinigung
│   │   │   ├── visit-purposes.js    # Besuchszwecke-CRUD + Sortierung
│   │   │   ├── entra-sync.js        # Konfiguration + manueller Anstoß des Gastgeber-Sync (admin only)
│   │   │   └── dashboard.js         # Statistiken + letzte Aktivitäten
│   │   ├── services/
│   │   │   ├── auto-checkout.js     # Täglicher Auto-Checkout per setTimeout
│   │   │   ├── data-retention.js    # Tägliche Datenlöschung nach Aufbewahrungsfrist
│   │   │   ├── audit-log.js         # Dateibasiertes Audit-Log (optional)
│   │   │   ├── graph-directory.js   # App-only Microsoft-Graph-Client (AD-Suche, Gegencheck, Mailversand)
│   │   │   ├── hosts-helper.js      # findOrCreateHostByEmail() — gemeinsame Gastgeber-Anlage-Logik
│   │   │   ├── notify-host.js       # Best-effort Gastgeber-Mail bei Ankunft
│   │   │   ├── entra-sync.js        # Zieht alle Verzeichnis-Benutzer als Gastgeber (User.Read.All)
│   │   │   └── entra-sync-schedule.js # Einmal beim Start, danach alle 24h
│   │   └── index.js                 # App-Einstieg, Middleware, Route-Mounting, Graceful Shutdown
│   ├── .env                         # Secrets (inkl. DB_* Verbindungsdaten) — nicht in Git, nicht committen!
│   ├── .env.example                 # Vorlage ohne echte Werte
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx            # Anmeldeseite (Microsoft-Button + lokaler Fallback)
│   │   │   ├── AuthCallback.jsx     # Verarbeitet OAuth-Redirect + speichert JWT
│   │   │   ├── Dashboard.jsx        # Übersicht, Statistiken, Check-in-Button
│   │   │   ├── Visitors.jsx         # Zentrale Besucherliste: Vorregistriert/Anwesend/Ausgecheckt/Abgesagt in einer Ansicht
│   │   │   └── Settings.jsx         # Auto-Checkout, Datenspeicherung, Passwort, Benutzer, Gastgeber (AD-Gegencheck)
│   │   ├── components/
│   │   │   ├── Layout.jsx           # Shell mit Header, Toast-System
│   │   │   ├── Sidebar.jsx          # Navigation (Dashboard + Besucher, mobile Burger + Desktop kollabierbar)
│   │   │   ├── VisitorCheckinForm.jsx # Check-in-Modal mit Formular
│   │   │   ├── HostAutocomplete.jsx # Live-Suche gegen das AD ab 3 Zeichen
│   │   │   ├── ConfirmDialog.jsx    # Zweistufige Bestätigung (z.B. Auschecken)
│   │   │   ├── TimeAdjuster.jsx     # Per Scrollen/Chevron korrigierbare Uhrzeit
│   │   │   ├── Modal.jsx            # Allgemeiner Modal-Wrapper
│   │   │   └── StatCard.jsx         # Statistik-Karte für Dashboard
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # Login-State, JWT-Handling, loginWithToken()
│   │   └── api/
│   │       └── client.js            # Axios-Instanz mit Bearer-Token-Interceptor
│   ├── dist/                        # Build-Output (von Nginx ausgeliefert, nicht in Git)
│   └── package.json
└── docs/
    ├── dokumentation.md             # Diese Datei
    └── installation.md              # Schritt-für-Schritt Installationsanleitung
```

---

## 5. Datenbank

**Engine:** MariaDB 10.11, lokale Instanz auf demselben Server (DB/Benutzer `visitormgmt_abatplus`, Verbindungsdaten in `backend/.env` als `DB_*`). Server-Zeitzone auf UTC gepinnt (`default-time-zone = '+00:00'`, serverweit).  
**Zugriff:** `backend/src/db/database.js` — dünner Adapter über einen `mysql2/promise`-Connection-Pool mit derselben Aufrufsyntax wie das frühere SQLite-/Postgres-Setup (`prepare(sql).get/all/run`, `exec`, `transaction`), aber vollständig asynchron. `dateStrings: true` + `timezone: 'Z'` sorgen dafür, dass `DATETIME`-Spalten als UTC-Strings ankommen statt implizit in Server-Lokalzeit konvertiert zu werden.  
**Initialisierung:** Beim ersten Start von `index.js` wird das Schema automatisch angelegt. Neue Indizes werden per `CREATE INDEX IF NOT EXISTS` idempotent hinzugefügt — kein manuelles Migrations-Skript nötig.
**Backup:** `backup.sh` (`mysqldump --single-transaction`, gzip-komprimiert) → `/opt/visitor-mgmt-abatplus/backups/*.sql.gz`, täglich per Cron (siehe `docs/installation.md`).

> **JS-Date → DATETIME:** MariaDB lehnt `new Date().toISOString()` (ISO-8601 mit `T`/`Z`/Millisekunden) in `DATETIME`-Spalten ab. Jede Stelle, die ein JS-`Date` schreibt oder gegen eine `DATETIME`-Spalte vergleicht, muss durch `db.toSqlDateTime(date)` (`backend/src/db/database.js`) — wandelt in `YYYY-MM-DD HH:MM:SS` um.

### Tabellen

#### `users` — Systembenutzer (Mitarbeiter mit Login)
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INT PK AUTO_INCREMENT | Auto-Increment |
| name | VARCHAR/TEXT NOT NULL | Anzeigename |
| email | VARCHAR/TEXT UNIQUE | Login-E-Mail (Kleinbuchstaben) |
| password_hash | VARCHAR/TEXT | bcrypt-Hash; leer bei reinen SSO-Nutzern |
| role | VARCHAR/TEXT | `admin` oder `user` |
| active | BOOLEAN (TINYINT(1)) | true = aktiv, false = deaktiviert |
| created_at | DATETIME | |

#### `visitors` — Besucherstammdaten
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INT PK AUTO_INCREMENT | |
| first_name | VARCHAR/TEXT NOT NULL | |
| last_name | VARCHAR/TEXT NOT NULL | |
| company | VARCHAR/TEXT | Unternehmen (optional) |
| created_at | DATETIME | Wann erstmals im System angelegt |

#### `visits` — Einzelne Besuche (ein Besucher kann mehrfach kommen)
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INT PK AUTO_INCREMENT | |
| visitor_id | INTEGER FK | → visitors.id |
| host_id | INTEGER FK | → hosts.id (Ansprechpartner) |
| checked_in_at | DATETIME | Zeitstempel des Check-ins |
| checked_out_at | DATETIME | Zeitstempel des Check-outs; NULL = noch anwesend |
| status | VARCHAR/TEXT | `active` (anwesend) oder `completed` (ausgecheckt) |
| privacy_accepted | BOOLEAN (TINYINT(1)) | true = Datenschutz-Checkbox wurde gesetzt |
| checked_in_by | INTEGER FK | → users.id — wer hat eingecheckt |
| purpose_id | INTEGER FK | → visit_purposes.id, optional |
| notes | VARCHAR/TEXT | Freitext-Notiz |

> **Indizes:** `visitor_id`, `host_id`, `status`, `checked_in_at`, `checked_out_at` sind indiziert — trägt die Suche/Filterung in der Besucherliste bei wachsender Historie.

#### `hosts` — Gastgeber (Ansprechpartner für Besucher)
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INT PK AUTO_INCREMENT | |
| name | VARCHAR/TEXT NOT NULL | |
| email | VARCHAR/TEXT | Firmenemail |
| active | BOOLEAN (TINYINT(1)) | true = aktiv, erscheint in der Autocomplete/Zuordnung |
| ad_object_id | VARCHAR/TEXT | Objekt-ID aus dem Active Directory, falls über SSO-Login oder AD-Autocomplete angelegt |
| created_at | DATETIME | |

> Gastgeber werden automatisch angelegt — beim Microsoft-Login des Mitarbeiters selbst, oder wenn beim Check-in/bei der Vorregistrierung ein Gastgeber über die AD-Autocomplete ausgewählt wird (`findOrCreateHostByEmail()` in `services/hosts-helper.js`). Es gibt keine eigene Gastgeber-Verwaltungsseite mehr; ein Admin-Gegencheck gegen das Verzeichnis ist unter Einstellungen → Gastgeber möglich (siehe Kapitel 7).

#### `preregistrations` — Vorangemeldete Besucher
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INT PK AUTO_INCREMENT | |
| visitor_first_name | VARCHAR/TEXT NOT NULL | |
| visitor_last_name | VARCHAR/TEXT NOT NULL | |
| visitor_company | VARCHAR/TEXT | |
| host_id | INTEGER FK | → hosts.id |
| expected_date | DATE | optional |
| expected_time | TIME | optional |
| notes | VARCHAR/TEXT | Pflichtfeld bei der Erstellung |
| status | VARCHAR/TEXT | `pending` → `checked_in` oder `cancelled` |
| created_by | INTEGER FK | → users.id — wer hat vorregistriert |
| created_at | DATETIME | |

> **Migration (Juli 2026, SQLite-Ära):** `expected_date` war in der ursprünglichen Tabellendefinition fälschlich `NOT NULL`, obwohl das Datum laut Formular/Doku optional ist. Unter SQLite (kein `ALTER COLUMN`) wurde das per Tabellen-Rebuild gelöst; seit der Postgres-Migration (August 2026) ist die Spalte direkt per `ALTER TABLE … DROP NOT NULL` optional.

#### `system_settings` — Schlüssel-Wert-Konfiguration
| Key | Default | Beschreibung |
|---|---|---|
| `auto_checkout_enabled` | `true` | Auto-Checkout aktiv (`true`) oder deaktiviert (`false`) — Werte werden strikt gegen `'true'` geprüft, siehe Fehlerbehebungs-Nachtrag in Kapitel 17 |
| `auto_checkout_time` | `20:00` | Uhrzeit im Format HH:MM |
| `data_retention_days` | `365` | Aufbewahrungsdauer in Tagen; `0` = deaktiviert (unbegrenzt) |
| `notify_host_on_arrival` | `true` | Gastgeber per Mail benachrichtigen, wenn Besucher eintrifft (erfordert konfigurierten Verzeichniszugriff, siehe Kapitel 7) |
| `privacy_policy_enabled` | `true` | Eigener Datenschutztext aktiv (`true`) statt Standard-Link |
| `privacy_policy_text` | *(leer)* | Eigener Hinweistext für die Checkbox im Check-in-Formular; leer = Standard-Link auf abat.de/datenschutz |
| `entra_sync_enabled` | `false` | Geplanter täglicher Gastgeber-Sync gegen Entra ID aktiv |
| `entra_sync_filter` | *(leer)* | Optionaler OData-`$filter` für den Graph-`/users`-Abruf |
| `entra_last_sync_at` | — | Zeitstempel des letzten Sync-Laufs (intern gepflegt) |
| `entra_last_sync_result` | — | JSON mit `{created, updated, deactivated, total}` des letzten Laufs (intern gepflegt) |

#### `visit_purposes` — Besuchszwecke
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INT PK AUTO_INCREMENT | |
| name | VARCHAR/TEXT UNIQUE NOT NULL | z.B. „Besprechung", „Lieferung" |
| sort_order | INTEGER | Reihenfolge in Dropdown/Liste |
| active | BOOLEAN (TINYINT(1)) | false = Soft-Delete, bleibt in historischen Besuchen referenzierbar |

> Bei Erstinstallation werden fünf Standardzwecke automatisch angelegt: Besprechung, Lieferung, Interview, Wartung, Sonstiges.

#### `sso_allowed_users` — Zugriffsliste für Microsoft-SSO-Login
| Spalte | Typ | Beschreibung |
|---|---|---|
| email | VARCHAR/TEXT PK | Kleingeschrieben |
| role | VARCHAR/TEXT | `admin` oder `user` — wird bei jedem SSO-Login auf den Benutzer synchronisiert |
| created_at | DATETIME | |

> Ersetzt die frühere domainweite Allowlist (`sso_allowed_domains`/`SSO_ALLOWED_DOMAINS`) — siehe Kapitel 7. Nur hier gelistete E-Mail-Adressen dürfen sich per SSO anmelden, unabhängig davon, ob bereits ein lokaler Account existiert.

---

## 6. Backend API

**Basis-URL:** `https://visitorplus.luwilab.work/api`

Alle Endpunkte außer `/auth/login`, `/auth/microsoft`, `/auth/microsoft/callback` und `GET /hosts` erfordern einen gültigen JWT im Header:

```
Authorization: Bearer <token>
```

Der Token wird nach Login zurückgegeben und ist 8 Stunden gültig.

> **Settings-Endpunkte:** Das Frontend nutzt `/settings` (ohne Suffix). Der Backend-Router akzeptiert sowohl `/settings` als auch `/settings/system` — beide Pfade sind äquivalent.

---

### Auth — Authentifizierung

#### `POST /auth/login`
Lokaler Login mit E-Mail und Passwort (Fallback für Admins ohne SSO).

**Body:**
```json
{ "email": "admin@example.com", "password": "ChangeMe123!" }
```

**Antwort (200):**
```json
{
  "token": "eyJ...",
  "user": { "id": 1, "name": "Administrator", "email": "...", "role": "admin" }
}
```

**Fehler:** `401` bei falschen Zugangsdaten.

---

#### `GET /auth/me`
Gibt das eigene Benutzerprofil zurück. Nützlich um nach Token-Refresh den aktuellen User zu laden.

**Antwort (200):**
```json
{ "user": { "id": 1, "name": "...", "email": "...", "role": "admin" } }
```

---

#### `PUT /auth/change-password`
Eigenes Passwort ändern. Für SSO-Nutzer ohne gesetztes Passwort funktioniert dies nicht.

**Body:**
```json
{ "currentPassword": "Alt123!", "newPassword": "Neu456!" }
```

---

#### `GET /auth/microsoft`
Leitet den Browser zur Microsoft-Anmeldeseite weiter (OAuth2 Authorization Code Flow).  
Kein JSON — direkte Browser-Navigation. Erzeugt dabei einen zufälligen, einmalig gültigen `state`-Parameter (`crypto.randomBytes(24)`, serverseitig 5 Minuten gültig) und übergibt ihn an Microsoft — Schutz vor CSRF (siehe [Kapitel 17, Sicherheit](#17-sicherheit)).

#### `GET /auth/microsoft/callback`
Wird von Microsoft nach erfolgreicher Anmeldung aufgerufen. Prüft zuerst den zurückgegebenen `state`-Parameter gegen die serverseitige Liste offener Anfragen (ungültig/unbekannt → Redirect mit `?error=invalid_state`) und verbraucht ihn danach (einmalig nutzbar). Tauscht den Code anschließend gegen ein Access-Token, legt ggf. User + Host an und leitet **nicht mehr mit dem JWT im Query-String**, sondern mit einem kurzlebigen, einmalig einlösbaren Austauschcode weiter: `/auth-callback?code=…` (`crypto.randomBytes(24)`, 60 Sekunden gültig, serverseitig gespeichert).

#### `POST /auth/microsoft/exchange`
Löst den Austauschcode aus dem Callback-Redirect gegen das eigentliche JWT ein. Wird von `frontend/src/pages/AuthCallback.jsx` unmittelbar nach dem Redirect aufgerufen.

**Body:**
```json
{ "code": "a3f9c1..." }
```

**Antwort (200):**
```json
{ "token": "eyJ..." }
```

**Fehler:** `400` (`invalid_or_expired_code`) wenn der Code unbekannt, bereits eingelöst oder abgelaufen ist.

> Damit landet das JWT nie mehr in der URL — nicht in Nginx-Access-Logs, nicht in der Browser-Historie, nicht im `Referer`-Header nachfolgender Requests. Das Token wird ausschließlich per POST-Body über HTTPS übertragen.

---

### Dashboard

#### `GET /dashboard/stats`
Liefert Zählwerte für die Statistik-Karten.

**Antwort:**
```json
{
  "currentlyIn": 4,
  "todayTotal": 12,
  "checkedOutToday": 8,
  "thisWeekTotal": 47,
  "pendingPrereg": 3
}
```

#### `GET /dashboard/recent`
Letzte 10 Besuche (neueste zuerst), mit Mitarbeiter und Erfasser.

---

### Besucher

#### `GET /visitors`
Gibt eine paginierte Liste für **einen** Tab und **einen** Tag zurück — Besuche und Vorregistrierungen teilen sich denselben Endpoint statt getrennter Datenhaltung.

**Query-Parameter:**
| Parameter | Default | Beschreibung |
|---|---|---|
| `status` | `active` | `active` (anwesend), `completed` (ausgecheckt), `vorregistriert` (offen) oder `cancelled` (abgesagt) |
| `date` | heutiges Datum | `YYYY-MM-DD` — filtert `active` auf `checked_in_at`, `completed` auf `checked_out_at`; bei `vorregistriert`/`cancelled` bleiben Einträge ohne `expected_date` immer sichtbar |
| `search` | — | Suche in Vor-/Nachname und Unternehmen |
| `page` | `1` | Seite |
| `limit` | `25` | Einträge pro Seite |

**Antwort:**
```json
{
  "visitors": [...],
  "total": 84,
  "page": 1,
  "limit": 25
}
```

Besuchs-Einträge (`status=active`/`completed`) enthalten `visit_id`, `visit_status`, `checked_in_at`, `checked_out_at`, `notes`, `host_name`, `checked_in_by_name`. Vorregistrierungs-Einträge (`status=vorregistriert`/`cancelled`) sind über das Feld `prereg_id` (statt `visit_id`) erkennbar; `visit_status` ist dann `vorregistriert` bzw. `abgesagt`, `checked_in_at`/`checked_out_at`/`checked_in_by_name` sind `null`, stattdessen sind `expected_date`/`expected_time` gesetzt.

---

#### `POST /visitors`
Checkt einen Besucher direkt ein. Legt `visitor` + `visit` in einem Schritt an. `checked_in_by` wird automatisch auf den eingeloggten User gesetzt.

**Body:**
```json
{
  "first_name": "Max",
  "last_name": "Mustermann",
  "company": "Beispiel GmbH",
  "host_id": 3,
  "notes": "Kommt wegen Projekt X",
  "privacy_accepted": true,
  "checked_in_at": "2026-07-07T14:32:00.000Z"
}
```

**Pflichtfelder:** `first_name`, `last_name`, `privacy_accepted: true`, sowie ein Gastgeber — entweder `host_id` (bestehender lokaler Gastgeber) **oder** `host_name`/`host_email`/`host_ad_object_id` (aus der AD-Autocomplete; der Gastgeber wird dabei per `findOrCreateHostByEmail()` gefunden oder angelegt). `notes` ist optional.

`checked_in_at` ist optional (Frontend belegt das Feld mit der aktuellen Zeit vor, änderbar) — ohne Angabe wird der Server-Zeitpunkt verwendet.

Nach dem Anlegen wird — sofern `notify_host_on_arrival` aktiv und eine Gastgeber-E-Mail vorhanden ist — best-effort eine Ankunfts-Mail an den Gastgeber verschickt (siehe Kapitel 7). Ein Fehlversand blockiert den Check-in nicht.

**Antwort (201):** Neu angelegter Visitor + Visit.

---

#### `DELETE /visitors/:id`
Löscht einen Besucher dauerhaft inkl. aller zugehörigen Visits. Nur `admin`.

---

### Visits (Check-out)

#### `POST /visits/:id/checkout`
Checkt einen aktiven Visit aus. Setzt `checked_out_at = jetzt` und `status = completed`. Das Frontend fordert vor dem Aufruf eine zweite Bestätigung in einem Dialog (`ConfirmDialog.jsx`) — serverseitig unverändert.

**Antwort:**
```json
{ "message": "Erfolgreich ausgecheckt" }
```

**Fehler:** `404` wenn Visit nicht existiert, `400` wenn bereits ausgecheckt.

#### `POST /visits/:id/reactivate`
Macht einen Checkout rückgängig — nur solange `checked_out_at` auf den heutigen Kalendertag fällt. Setzt `checked_out_at = NULL`, `status = active`.

**Fehler:** `400` „Besuch ist nicht ausgecheckt" bzw. „Nur am selben Tag rückgängig machbar".

#### `PUT /visits/:id/times`
Korrigiert Check-in- und/oder Check-out-Zeit nachträglich. Beide Felder optional — nur mitgeschickte Werte werden geändert; `checked_out_at: null` löscht die Check-out-Zeit wieder (Besuch bleibt sonst unverändert). Für jeden eingeloggten Nutzer verfügbar (kein admin-only), im Frontend über das Stift-Symbol in der Besucherliste erreichbar.

**Body:**
```json
{ "checked_in_at": "2026-08-17T09:15:00.000Z", "checked_out_at": "2026-08-17T17:30:00.000Z" }
```

**Fehler:** `400` bei ungültigem Datum oder wenn Check-out vor Check-in läge, `404` wenn der Visit nicht existiert.

---

### Besuchszwecke

#### `GET /visit-purposes`
Alle aktiven Besuchszwecke, sortiert nach `sort_order`. Öffentlich (Kiosk/Check-in-Formular braucht dies ohne Login).

#### `POST /visit-purposes`
Neuen Besuchszweck anlegen (ans Ende der Sortierung angehängt).

#### `PUT /visit-purposes/reorder`
Setzt `sort_order` für mehrere Einträge in einem Rutsch (Drag-Handling im Frontend).

**Body:**
```json
{ "order": [{ "id": 3, "sort_order": 0 }, { "id": 1, "sort_order": 1 }] }
```

#### `PUT /visit-purposes/:id`
Name und/oder Sortierung eines Eintrags ändern.

#### `DELETE /visit-purposes/:id`
Soft-Delete (`active = false`) — bleibt in historischen Besuchen referenzierbar.

---

### Gastgeber

Gastgeber kommen primär live aus dem Active Directory — es gibt keine eigene Verwaltungsseite mehr. `hosts` bleibt intern als Zuordnungstabelle bestehen (FK aus `visits`/`preregistrations`) und wird automatisch befüllt.

#### `GET /hosts`
Gibt alle aktiven, **lokal bereits bekannten** Gastgeber zurück. Öffentlich zugänglich (kein Token nötig). Wird u.a. von der Admin-Ansicht „Einstellungen → Gastgeber" verwendet.

**Query:** `?search=Max` — filtert nach Name oder E-Mail.

**Antwort:**
```json
[
  { "id": 1, "name": "Max Mustermann", "email": "max@abat.de" },
  ...
]
```

#### `GET /hosts/search-ad?q=`
Durchsucht das Active Directory live (app-only, Client-Credentials-Flow — siehe Kapitel 7) nach Name oder E-Mail, ab 3 Zeichen. Für die Autocomplete im Check-in- und Vorregistrierungs-Formular.

**Antwort:**
```json
[
  { "id": "aad-object-id", "name": "Max Mustermann", "email": "max@abat.de", "accountEnabled": true }
]
```

**Fehler:** `400` bei weniger als 3 Zeichen, `503` wenn der Verzeichniszugriff nicht konfiguriert ist.

#### `GET /hosts/:id/ad-check`
Admin-Gegencheck: vergleicht einen lokalen Gastgeber-Eintrag gegen das Verzeichnis. Nur `admin`.

**Antwort:**
```json
{ "status": "ok", "adName": "Max Mustermann", "adEmail": "max@abat.de" }
```
`status` ∈ `ok` / `not_found` / `disabled` / `name_mismatch` / `no_email`.

#### `POST /hosts` / `PUT /hosts/:id`
Erstellt oder bearbeitet einen Gastgeber manuell. Nur `admin`.

**Body:**
```json
{ "name": "Max Mustermann", "email": "max@abat.de" }
```

#### `DELETE /hosts/:id`
Soft-Delete: setzt `active = 0`. Der Gastgeber verschwindet aus der Zuordnung, bleibt aber in historischen Besuchen referenzierbar.

---

### Vorregistrierungen

#### `GET /preregistrations`
Gibt alle Vorregistrierungen zurück, neueste zuerst.

#### `POST /preregistrations`
Erstellt eine neue Vorregistrierung.

**Pflichtfelder:** `visitor_first_name`, `visitor_last_name`, `notes`, sowie ein Gastgeber (`host_id` oder `host_name`/`host_email`/`host_ad_object_id`, wie bei `POST /visitors`).

**Body:**
```json
{
  "visitor_first_name": "Anna",
  "visitor_last_name": "Schmidt",
  "visitor_company": "Partner GmbH",
  "host_email": "max@abat.de",
  "host_name": "Max Mustermann",
  "expected_date": "2026-06-25",
  "expected_time": "10:00",
  "notes": "Bewerbungsgespräch"
}
```

> `expected_date` und `expected_time` sind optional (die Spalte war zwischenzeitlich fälschlich `NOT NULL` — siehe Migrationshinweis in Kapitel 5). Die tatsächliche Check-in-Zeit wird beim Einchecken automatisch erfasst.

#### `POST /preregistrations/:id/checkin`
Kernfunktion: Checkt einen vorangemeldeten Besucher ein. Erstellt einen echten `visit`-Eintrag (inkl. der bei der Vorregistrierung hinterlegten Notiz), setzt `checked_in_by = req.user.id` und ändert den Status auf `checked_in`. Löst wie `POST /visitors` best-effort die Gastgeber-Benachrichtigung aus.

**Body (optional):**
```json
{ "checked_in_at": "2026-07-07T14:32:00.000Z" }
```
Ohne Angabe wird der Server-Zeitpunkt verwendet. Das Frontend bietet dafür einen per Scrollen/Chevron leicht korrigierbaren Zeit-Regler (`TimeAdjuster.jsx`).

**Antwort:**
```json
{ "visitor": {...}, "visit": {...} }
```

#### `DELETE /preregistrations/:id`
Zweistufig, abhängig vom aktuellen Status:
- **Status `pending`** (Absagen): Admin oder zugeordneter Gastgeber (E-Mail-Match auf `req.user.email`) → `status = cancelled`, Eintrag erscheint im Tab „Abgesagt". Alle anderen: `403`.
- **Status `cancelled`** (endgültig löschen): nur `admin` → Datensatz wird hart gelöscht. Andere: `403`.

---

### Einstellungen

#### `GET /settings`
Gibt alle Einstellungen als flaches Objekt zurück.

**Antwort:**
```json
{ "auto_checkout_enabled": "true", "auto_checkout_time": "20:00" }
```

> **Wertformat:** Boolesche Settings werden konsequent als String `"true"`/`"false"` gespeichert und gelesen (nicht `"1"`/`"0"`) — `auto-checkout.js` prüft z.B. strikt `=== 'true'`. Siehe Nachtrag in Kapitel 17 zu einem Bug, der genau aus diesem Formatunterschied entstand.

#### `PUT /settings`
Aktualisiert Einstellungen. Nur erlaubte Keys werden akzeptiert. Nur `admin`.

**Body:**
```json
{ "auto_checkout_enabled": "false", "auto_checkout_time": "19:30", "data_retention_days": "180", "notify_host_on_arrival": "false", "privacy_policy_enabled": "true", "privacy_policy_text": "Eigener Hinweistext…" }
```

> Nach Änderung der Checkout-**Zeit** muss das Backend neugestartet werden: `pm2 restart visitor-mgmt` (der nächste Lauf wird beim Start einmalig berechnet). Der **Enabled/Disabled-Toggle** sowie die Aufbewahrungsdauer werden dagegen bei jedem geplanten Lauf frisch aus der DB gelesen — hier ist kein Neustart nötig.

#### `GET /settings/privacy-policy`
Öffentlich (Kiosk/Check-in-Formular). Liefert `{ enabled, text }` für die Datenschutz-Checkbox.

#### `POST /settings/gdpr/cleanup`
Löst die Datenschutz-Bereinigung (siehe Kapitel 12) manuell und sofort aus, unabhängig vom täglichen Lauf. Nur `admin`.

**Antwort:**
```json
{ "visits": 12, "visitors": 3, "prereg": 5 }
```

#### `GET /settings/sso-allowed-users` / `POST /settings/sso-allowed-users` / `DELETE /settings/sso-allowed-users/:email`
Verwaltet die Zugriffsliste für Microsoft-SSO-Login (siehe Kapitel 7). Nur `admin`.

**POST-Body:**
```json
{ "email": "max.mustermann@abat.de", "role": "user" }
```
`role` ist entweder `admin` oder `user` (alles andere fällt auf `user` zurück); ein erneutes `POST` auf eine bereits gelistete E-Mail aktualisiert nur die Rolle.

---

### Gastgeber-Sync (Entra ID)

Alle Endpunkte nur `admin`.

#### `GET /entra-sync/config` / `PUT /entra-sync/config`
Liest bzw. setzt `{ enabled, filter }` — siehe `system_settings`-Keys `entra_sync_enabled`/`entra_sync_filter` in Kapitel 5.

#### `GET /entra-sync/status`
Letzter Sync-Zeitpunkt + Ergebnis.

**Antwort:**
```json
{ "lastSyncAt": "2026-08-17T02:00:00.000Z", "lastResult": { "created": 2, "updated": 5, "deactivated": 1, "total": 84 } }
```

#### `POST /entra-sync/sync`
Löst einen Sync-Lauf sofort aus (zusätzlich zum täglichen Scheduler). Antwortet mit demselben Ergebnisobjekt wie `lastResult` oben.

**Fehler:** `503` wenn der Verzeichniszugriff nicht konfiguriert ist (siehe Kapitel 7), `502` bei einem Graph-API-Fehler.

---

### Benutzer

#### `GET /users`
Alle Benutzer auflisten. Nur `admin`. Passwort-Hashes werden nicht zurückgegeben.

#### `POST /users`
Neuen Benutzer anlegen. Nur `admin`.

**Body:**
```json
{ "name": "Lisa Müller", "email": "lisa@abat.de", "password": "Passwort123!", "role": "user" }
```

#### `PUT /users/:id`
Benutzer bearbeiten. `password` kann leer gelassen werden — dann bleibt das alte Passwort erhalten.

#### `DELETE /users/:id`
Benutzer löschen. Kann nicht den eigenen Account löschen.

Hat der Benutzer bereits Besuche erfasst (`checked_in_by`-Referenz), wird er nur deaktiviert (`active = 0`) — historische Daten bleiben nachvollziehbar. Hat er keine Besuche erfasst, wird er dauerhaft gelöscht.

---

## 7. Microsoft SSO

### Funktionsweise

Das System nutzt den **OAuth2 Authorization Code Flow** über Microsoft Entra ID (ehemals Azure AD):

```
1.  Mitarbeiter klickt „Mit Microsoft-Konto anmelden"
2.  Browser → GET /api/auth/microsoft
3.  Backend erzeugt einen einmaligen state-Parameter (CSRF-Schutz),
    generiert die Microsoft-Auth-URL (via MSAL) und leitet weiter
4.  Mitarbeiter meldet sich bei Microsoft an (ggf. bereits eingeloggt = automatisch)
5.  Microsoft → GET /api/auth/microsoft/callback?code=…&state=…
6.  Backend prüft state gegen die serverseitige Liste offener Anfragen
    und verwirft ihn danach (einmalig nutzbar)
7.  Backend tauscht Code gegen Access-Token (MSAL)
8.  Backend ruft Microsoft Graph API ab: GET /v1.0/me → echte E-Mail + Displayname
9.  Zugriffsliste-Prüfung: E-Mail muss in `sso_allowed_users` stehen — bei
    jedem Login, nicht nur beim ersten (Redirect mit ?error=not_allowed,
    falls nicht gelistet; bestehende User werden bei Rollenabweichung
    zwischen Zugriffsliste und lokalem Account sofort synchronisiert)
10. Falls User noch nicht existiert: User + Host automatisch angelegt,
    Rolle aus der Zugriffsliste übernommen
11. Backend stellt JWT aus, hinterlegt es hinter einem kurzlebigen
    Einmal-Code und leitet zu /auth-callback?code=… weiter (kein Token in der URL)
12. Frontend (AuthCallback.jsx) ruft POST /api/auth/microsoft/exchange
    mit { code } auf und erhält das JWT im Response-Body
13. Frontend speichert Token, leitet auf /dashboard weiter
```

> Details zu state-CSRF-Schutz und Austauschcode-Mechanismus: siehe [Kapitel 17, Sicherheit](#17-sicherheit).

### Datenquellen aus Microsoft Graph

Nach dem Token-Exchange wird `https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName` abgerufen:

| Feld | Graph-Attribut | Fallback |
|---|---|---|
| E-Mail (Login) | `mail` | `userPrincipalName` → `account.username` |
| Anzeigename | `displayName` | `idTokenClaims.name` → E-Mail-Prefix |

> **Wichtig:** `mail` ist das tatsächliche E-Mail-Attribut aus dem Active Directory. `userPrincipalName` (UPN) kann davon abweichen (z.B. `vorname@tenant.onmicrosoft.com` statt `vorname@firma.de`). Deshalb wird `mail` bevorzugt.

### Automatische Account-Erstellung

Beim **ersten Login** eines Mitarbeiters:
- `users`-Eintrag wird angelegt (Rolle: `user`, kein Passwort, E-Mail aus `mail`-Attribut)
- `hosts`-Eintrag (Gastgeber) wird angelegt (Displayname + E-Mail aus Microsoft Graph)

Bei **weiteren Logins** desselben Accounts:
- Bestehender User wird gefunden (E-Mail-Match auf `mail`-Attribut, case-insensitive)
- Kein neuer Eintrag — sofortiger Login

> Wurden Accounts noch mit dem UPN angelegt (vor der Graph-API-Umstellung), müssen E-Mail-Adressen in Einstellungen → Benutzer manuell korrigiert werden.

### Zugriffsliste für SSO-Login (Einstellungen → Microsoft SSO)

Ersetzt seit August 2026 die frühere domainweite Allowlist (`sso_allowed_domains`/`SSO_ALLOWED_DOMAINS`). Statt ganzer E-Mail-Domains wird jetzt **jede einzelne** zum Login berechtigte Adresse explizit eingetragen (Tabelle `sso_allowed_users`, verwaltet über die API-Endpunkte in Kapitel 6 bzw. den Abschnitt „Zugriffsliste" im SSO-Einstellungstab).

- **Bei jedem** Login geprüft, nicht nur beim ersten — eine E-Mail von der Liste entfernen sperrt auch bestehende Accounts sofort aus, nicht nur zukünftige Neuanlagen.
- Die Rolle (`admin`/`user`) wird direkt beim Eintrag in der Zugriffsliste festgelegt und bei **jedem** Login mit dem lokalen `users`-Datensatz synchronisiert — eine Rollenänderung in der Zugriffsliste wirkt beim nächsten Login des Nutzers, ohne manuellen Schritt in „Einstellungen → Benutzer".
- Ist die E-Mail nicht gelistet, wird die Anmeldung abgelehnt: Redirect mit `?error=not_allowed`.
- Es gibt **keinen** `.env`-Fallback mehr für diese Liste (anders als bei Tenant-ID/Client-ID/Client-Secret) — sie lebt ausschließlich in der Datenbank und muss über die UI gepflegt werden.

> **Migrationshinweis:** Bei der Umstellung von der Domain- auf die Zugriffslisten-Allowlist muss für jeden bisher per Domain automatisch zugelassenen Mitarbeiter einmalig ein Eintrag in der neuen Zugriffsliste angelegt werden — sonst werden auch bereits bestehende Accounts beim nächsten Login ausgesperrt.

### Azure App Registration einrichten — eine Registrierung für Login UND Verzeichnis

Login (SSO) und Verzeichnis-Zugriff (Gastgeber-Autocomplete, Admin-Gegencheck, Ankunfts-Mails) teilen sich **eine einzige** Azure-App-Registrierung, unterschieden nur durch die Art der Berechtigung:

- **Delegiert** (für den interaktiven Login-Flow): `openid`, `profile`, `email`, `User.Read`
- **Anwendung** (für den app-only Client-Credentials-Flow, Admin-Zustimmung erforderlich): `User.Read.All`, `Mail.Send`

**Azure Portal → Microsoft Entra ID → App-Registrierungen → Neue Registrierung**

| Feld | Wert |
|---|---|
| Name | `abat+ Besucherverwaltung` (oder beliebig) |
| Unterstützte Kontotypen | Nur Konten in diesem Organisationsverzeichnis |
| Umleitungs-URI (Web) | `https://visitorplus.luwilab.work/api/auth/microsoft/callback` |

**Clientgeheimnis erstellen:**  
App-Registrierung → Zertifikate & Geheimnisse → Neuer geheimer Clientschlüssel → Wert sofort kopieren (wird nur einmal angezeigt).

**API-Berechtigungen:** beide Sets aus obiger Liste hinzufügen; für die Anwendungsberechtigungen (`User.Read.All`, `Mail.Send`) ist Administratorzustimmung nötig.

**Konfiguration in der App:** Tenant-ID, Client-ID, Client Secret und das Absender-Postfach für Gastgeber-Mails werden unter **Einstellungen → Microsoft SSO** eingetragen (dort auch die Umleitungs-URI zum Kopieren, eine Statusanzeige „Konfiguriert"/„Nicht konfiguriert" und die Zugriffsliste). Tenant-ID/Client-ID/Client-Secret sind alternativ weiterhin per `.env` möglich (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`) — dienen dann nur als Fallback, falls in der Datenbank nichts hinterlegt ist; ein in den Einstellungen gespeicherter Wert hat Vorrang. Änderungen über die Einstellungsseite wirken sofort, ohne Neustart. Die Zugriffsliste selbst (siehe voriger Abschnitt) hat **keinen** `.env`-Fallback.

Ist weder in der Datenbank noch in `.env` ein vollständiger Satz (Tenant-ID, Client-ID, Client Secret) hinterlegt, liefern `/api/auth/microsoft`, `/hosts/search-ad` und `/hosts/:id/ad-check` `503`; der Mailversand wird still übersprungen. Der Rest der App bleibt ohne diese Konfiguration voll nutzbar — Gastgeber lassen sich in diesem Fall weiterhin nur über bereits bekannte lokale Einträge zuordnen.

> **Betriebshinweis:** Das Client Secret läuft nach der in Azure gewählten Frist ab — rechtzeitig erneuern (Einstellungen → Microsoft SSO oder `.env`).

### Gastgeber-Sync (Entra ID)

**Service:** `backend/src/services/entra-sync.js` + `entra-sync-schedule.js`

Zusätzlich zur Autocomplete-Suche (on-demand) lässt sich ein **geplanter** Sync aktivieren, der alle Benutzer aus dem Verzeichnis (`GET /v1.0/users`, dieselbe App-Registrierung, Anwendungsberechtigung `User.Read.All`) als Gastgeber einpflegt:

- Läuft einmal beim Backend-Start (Nachholung, falls der Server länger aus war) und danach alle 24 Stunden (`entra-sync-schedule.js`) — sofern `entra_sync_enabled = true`.
- Abgleich per `hosts.ad_object_id`: bekanntes AD-Objekt → Name/E-Mail aktualisieren; neues AD-Objekt, aber E-Mail bereits als lokaler Gastgeber ohne `ad_object_id` bekannt → verknüpfen statt duplizieren; sonst neu anlegen.
- Gastgeber, die zuvor per Sync/Login verknüpft waren (`ad_object_id` gesetzt), aber im aktuellen Sync-Ergebnis fehlen, werden **deaktiviert** (`active = false`), nicht gelöscht — historische Besuche bleiben referenzierbar.
- Optionaler OData-`$filter` (z.B. `accountEnabled eq true`) schränkt ein, welche Verzeichnis-Benutzer berücksichtigt werden.
- Manueller Anstoß jederzeit über „Jetzt synchronisieren" (Einstellungen → Gastgeber-Sync) oder `POST /entra-sync/sync`.

---

## 8. Frontend & Seiten

### Routen

| Route | Seite | Zugriff |
|---|---|---|
| `/login` | Anmeldung (Microsoft-Button + lokaler Fallback) | öffentlich |
| `/auth-callback` | OAuth-Rückgabe — verarbeitet Token, leitet weiter | öffentlich |
| `/dashboard` | Statistiken, letzte Aktivitäten (max. 10), Check-in-Button | alle |
| `/visitors` | Zentrale Besucherliste — Tabs Vorregistriert/Anwesend/Ausgecheckt/Abgesagt, mobile Kartenansicht | alle |
| `/settings` | Einstellungen (Tabs je nach Rolle, inkl. Gastgeber-AD-Gegencheck für admin) | alle |

`/hosts` und `/preregistrations` existieren als Routen nicht mehr; alte Links werden auf `/dashboard` bzw. `/visitors` umgeleitet (React-Router-Redirect in `App.jsx`).

### Navigation

**Desktop:** kollabierbare Sidebar links — per Pfeil-Button ein-/ausklappen.  
**Mobil:** Sidebar versteckt, Burger-Menü oben links öffnet Overlay.

### Login-Seite

Header zeigt **abat+** als Wortmarke (kein Bildlogo). Primär: großer **„Mit Microsoft-Konto anmelden"**-Button. Darunter ein ausklappbarer Bereich für E-Mail/Passwort-Login (Fallback für den Admin-Account).

### Dashboard

Vier Statistik-Karten:
- Aktuell anwesend
- Heute eingecheckt
- Heute ausgecheckt
- Vorregistrierungen offen

Darunter eine Liste der letzten 10 Aktivitäten mit Name, Unternehmen, Gastgeber und „Erfasst durch" — **nur für Admins sichtbar**.

### Besucherliste (`/visitors`)

Vier Tabs: **Vorregistriert** · **Anwesend** · **Ausgecheckt** · **Abgesagt** — eine gemeinsame Liste statt getrennter Seiten für Besucher und Vorregistrierungen. Suchfeld filtert in Echtzeit nach Name und Unternehmen (rund ein Drittel der Zeilenbreite).

**Tages-Filter:** Bei den Tabs „Anwesend" und „Ausgecheckt" steht ein Datumsfeld zur Verfügung (Standard: heute) — zeigt „Anwesend" nach Check-in-Datum bzw. „Ausgecheckt" nach Check-out-Datum gefiltert; ein „Heute"-Link setzt zurück. Die Tabs „Vorregistriert" und „Abgesagt" sind bewusst **nicht** tagesgefiltert — offene bzw. abgesagte Vorregistrierungen sind Aufgaben, keine tagesgebundenen Protokolleinträge, und bleiben unabhängig vom gewählten Datum sichtbar (siehe Nachtrag in Kapitel 17).

Desktop: Tabelle mit Spalten Name, Gastgeber, Check-in, Check-out, Notizen, Erfasst durch, Aktionen.  
Mobil: Karten-Layout mit denselben Informationen und Touch-freundlichen Buttons.

Aktionen je nach Zeilen-Typ:
- **Anwesend:** „Auschecken" (mit Bestätigungsdialog)
- **Ausgecheckt, heute:** zusätzlich „Rückgängig" (`POST /visits/:id/reactivate`)
- **Vorregistriert:** „Einchecken" (mit korrigierbarer Uhrzeit) und — nur für den zugeordneten Gastgeber oder Admin — „Absagen"
- **Abgesagt:** nur für Admin sichtbar — „Löschen" (endgültig)
- **Admin:** zusätzlich „Löschen" bei Besuchen (Besucher dauerhaft löschen)

Kopfbereich bietet zwei Aktionen: **„Einchecken"** (Direkt-Check-in) und **„Vorregistrieren"** (Formular für zukünftige Besuche; Gastgeber optional — entweder per AD-Suche oder manuell als Freitext, falls kein AD-Treffer oder noch kein Gastgeber feststeht).

---

## 9. Check-in Ablauf

**Direkter Check-in (häufigster Fall):**

1. Mitarbeiter öffnet **https://visitorplus.luwilab.work** — meldet sich per Microsoft an (einmalig, danach meist automatisch)
2. Dashboard oder Besucher-Seite → Button **„Einchecken"**
3. Modal öffnet sich mit Formular:
   - Vorname* + Nachname*
   - Unternehmen (optional)
   - Gastgeber/Ansprechpartner* (Live-Suche gegen das Active Directory ab 3 Zeichen)
   - Check-in-Datum & -Uhrzeit* (vorbelegt mit „jetzt", änderbar)
   - Notizen (optional, aber in der Besucherliste sichtbar)
   - Checkbox: „Der Besucher wurde auf die [Datenschutzerklärung](https://www.abat.de/datenschutz) hingewiesen."*
4. Absenden → Backend legt `visitor` + `visit` an, setzt `checked_in_by = ID des eingeloggten Users`; Gastgeber wird per E-Mail gefunden/angelegt
5. Besucher erscheint sofort in der Liste mit **„Erfasst am [Zeit] durch [Name]"**
6. Ist eine Gastgeber-E-Mail vorhanden und die Benachrichtigung aktiv, erhält der Gastgeber eine Ankunfts-Mail

**Check-out:**

- Klick auf **„Auschecken"** in der Zeile → Bestätigungsdialog → `POST /visits/:id/checkout`
- Alternativ: automatisch um 20:00 Uhr (konfigurierbar)
- Am selben Tag rückgängig machbar über **„Rückgängig"** (`POST /visits/:id/reactivate`) — z.B. bei versehentlichem Auschecken

---

## 10. Vorregistrierungen

Für Besucher, die im Voraus angekündigt sind (z.B. Termine, Bewerbungsgespräche). Verwaltet auf der Besucher-Seite (`/visitors`, Tab „Vorregistriert") — keine eigene Seite mehr.

**Ablauf:**

1. Mitarbeiter öffnet **Besucher → „Vorregistrieren"**
2. Formular ausfüllen: Name, Unternehmen (optional), Gastgeber (AD-Autocomplete **oder** manuelle Freitext-Eingabe, falls kein AD-Treffer — beides optional), Datum (optional), Uhrzeit (optional), Notizen (optional)
3. Eintrag erscheint im Tab **„Vorregistriert"** — unabhängig vom gerade gewählten Tages-Filter, solange er offen ist
4. Wenn Besucher ankommt: irgendein eingeloggter Mitarbeiter klickt **„Einchecken"** bei dem Eintrag — die vorbelegte Uhrzeit lässt sich im Dialog per Scrollen/Chevron-Buttons leicht korrigieren
5. Backend erstellt `visit` (inkl. der hinterlegten Notiz), setzt `checked_in_by = aktueller User`, Status → `checked_in`
6. Eintrag wandert in den Tab **„Anwesend"**; der Gastgeber erhält ggf. eine Ankunfts-Mail

**Wichtig:** Der Mitarbeiter der einscheckt muss nicht identisch mit dem sein, der vorregistriert hat.

> Datum und Uhrzeit sind optional — die tatsächliche Check-in-Zeit wird beim Einchecken automatisch erfasst.

**Absagen:** Nur der zugeordnete Gastgeber (E-Mail-Match) oder ein Admin kann eine ausstehende Vorregistrierung absagen (`status = cancelled`) bzw. dauerhaft löschen (Admin). Andere Nutzer erhalten `403`.

---

## 11. Auto-Checkout

**Service:** `backend/src/services/auto-checkout.js`

Der Auto-Checkout läuft täglich zur konfigurierten Uhrzeit und checkt alle noch aktiven Besuche (`status = 'active'`) automatisch aus.

**Technische Umsetzung:**
- Beim Backend-Start wird die konfigurierte Zeit aus der Datenbank gelesen
- `setTimeout` berechnet die Millisekunden bis zur nächsten Checkout-Zeit
- Nach Ausführung plant der Service den nächsten Lauf automatisch (+ 24h)
- Ist die konfigurierte Zeit bereits vergangen, wird auf den nächsten Tag gewartet

**Konfiguration** über Einstellungen → Auto-Checkout:
- Toggle: aktiviert / deaktiviert
- Uhrzeit: beliebige HH:MM-Zeit

> Nach Änderung der Checkout-Zeit im UI muss das Backend neugestartet werden: `pm2 restart visitor-mgmt`

---

## 12. Datenspeicherung (Data Retention)

**Service:** `backend/src/services/data-retention.js`

Löscht täglich alte Besuchsdaten automatisch. Läuft einmal beim Backend-Start (Nachholung falls Server ausgefallen war) und danach alle 24 Stunden.

**Was wird gelöscht:**
- `visits` mit `status = 'completed'` und `checked_in_at` älter als N Tage
- `visitors` ohne verbleibende Visits und `created_at` älter als N Tage
- `preregistrations` mit `status != 'pending'` und `created_at` älter als N Tage

**Was bleibt immer erhalten:**
- Aktive Besuche (`status = 'active'`)
- Ausstehende Vorregistrierungen (`status = 'pending'`)

**Konfiguration** über Einstellungen → Datenspeicherung (nur admin):
| Option | Wert |
|---|---|
| 30 / 60 / 90 / 180 Tage | Voreinstellungen per Klick |
| 1 Jahr | Standard (365 Tage) |
| Benutzerdefiniert | Beliebige Tageszahl |
| Deaktiviert | `0` — Daten werden nie automatisch gelöscht |

Änderungen werden beim nächsten täglichen Lauf automatisch übernommen — kein Backend-Neustart nötig.

---

## 13. Einstellungen

Erreichbar unter `/settings`. Gruppierte Navigation links (Betrieb · Zugriff & Benutzer · System · Konto) statt einzelner Tabs-Leiste — welche Gruppen/Einträge sichtbar sind, hängt von der Rolle ab (Admins sehen alles, normale Benutzer nur „Konto → Passwort").

### Auto-Checkout (nur admin, Gruppe „Betrieb")
- Toggle: Auto-Checkout ein- oder ausschalten
- Uhrzeit-Feld: Zeit im Format HH:MM
- Zweiter Toggle im selben Tab: „Gastgeber bei Ankunft per Mail benachrichtigen" (`notify_host_on_arrival`) — setzt eine konfigurierte Verzeichnis-Anbindung voraus (Kapitel 7)
- Speichern → schreibt in `system_settings` Tabelle (`auto_checkout_enabled` als `"true"`/`"false"`)
- Nach Zeitänderung: `pm2 restart visitor-mgmt` nötig; der Enabled-Toggle selbst wirkt ohne Neustart

### Besuchszwecke (nur admin, Gruppe „Betrieb")
- Liste mit Auf/Ab-Pfeilen zum Sortieren, Bearbeiten, Deaktivieren
- „Hinzufügen" legt einen neuen Zweck ans Ende der Liste

### Datenspeicherung (nur admin, Gruppe „System")
- Preset-Buttons: 30 / 60 / 90 / 180 Tage / 1 Jahr / Benutzerdefiniert / Deaktiviert
- Benutzerdefiniert: beliebige Tageszahl als Eingabe
- Speichern → schreibt `data_retention_days` in `system_settings`
- „Jetzt bereinigen"-Button löst die Löschung sofort aus (`POST /settings/gdpr/cleanup`), unabhängig vom täglichen automatischen Lauf
- Zweiter Bereich im selben Tab: Datenschutztext für die Kiosk-Checkbox konfigurierbar (`privacy_policy_enabled`/`privacy_policy_text`)

### Passwort ändern (alle)
- Aktuelles Passwort + neues Passwort + Bestätigung
- Mindestlänge: 8 Zeichen
- Für reine SSO-Nutzer (kein Passwort gesetzt) nicht nutzbar

### Benutzer (nur admin, Gruppe „Zugriff & Benutzer")
- Tabelle aller aktiven Benutzer mit Name, E-Mail, Rolle
- Erstellen: Name, E-Mail, Passwort, Rolle
- Bearbeiten: alle Felder; Passwort leer lassen = unverändert
- Löschen: hard-delete wenn keine Besuche erfasst; sonst Deaktivierung (Historien-Schutz)
- Rollenwechsel: `user` ↔ `admin`

### Gastgeber (nur admin, Gruppe „Zugriff & Benutzer")
- Read-only Liste der lokal bekannten Gastgeber (Name, E-Mail)
- „Prüfen"-Button je Zeile → AD-Gegencheck (`GET /hosts/:id/ad-check`), Status-Badge zeigt `ok`/nicht gefunden/deaktiviert/Namensabweichung/keine E-Mail
- Ohne konfigurierten Verzeichniszugriff (Kapitel 7) zeigt der Tab einen entsprechenden Hinweis statt Fehlern
- Keine eigene Gastgeber-Verwaltungsseite mehr — Gastgeber werden automatisch aus dem AD angelegt (siehe Kapitel 5, Tabelle `hosts`)

### Gastgeber-Sync (nur admin, Gruppe „Zugriff & Benutzer")
- Toggle: geplanten täglichen Sync aktivieren
- Optionales Graph-`$filter`-Feld
- Statusbereich: Zeitpunkt + Ergebnis (`created`/`updated`/`deactivated`) des letzten Laufs
- „Jetzt synchronisieren"-Button für einen sofortigen manuellen Lauf
- Details siehe Kapitel 7, Abschnitt „Gastgeber-Sync (Entra ID)"

### Microsoft SSO (nur admin, Gruppe „Zugriff & Benutzer")
- Tenant-ID, Client-ID, Client Secret, Absender-Postfach für Gastgeber-Mails
- Statusanzeige „Konfiguriert"/„Nicht konfiguriert", Umleitungs-URI zum Kopieren
- Zugriffsliste: E-Mail + Rolle hinzufügen/entfernen (siehe Kapitel 7)

---

## 14. Infrastruktur & Deployment

### Nginx

**Config-Datei:** `/etc/nginx/sites-available/visitorplus.luwilab.work`  
**Symlink:** `/etc/nginx/sites-enabled/visitorplus.luwilab.work`

Aufgaben:
- HTTP (Port 80) → HTTPS Redirect (301)
- HTTPS (Port 443) → statische Dateien aus `frontend/dist`
- `/api/*` → Proxy zu Node.js auf Port 3001
- `index.html` wird mit `no-cache` ausgeliefert (SPA-Routing funktioniert nach Updates sofort)
- JS/CSS/Bilder/Fonts: 1 Jahr Cache (Vite erzeugt Hash-basierte Dateinamen — sicher)
- Security-Header: HSTS, X-Frame-Options, CSP, nosniff

### SSL-Zertifikat

Da die Domain über Cloudflare proxied wird, kommunizieren Browser und Cloudflare über Cloudflares eigenes TLS-Zertifikat. Zwischen Cloudflare und dem Server wird das Origin-Zertifikat genutzt:

```
/etc/ssl/visitorplus/cert.pem   # selbst-signiert, 10 Jahre gültig
/etc/ssl/visitorplus/key.pem    # privater Schlüssel (chmod 600)
```

Cloudflare SSL-Modus: **Full** (funktioniert mit selbst-signiertem Cert).  
Mit Cloudflare Origin Certificate (aus dem CF-Dashboard): **Full (Strict)** möglich.

### PM2

**Prozessname:** `visitor-mgmt`  
**Startbefehl:**
```bash
pm2 start src/index.js --name visitor-mgmt --cwd /opt/visitor-mgmt-abatplus/backend
```

PM2 startet den Prozess bei Abstürzen automatisch neu und überlebt Server-Neustarts (nach `pm2 startup` + `pm2 save`).

```bash
pm2 list                           # Alle Prozesse + Status
pm2 restart visitor-mgmt           # Neustart (nach Code-Änderung)
pm2 restart visitor-mgmt --update-env  # Neustart + neue .env einlesen
pm2 logs visitor-mgmt              # Live-Logs (Strg+C zum Beenden)
pm2 logs visitor-mgmt --lines 100  # Letzte 100 Zeilen
pm2 stop visitor-mgmt             # Anhalten
```

> **Kein root-Betrieb:** Der Prozess läuft nicht mehr unter root, sondern unter dem dedizierten, unprivilegierten Systembenutzer `svc-visitormgmtplus` (Eintrag in `/opt/ecosystem.config.js`, `uid`/`gid`). `/opt/visitor-mgmt-abatplus` gehört diesem Benutzer. Details siehe [Kapitel 17, Sicherheit](#17-sicherheit).

---

## 15. Umgebungsvariablen (.env)

**Datei:** `/opt/visitor-mgmt-abatplus/backend/.env`  
**Nicht in Git** — von `.gitignore` ausgeschlossen. Vorlage unter `backend/.env.example`.  
**Dateiberechtigung:** `600`, Eigentümer `svc-visitormgmtplus` — die Datei enthält JWT-Secret und Azure-Clientgeheimnis und darf nicht world-readable sein.

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `PORT` | Ja | Backend-Port (Standard: 3001) |
| `JWT_SECRET` | Ja | Mindestens 64 zufällige Zeichen — `openssl rand -hex 64` |
| `DB_HOST` | Ja | MariaDB-Host (i.d.R. `127.0.0.1`) |
| `DB_PORT` | Ja | MariaDB-Port (Standard: `3306`) |
| `DB_NAME` | Ja | Datenbankname (`visitormgmt_abatplus`) |
| `DB_USER` | Ja | DB-Benutzer (`visitormgmt_abatplus`) |
| `DB_PASSWORD` | Ja | Passwort des DB-Benutzers |
| `APP_URL` | Ja | Öffentliche URL der App inkl. Schema, ohne Slash |
| `AZURE_CLIENT_ID` | Fallback | Client-ID der Azure App Registration — Fallback, falls in Einstellungen → Microsoft SSO nichts hinterlegt ist |
| `AZURE_TENANT_ID` | Fallback | Tenant-ID des Entra ID-Verzeichnisses — Fallback (s.o.) |
| `AZURE_CLIENT_SECRET` | Fallback | Clientgeheimnis — Fallback (s.o.), läuft ab, muss erneuert werden! |
| `NOTIFY_FROM_EMAIL` | Fallback | Absender-Postfach für Gastgeber-Ankunfts-Mails — Fallback (s.o.) |
| `ADMIN_EMAIL` | Optional | Initialer Admin (nur beim allerersten Start wirksam) |
| `ADMIN_PASSWORD` | Optional | Initiales Admin-Passwort |

> **JWT_SECRET:** Niemals leer lassen, niemals in Git einchecken. Bei Änderung werden alle bestehenden Tokens ungültig — alle Nutzer müssen sich neu anmelden. `auth.js` und `auth-microsoft.js` werfen beim Start einen Fehler, wenn die Variable fehlt — es gibt keinen unsicheren Default-Fallback mehr (siehe [Kapitel 17, Sicherheit](#17-sicherheit)).

> **Microsoft-SSO-Werte:** `AZURE_CLIENT_ID`/`AZURE_TENANT_ID`/`AZURE_CLIENT_SECRET`/`NOTIFY_FROM_EMAIL` sind nur noch der Fallback — primär werden sie unter Einstellungen → Microsoft SSO in der DB (`system_settings`) gepflegt, ein dort gesetzter Wert hat Vorrang und wirkt sofort ohne Neustart. Das Client Secret läuft nach 1–2 Jahren ab (konfigurierbar in Azure); bei Ablauf schlägt der Microsoft-Login still fehl. Die Zugriffsliste (`sso_allowed_users`, siehe Kapitel 7) hat **keinen** `.env`-Fallback — sie lebt ausschließlich in der Datenbank.

> **ADMIN_EMAIL/ADMIN_PASSWORD nicht gesetzt?** Ohne diese beiden Variablen legt `database.js` beim allerersten Start einen Admin mit den Defaultwerten `admin@example.com` / `ChangeMe123!` an (siehe [Kapitel 17, Offener Punkt](#17-sicherheit)) — vor dem Produktivbetrieb prüfen und ggf. sofort ändern.

---

## 16. Wichtige Befehle

```bash
# ── Deployment ────────────────────────────────────────────────
# Frontend neu bauen (nach jeder Code-Änderung im Frontend)
cd /opt/visitor-mgmt-abatplus/frontend && npm run build

# Backend neu starten (nach Backend-Code-Änderungen)
pm2 restart visitor-mgmt

# .env-Änderungen übernehmen
pm2 restart visitor-mgmt --update-env

# Nginx-Config neu laden
nginx -t && systemctl reload nginx

# ── Updates ───────────────────────────────────────────────────
git -C /opt/visitor-mgmt-abatplus pull
cd /opt/visitor-mgmt-abatplus/backend && npm install
cd /opt/visitor-mgmt-abatplus/frontend && npm run build
pm2 restart visitor-mgmt

# ── Datenbank ─────────────────────────────────────────────────
# .env laden (DB_* Variablen) und mysql-Shell öffnen
set -a; source /opt/visitor-mgmt-abatplus/backend/.env; set +a
MYSQL_PWD="$DB_PASSWORD" mysql -h "$DB_HOST" -u "$DB_USER" "$DB_NAME"

# Tabellen anzeigen
MYSQL_PWD="$DB_PASSWORD" mysql -h "$DB_HOST" -u "$DB_USER" "$DB_NAME" -e 'SHOW TABLES;'

# Alle Benutzer anzeigen
MYSQL_PWD="$DB_PASSWORD" mysql -h "$DB_HOST" -u "$DB_USER" "$DB_NAME" \
  -e "SELECT id, name, email, role, active FROM users;"

# Passwort zurücksetzen
cd /opt/visitor-mgmt-abatplus/backend
HASH=$(node -e "const b=require('bcryptjs'); b.hash('NeuesPasswort123!',12).then(h=>process.stdout.write(h))")
MYSQL_PWD="$DB_PASSWORD" mysql -h "$DB_HOST" -u "$DB_USER" "$DB_NAME" \
  -e "UPDATE users SET password_hash='$HASH' WHERE email='admin@example.com';"

# Benutzer auf admin hochstufen
MYSQL_PWD="$DB_PASSWORD" mysql -h "$DB_HOST" -u "$DB_USER" "$DB_NAME" \
  -e "UPDATE users SET role='admin' WHERE email='max.mustermann@abat.de';"

# Datenbank-Backup (siehe auch backup.sh, läuft täglich per Cron)
mkdir -p /root/backups
MYSQL_PWD="$DB_PASSWORD" mysqldump --single-transaction -h "$DB_HOST" -u "$DB_USER" "$DB_NAME" \
  | gzip > "/root/backups/visitors-$(date +%Y%m%d-%H%M).sql.gz"

# ── API-Tests ─────────────────────────────────────────────────
curl https://visitorplus.luwilab.work/api/health

curl -s -X POST https://visitorplus.luwilab.work/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ChangeMe123!"}' | python3 -m json.tool

# ── Logs ──────────────────────────────────────────────────────
pm2 logs visitor-mgmt              # Live
pm2 logs visitor-mgmt --lines 100  # Letzte 100 Zeilen
tail -f /root/.pm2/logs/visitor-mgmt-out.log
tail -f /root/.pm2/logs/visitor-mgmt-error.log
```

---

## 17. Sicherheit

> Ergebnis eines Security-Hardening-Durchgangs auf dem Produktivserver (Juli 2026). Dieses Kapitel dokumentiert den aktuellen Sicherheitsstand — sowohl serverweite Infrastruktur-Maßnahmen als auch app-spezifische Änderungen an dieser Instanz.

### Host-/Netzwerk-Ebene (serverweit, betrifft alle Apps auf diesem Server)

| Maßnahme | Status |
|---|---|
| **UFW-Firewall** | Aktiv, Default-Deny eingehend. Nur Port 22 (SSH), 80 und 443 offen. |
| **Node-Backend-Port** | Nicht mehr direkt aus dem Internet erreichbar — nur noch über den Nginx-Reverse-Proxy. Express bindet in `backend/src/index.js` explizit an `127.0.0.1` statt `0.0.0.0`. |
| **fail2ban** | Installiert und aktiv, mit sshd-Jail gegen Brute-Force-Login-Versuche. |
| **SSH** | X11Forwarding deaktiviert. |
| **Nginx (global, `/etc/nginx/nginx.conf`)** | `ssl_protocols` auf TLSv1.2/TLSv1.3 beschränkt, `server_tokens off` (keine Versionsangabe in Response-Headern). |

### Nginx — Site-Konfiguration (`/etc/nginx/sites-available/visitorplus.luwilab.work`)

- **Rate Limiting:**
  - Zone `login_limit` (5 Requests/Minute pro IP) auf `/api/auth/` — deckt sowohl den lokalen Passwort-Login als auch die Microsoft-SSO-Routen ab, da `/api/auth/microsoft` unterhalb von `/api/auth/` liegt.
  - Zone `api_limit` (60 Requests/Minute pro IP) auf die übrigen `/api/`-Routen.
- **Defense-in-Depth:** `location ~ /\.git { deny all; }` zusätzlich zur bereits bestehenden statischen Auslieferung aus `frontend/dist` (in dem `.git` ohnehin nicht liegt).

### Prozess- & Dateiberechtigungen

- Der PM2-Prozess läuft **nicht mehr als root**. Ein dedizierter, unprivilegierter Systembenutzer `svc-visitormgmtplus` wurde angelegt; `/opt/visitor-mgmt-abatplus` gehört vollständig diesem Benutzer. In `/opt/ecosystem.config.js` ist für den Eintrag `visitor-mgmt-abatplus` `uid: 'svc-visitormgmtplus'` / `gid: 'svc-visitormgmtplus'` gesetzt.
- `backend/.env` wurde von `644` (world-readable) auf **`600`** geändert — die Datei enthält JWT-Secret und Azure/MSAL-Clientgeheimnis.
- Backup-Dateien (`backups/*.dump`) gehören `svc-visitormgmtplus`. (Historisch, aus der SQLite-Ära: Datenbank- und Backup-Dateien wurden auf `640` gesetzt — seit der Postgres-Migration liegen keine DB-Dateien mehr im Dateisystem des Projekts, nur noch die `pg_dump`-Backups.)

### JWT & Zugangsdaten

- **JWT_SECRET rotiert:** Neuer, zufälliger 128-stelliger Hex-Wert in `backend/.env`. Wie immer bei einer Rotation gilt: alle vorher ausgestellten Tokens sind ungültig geworden, alle Nutzer mussten sich neu anmelden.
- **Unsicherer Fallback entfernt:** `backend/src/routes/auth.js` und `backend/src/routes/auth-microsoft.js` enthielten zuvor `process.env.JWT_SECRET || 'secret'` — bei fehlender Umgebungsvariable wäre also unbemerkt mit dem hartkodierten, öffentlich bekannten Wert `'secret'` signiert worden. Beide Routen werfen jetzt beim Start einen Fehler, wenn `JWT_SECRET` nicht gesetzt ist, statt still auf den Fallback auszuweichen.

### Microsoft-SSO-Flow gehärtet (`backend/src/routes/auth-microsoft.js`)

- **CSRF-Schutz (state-Parameter):** Die OAuth-Autorisierungsanfrage enthält jetzt einen unvorhersehbaren, einmalig gültigen `state`-Parameter (`crypto.randomBytes(24)`, serverseitig im Speicher gehalten, 5 Minuten TTL). Der Callback validiert den zurückgegebenen `state` gegen die Liste offener Anfragen, bevor er fortfährt, und löscht ihn danach (Einmalgebrauch). Vorher gab es überhaupt keinen `state`-Parameter — eine klassische OAuth-CSRF-Lücke, über die ein Angreifer den Browser eines Opfers dazu bringen konnte, einen vom Angreifer initiierten Auth-Flow abzuschließen.
- **Kein Token mehr im URL-Query-String:** Der Callback leitete vorher direkt mit `${APP_URL}/auth-callback?token=${jwt}` weiter — das JWT landete dadurch in Nginx-Access-Logs, Browser-Historie und im `Referer`-Header nachfolgender Requests. Jetzt stellt der Callback stattdessen einen kurzlebigen, einmalig einlösbaren Austauschcode aus (`crypto.randomBytes(24)`, 60 Sekunden TTL, serverseitig im Speicher) und leitet mit `?code=…` weiter. Das Frontend (`frontend/src/pages/AuthCallback.jsx`) ruft den neuen Endpunkt `POST /api/auth/microsoft/exchange` mit `{ code }` im JSON-Body auf und erhält `{ token }` zurück, sofern der Code gültig und noch nicht eingelöst ist (sonst `400`). Das eigentliche JWT wird jetzt ausschließlich per POST-Body über HTTPS übertragen, nie mehr über eine URL.
- **Neu: optionale Domain-Allowlist** über `SSO_ALLOWED_DOMAINS` (mittlerweile durch die feingranulare Zugriffsliste ersetzt — siehe Nachtrag August 2026 unten und [Kapitel 7](#7-microsoft-sso)).
- **Betriebshinweis:** Microsoft SSO ist in der aktuellen Produktivumgebung **noch nicht konfiguriert** (`AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_CLIENT_SECRET` sind in der Live-`.env` leer) — der Endpunkt liefert aktuell `503 „Microsoft SSO nicht konfiguriert"`. Die oben beschriebenen Härtungsmaßnahmen sind vollständig implementiert und einsatzbereit, wurden auf diesem Server aber noch nicht Ende-zu-Ende gegen einen echten Azure-Tenant getestet. Einrichtung siehe [installation.md, Kapitel 5](./installation.md#5-microsoft-sso-einrichten-azure).

### Backup-Skript-Bug behoben

`/opt/visitor-mgmt-abatplus/backup.sh` verwies durch einen Copy-Paste-Fehler (vom Schwesterprojekt visitor-mgmt) auf falsche, fest kodierte Pfade des anderen Projekts — **die Datenbank des jeweils anderen Projekts**. Wäre das Skript in diesem Zustand gelaufen, hätte es die falsche Datenbank ins falsche Verzeichnis gesichert. Das Skript referenziert jetzt korrekt `/opt/visitor-mgmt-abatplus/backups` und (seit der Postgres-Migration, siehe unten) die eigenen `PG_*`-Verbindungsdaten aus `backend/.env`.

Zusätzlich rief bis dahin **kein Cron-Job und kein Scheduler** das Skript überhaupt auf — Backups waren dadurch de facto nie erstellt worden. Ein Cron-Eintrag wurde ergänzt: `/etc/cron.d/visitor-mgmt-backups`, läuft täglich um 02:00 Uhr als `svc-visitormgmtplus`, Logausgabe nach `logs/backup.log`. Details siehe [installation.md, Kapitel 13](./installation.md#13-automatisches-backup).

### Datenbank von SQLite auf PostgreSQL migriert (August 2026)

Aus SQLite (better-sqlite3, synchron, Einzeldatei) wurde auf PostgreSQL 16 (lokale Instanz auf demselben Server, asynchroner Zugriff über einen `pg`-Connection-Pool) migriert — siehe [Kapitel 5, Datenbank](#5-datenbank) für Details zu Schema und Zugriffsschicht. Bestehende Daten wurden 1:1 unter Beibehaltung der IDs übernommen. Spaltentypen wurden dabei modernisiert (native `BOOLEAN`, `TIMESTAMPTZ`/`DATE` statt SQLite-typischem `INTEGER 0/1`/`TEXT`). `backup.sh` nutzt seitdem `pg_dump` statt `sqlite3 .backup`.

### Offener Punkt — noch nicht abschließend geklärt

In der Live-Datenbank existieren zwei Accounts mit generisch wirkenden Namen: `admin@example.com` und `user@example.com`. Es ist nicht abschließend geklärt, ob es sich um legitime aktive Accounts oder um übrig gebliebene Test-Accounts handelt. Dies wurde dem Betreiber zur Prüfung gemeldet (umbenennen, Passwortstärke verifizieren oder deaktivieren) — es wurde noch **keine automatische Aktion** vorgenommen. Vor einem produktiven Go-Live sollten diese Accounts geprüft werden (siehe auch [installation.md, Kapitel 11](./installation.md#11-erster-start--test)).

### Datenbank von PostgreSQL auf MariaDB migriert (17. August 2026)

Nur wenige Stunden nach der SQLite→PostgreSQL-Migration (siehe unten) noch einmal umgestellt, diesmal auf MariaDB 10.11 — vereinheitlicht die Infrastruktur mit dem Schwesterprojekt `visitor-mgmt`, das bereits auf MariaDB läuft, statt zwei verschiedene DB-Engines auf demselben Server zu pflegen. `backend/src/db/database.js` komplett neu geschrieben (`mysql2/promise` statt `pg`, `dateStrings: true`/`timezone: 'Z'`, `toSqlDateTime()`-Helper für JS-Date→`DATETIME`-Schreibvorgänge). Schema-Typen angepasst (`SERIAL`→`INT AUTO_INCREMENT`, `TIMESTAMPTZ`→`DATETIME`, `BOOLEAN`→`TINYINT(1)`), `ON CONFLICT … DO UPDATE`→`ON DUPLICATE KEY UPDATE`, `RETURNING id`→`insertId`, Postgres-spezifische Funktionen (`to_char`, `::interval`-Cast) auf MariaDB-Äquivalente (`DATE_FORMAT`, `INTERVAL ? DAY`) umgestellt. `key` als Spaltenname in `system_settings` musste überall mit Backticks versehen werden (reserviertes Wort in MySQL/MariaDB, in Postgres unproblematisch). Server-Zeitzone serverweit bereits auf UTC gepinnt (galt schon für `visitor-mgmt`). Alle Änderungen live gegen eine frisch angelegte MariaDB-Instanz smoke-getestet (Transaktions-Commit/Rollback, Check-in-Flow, Dashboard-Queries, Settings-Upsert, SSO-Zugriffsliste) — siehe [Kapitel 5, Datenbank](#5-datenbank) für den aktuellen Stand. `backup.sh` nutzt seitdem `mysqldump` statt `pg_dump`. **Die bestehenden PostgreSQL-Daten wurden dabei nicht automatisch übernommen** — die neue MariaDB-Datenbank startet leer (nur Default-Settings, Besuchszwecke, initialer Admin); ein manueller Datenexport aus dem alten PostgreSQL-Bestand war zum Zeitpunkt der Umstellung nicht Teil des Auftrags.

### Feature- und Härtungs-Batch: Entra-Sync, editierbare Zeiten, Produktiv-Härtung (17. August 2026)

**Neue Features:**
- Geplanter Gastgeber-Sync gegen Entra ID (`entra-sync.js`/`entra-sync-schedule.js`) — siehe Kapitel 7.
- Check-in-/Check-out-Zeit nachträglich korrigierbar (`PUT /visits/:id/times`).
- Besuchszwecke (`visit_purposes`) — konfigurierbar, sortierbar, im Check-in-Formular wählbar.
- SSO-Zugriffsliste (`sso_allowed_users`) ersetzt die domainweite Allowlist — siehe Kapitel 7.
- Konfigurierbarer Datenschutztext + manuell auslösbare GDPR-Bereinigung.
- Settings-Seite auf gruppierte Navigation umgestellt (Betrieb / Zugriff & Benutzer / System / Konto statt einzelner Tab-Leiste).

**Produktiv-Härtung:**
- DB-Indizes ergänzt (`visits.*`, `hosts.ad_object_id`, `hosts.email`, `preregistrations.*`) — vorher kein einziger Index im Schema.
- `pool.on('error', …)` ergänzt — ein Fehler auf einem idle pg-Client hätte vorher den ganzen Prozess unbehandelt abstürzen lassen.
- Graceful Shutdown (`SIGTERM`/`SIGINT` schließen HTTP-Server und pg-Pool sauber, statt bei `pm2 restart` mitten in Requests gekillt zu werden).
- `pm2`-Eintrag (`/opt/ecosystem.config.js`) um `NODE_ENV: production`, `max_restarts`, `max_memory_restart`, `watch: false` ergänzt — vorher als einzige App auf dem Server ohne diese Schutzmechanismen.
- `backup.sh` sichert jetzt zusätzlich `backend/uploads/` (Dokumente, Signaturen) als `tar.gz`, nicht mehr nur die Datenbank.
- Alle npm-Abhängigkeiten aktualisiert, Vulnerabilities behoben (Backend: 1 High über `@azure/msal-node`-Kette; Frontend: 4 High/1 Moderate über `react-router`, `postcss`, `nanoid`).

**Bugfixes:**
- **Auto-Checkout blieb nach dem ersten Speichern in den Einstellungen stumm stehen:** Das Frontend schrieb `auto_checkout_enabled` als `"1"`/`"0"`, der Scheduler (`auto-checkout.js`) prüft aber strikt `=== 'true'`. Sobald ein Admin den Tab einmal speicherte — unabhängig vom gewählten Wert —, kippte der Wert auf `"1"`/`"0"` und der tägliche Checkout-Lauf brach seitdem jeden Tag stillschweigend ab, ohne Fehler irgendwo. Behoben, indem das Frontend jetzt `"true"`/`"false"` schreibt, konsistent mit dem Rest der Codebase.
- **SSO-Fehlermeldungen zeigten Rohcode statt Klartext:** Fehler, die der Server direkt an `/login?error=xxx` weiterleitet (z.B. `not_allowed`, `sso_cancelled`, `invalid_state`), zeigte die Login-Seite als nackten Code an — die Übersetzungstabelle existierte nur in `AuthCallback.jsx`, das für diesen Redirect-Pfad nie durchlaufen wird. `Login.jsx` hat jetzt dieselbe Mapping-Tabelle.
- **`db.transaction()` war keine echte Transaktion:** `BEGIN`/`COMMIT`/`ROLLBACK` liefen auf einem eigens ausgecheckten Client, die Queries im Callback aber weiterhin über `db.prepare().run()` — intern `pool.query()` — also auf einer anderen Connection. Jedes Statement committete faktisch sofort einzeln; ein `ROLLBACK` bei einem Fehler griff ins Leere. Betraf `visitors.js` (Besucher+Visits löschen), `data-retention.js` (GDPR-Bereinigung), `visit-purposes.js` (Reorder) und `settings.js` (Bulk-Settings-Update). `transaction(fn)` gibt `fn` jetzt ein an den transaktionalen Client gebundenes `{prepare, exec}`-Objekt mit; alle vier Aufrufstellen wurden entsprechend angepasst und das Rollback-Verhalten live gegen die DB verifiziert.

### Nachträge aus dem Merge-/AD-Feature-Batch (Juli 2026)

- **JWT_SECRET-Fallback in der Middleware behoben:** `backend/src/middleware/auth.js` verifizierte Tokens bisher mit `process.env.JWT_SECRET || 'secret'` — derselbe unsichere Fallback, der in `auth.js`/`auth-microsoft.js` bereits beim vorherigen Hardening-Durchgang entfernt wurde, existierte hier weiterhin unbemerkt. Die Middleware wirft jetzt ebenfalls beim Fehlen von `JWT_SECRET` einen Startfehler statt still auf `'secret'` auszuweichen.
- **Audit-Log-Pfad korrigiert:** `backend/src/services/audit-log.js` zeigte auf `/opt/visitor-mgmt/logs` (Schwesterprojekt-Pfad statt `-abatplus`) — dieselbe Fehlerklasse wie der bereits behobene Backup-Skript-Bug. Zeigt jetzt korrekt auf `/opt/visitor-mgmt-abatplus/logs`.
- **Neues App-only-Verzeichniskonto:** separat von der SSO-App-Registrierung, ausschließlich mit Application Permissions (`User.Read.All`, `Mail.Send`) — kompromittiert das SSO-Client-Secret nicht automatisch den Verzeichniszugriff. Details in Kapitel 7.
- **Absage-Berechtigung für Vorregistrierungen verschärft:** Bisher konnte jeder eingeloggte Mitarbeiter eine fremde Vorregistrierung stornieren. Jetzt nur noch der zugeordnete Gastgeber (E-Mail-Match) oder ein Admin.

### Korrekturen nach erstem Nutzertest (Juli 2026)

- **Notizen sind wieder optional** (Check-in und Vorregistrierung) — die Pflichtfeld-Anforderung aus dem ersten Durchgang wurde zurückgenommen.
- **„Alle"-Tab entfernt, „Abgesagt"-Tab ergänzt:** Die Besucherliste zeigt jetzt **Vorregistriert · Anwesend · Ausgecheckt · Abgesagt**.
- **Tages-Filter ergänzt** (`GET /visitors?date=`, Standard: heute) für die Tabs „Anwesend"/„Ausgecheckt".
- **Bug behoben (gemeldet nach erstem Test):** Der Tages-Filter wurde zunächst versehentlich auch auf „Vorregistriert" angewendet und verglich `expected_date` exakt statt „ab heute" — dadurch verschwanden Vorregistrierungen mit einem Datum ungleich dem gefilterten Tag komplett aus der Liste, obwohl das Dashboard sie weiterhin als „offen" zählte (`dashboard.js` zählt `expected_date >= heute`, unabhängig vom UI-Tages-Filter). Die Tabs „Vorregistriert" und „Abgesagt" ignorieren den Tages-Filter jetzt bewusst vollständig — offene bzw. abgesagte Vorregistrierungen sind Aufgaben, keine tagesgebundenen Protokolleinträge.
- **Absagen vs. endgültig Löschen entkoppelt:** `DELETE /preregistrations/:id` storniert jetzt bei `status=pending` immer zuerst (`cancelled`, sichtbar im neuen „Abgesagt"-Tab) — auch für Admins, die vorher direkt hart gelöscht haben. Erst ein zweiter Aufruf auf einen bereits abgesagten Eintrag löscht endgültig (nur Admin).
- **Manuelle Gastgeber-Eingabe bei Vorregistrierung:** Ist kein passender AD-Treffer vorhanden, kann der Gastgeber als Freitext eingegeben werden (`findOrCreateManualHost()` in `hosts-helper.js`, dedupliziert nur per Namensgleichheit, da keine E-Mail vorliegt).
- **Suchfeld schmaler:** ca. ein Drittel der Zeilenbreite statt voller Breite, um Platz für den neuen Tages-Filter zu schaffen.

---

## 18. Fehlerbehebung

### „Anmeldung fehlgeschlagen" — kein Netzwerkfehler sichtbar
Backend läuft nicht.
```bash
pm2 list              # Status prüfen
pm2 restart visitor-mgmt
pm2 logs visitor-mgmt # Fehlermeldung lesen
```

### 502 Bad Gateway
Nginx erreicht das Backend nicht.
```bash
curl http://localhost:3001/api/health   # Backend direkt testen
pm2 list                                # Läuft visitor-mgmt?
```

### Microsoft-Login schlägt fehl / Endlosschleife
```bash
# .env prüfen
cat /opt/visitor-mgmt-abatplus/backend/.env | grep AZURE
# Alle drei AZURE_*-Variablen müssen gesetzt sein

# Azure: Redirect-URI muss exakt übereinstimmen
# https://visitorplus.luwilab.work/api/auth/microsoft/callback
```

Mögliche Fehler aus der Callback-URL (`?error=...`):
| Fehler | Ursache |
|---|---|
| `sso_failed` | MSAL konnte keine Auth-URL generieren — AZURE_* prüfen |
| `sso_not_configured` | Tenant-ID/Client-ID/Client Secret unvollständig (weder DB noch `.env`) |
| `sso_cancelled` | Nutzer hat Anmeldung abgebrochen |
| `sso_token_failed` | Code-Austausch fehlgeschlagen — Client Secret abgelaufen? |
| `invalid_state` | `state`-Parameter fehlt/unbekannt/abgelaufen — mögliches CSRF oder Anfrage zu alt (> 5 Min.) |
| `no_email` | Microsoft-Profil hat keine E-Mail-Adresse |
| `not_allowed` | E-Mail steht nicht auf der Zugriffsliste — unter Einstellungen → Microsoft SSO ergänzen (siehe Kapitel 7) |

> Alle Codes werden auf der Login-Seite seit dem Nachtrag „Feature- und Härtungs-Batch" (17. August 2026) als deutscher Klartext angezeigt statt als Rohcode.

### Azure Client Secret abgelaufen
Neues Secret in Azure erstellen, `.env` aktualisieren, Backend neu starten:
```bash
pm2 restart visitor-mgmt --update-env
```

### Seite zeigt altes Frontend nach Update
```bash
# Hard-Reload im Browser: Strg + Shift + R
# index.html ist konfiguriert mit no-cache — sollte automatisch klappen
```

### Auto-Checkout läuft nicht zur richtigen Zeit
```bash
# Einstellungen im UI neu speichern, dann:
pm2 restart visitor-mgmt
# Scheduler liest neue Zeit beim Start
```

### Nginx-Fehler nach Config-Änderung
```bash
nginx -t   # Immer zuerst testen — zeigt Syntax-Fehler
systemctl reload nginx
```

### `npm install` schlägt fehl

**Fehler `unable to verify the first certificate`** → SSL-Zertifikat nicht verifizierbar (z.B. Corporate Proxy):
```bash
NODE_OPTIONS=--use-system-ca npm install
```

### Backend startet nicht — `ECONNREFUSED` auf MariaDB-Port

→ MariaDB läuft nicht oder `DB_*`-Variablen in `.env` sind falsch:
```bash
systemctl status mariadb
set -a; source /opt/visitor-mgmt-abatplus/backend/.env; set +a
MYSQL_PWD="$DB_PASSWORD" mysql -h "$DB_HOST" -u "$DB_USER" "$DB_NAME" -e '\s'
```

### Datenbank-Integrität prüfen
```bash
set -a; source /opt/visitor-mgmt-abatplus/backend/.env; set +a
MYSQL_PWD="$DB_PASSWORD" mysql -h "$DB_HOST" -u "$DB_USER" "$DB_NAME" -e "SELECT 1;"
# Verbindungsfehler statt Ergebnis = DB nicht erreichbar/beschädigt
```

### MariaDB-Session-Zeitzone falsch — Zeiten weichen um Stunden ab

→ Server-Zeitzone nicht auf UTC gepinnt (siehe Kapitel 2 der Installationsanleitung):
```bash
mysql -u root -e "SELECT @@global.time_zone;"
# Sollte +00:00 sein — falls nicht: /etc/mysql/mariadb.conf.d/60-visitor-mgmt-abatplus.cnf
# mit default-time-zone = '+00:00' anlegen, dann: systemctl restart mariadb
```
