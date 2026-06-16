# Besucherverwaltungssystem — Projektdokumentation

> Erstellt: 15. Juni 2026 | Zuletzt aktualisiert: 16. Juni 2026  
> Kunde: **abat AG**  
> Domain: https://visitor.luwilab.work  
> Server: /opt/visitor-mgmt

---

## Inhaltsverzeichnis

1. [Projektübersicht](#1-projektübersicht)
2. [Corporate Identity — abat AG](#2-corporate-identity--abat-ag)
3. [Systemarchitektur](#3-systemarchitektur)
4. [Verzeichnisstruktur](#4-verzeichnisstruktur)
5. [Datenbank](#5-datenbank)
6. [Backend API](#6-backend-api)
7. [Frontend & Seiten](#7-frontend--seiten)
8. [Kiosk-System](#8-kiosk-system)
9. [abat-ID](#9-abat-id)
10. [Dokumenten-Upload & Unterschrift](#10-dokumenten-upload--unterschrift)
11. [Zugangsdaten & Benutzerrollen](#11-zugangsdaten--benutzerrollen)
12. [Standortbasierte Zugriffskontrolle](#12-standortbasierte-zugriffskontrolle)
13. [Badge-Drucker (Brother QL-820NWB)](#13-badge-drucker-brother-ql-820nwb)
14. [E-Mail-System](#14-e-mail-system)
15. [Auto-Checkout](#15-auto-checkout)
16. [Host-Portal](#16-host-portal)
17. [Audit-Log & Compliance](#17-audit-log--compliance)
18. [Sicherheit](#18-sicherheit)
19. [GDPR & Datenschutz](#19-gdpr--datenschutz)
20. [Infrastruktur & Deployment](#20-infrastruktur--deployment)
21. [SSL & Cloudflare](#21-ssl--cloudflare)
22. [Umgebungsvariablen (.env)](#22-umgebungsvariablen-env)
23. [Wichtige Befehle](#23-wichtige-befehle)
24. [Fehlerbehebung](#24-fehlerbehebung)

---

## 1. Projektübersicht

Ein vollständiges, webbasiertes Besucherverwaltungssystem für Unternehmen. Besucher können am Empfang oder per Kiosk-Modus ein- und ausgecheckt werden. Das System unterstützt Vorregistrierungen, Badge-Druck (PDF + Etikettendrucker), Evakuierungslisten, Berichte, standortbasierte Zugriffskontrolle, ein Gastgeber-Portal sowie ein Audit-Log für Compliance-Anforderungen.

### Features im Überblick

| Feature | Beschreibung |
|---|---|
| Check-in / Check-out | Walk-in, Kamera-QR-Scan oder Vorregistrierung; auch manuell im Dashboard |
| Vorregistrierung | Gastgeber kann Besucher voranmelden, QR-Code per E-Mail; Gruppenregistrierung |
| QR-Code Vorregistrierung | Server-seitig generiert (kein externer Dienst), Anzeige im Admin-Modal |
| Badge-Generierung | A6-PDF (Landscape) mit Name, Firma, Gastgeber, QR-Code |
| Badge-Drucker | Brother QL-820NWB über IP (RAW TCP Port 9100), DK-11202 (62×100 mm) |
| abat-ID | Permanente Besucher-ID im Format `ABAT-########`; in E-Mail + Kiosk-Erfolgsscreen |
| Kiosk-Modus | 2 Optionen: Einchecken, Auschecken — kein Login nötig |
| Kiosk Check-in Flow | Mehrstufig: QR-Scan oder abat-ID → Daten bestätigen → Datenschutz unterschreiben → Erfolg |
| Datenschutzerklärung | Unterschrift am Kiosk mit Finger/Stift (signature_pad); Text konfigurierbar im Admin |
| Mehrsprachiger Kiosk | Deutsch / Englisch, umschaltbar per Sprachbutton |
| Kamera-QR-Scanner | Echter Kamera-Scan; robuster Stop-Guard verhindert Doppel-Stop-Fehler |
| Dokumenten-Upload | PDF/DOC hochladen + digitale Unterschrift (Canvas) |
| Evakuierungsliste | Echtzeit, nach Standort gruppiert, druckoptimiert, 30 s Auto-Refresh |
| Berichte & Export | Tages-/Monatsberichte, CSV-Export |
| E-Mail-Benachrichtigungen | Gastgeber bei Ankunft, Besucher Check-in-Bestätigung, QR-Code bei Vorregistrierung |
| SMTP-Verschlüsselung | STARTTLS / SSL/TLS / Keine — konfigurierbar im Admin |
| Mehrere Standorte | Unterstützung für mehrere Firmenstandorte |
| Standortbasierte Zugriffskontrolle | Empfang-Benutzer können auf bestimmte Standorte beschränkt werden |
| Benutzerverwaltung | Anlegen, Bearbeiten, Deaktivieren von Benutzern im Admin (superadmin) |
| Besuchsgrundauswahl | Konfigurierbare Besuchszwecke im Admin |
| Auto-Checkout | Automatisches Auschecken aller aktiven Besucher täglich um 19:00 Uhr (konfigurierbar) |
| Host-Portal | Gastgeber können sich separat einloggen, Besucher einsehen und Vorregistrierungen erstellen |
| Audit-Log | 90 Tage Aufbewahrung, Tagesprotokoll-Download, Compliance-Bericht als CSV |
| Superadmin-Löschrechte | Besucher und Vorregistrierungen dauerhaft aus der Datenbank entfernen |
| Rollenverwaltung | superadmin / admin / receptionist / host |
| GDPR-Datenlöschung | Automatische Anonymisierung nach konfigurierbaren Tagen |
| abat AG CI | Logo, Mulish-Schrift, Markenfarben durchgängig |

---

## 2. Corporate Identity — abat AG

Das System ist vollständig auf die CI der abat AG ausgerichtet.

### Logos

| Datei (Quelle) | Verwendung | Eingebunden als |
|---|---|---|
| `abat-Logo-Dunkelgrau_bigger.png` | Login-Seite, Admin-Bereich (heller Hintergrund) | `/public/logo-dark.png` |
| `abat-Logo-Hellgrau.png` | Kiosk-Header, Sidebar (dunkler Hintergrund) | `/public/logo-light.png` |

### Schriftart: Mulish

Variable Font (100–900 Gewicht), liegt lokal auf dem Server — keine externe CDN-Abhängigkeit.

### Farbpalette

| Name | HEX | Verwendung |
|---|---|---|
| **Blau** | `#004B87` | Primäre Buttons, aktive Navigation, Badge-Header |
| Hellblau | `#00A3E0` | Hover-Akzente, Badge-Akzentstreifen |
| Lichtblau | `#9ADBE8` | Hintergründe, Badge-Untertitel |
| Dunkelgrau | `#53565A` | Fließtext, Überschriften, Sidebar |
| Hellgrau | `#C8C9C7` | Rahmen, Trennlinien |
| Metallic | `#8D9093` | Untertexte, Platzhalter |

---

## 3. Systemarchitektur

```
Internet
   │
   ▼
Cloudflare Proxy (SSL-Terminierung zum User)
   │  HTTPS (443)
   ▼
Nginx (Reverse Proxy)
   ├── /           → /opt/visitor-mgmt/frontend/dist  (React SPA)
   └── /api/       → http://127.0.0.1:3001            (Node.js Backend)

Node.js Backend (Port 3001)
   ├── better-sqlite3 → /opt/visitor-mgmt/backend/data/visitors.db
   └── Logs           → /opt/visitor-mgmt/logs/audit-YYYY-MM-DD.log

Brother QL-820NWB (Etikettendrucker)
   └── RAW TCP Port 9100 (im lokalen Netzwerk erreichbar)
```

**Tech Stack:**
- **Frontend:** React 18 + Vite + Tailwind CSS + Mulish Font
- **Backend:** Node.js + Express.js
- **Datenbank:** SQLite (better-sqlite3, WAL-Modus)
- **Auth:** JWT (JSON Web Tokens) — Admin-Token: 8h, Host-Token: 12h
- **Sicherheit:** helmet (HTTP-Header), express-rate-limit (Brute-Force-Schutz)
- **PDF:** PDFKit (Badge-Generierung A6 Landscape)
- **Etikettendruck:** canvas + net.Socket (Brother QL Raster Protocol)
- **QR-Codes:** qrcode (Generierung) + html5-qrcode (Kamera-Scanner)
- **Unterschrift:** signature_pad (Canvas-basiert)
- **Datei-Upload:** multer (Fotos + Dokumente)
- **E-Mail:** Nodemailer (SMTP, STARTTLS/SSL/Keine konfigurierbar)
- **Webserver:** Nginx 1.24
- **SSL:** Cloudflare Origin Certificate (gültig bis 2041)
- **Prozessmanager:** systemd

---

## 4. Verzeichnisstruktur

```
/opt/visitor-mgmt/
│
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── database.js          # SQLite-Initialisierung & Schema
│   │   │   └── seed.js              # Testdaten
│   │   ├── middleware/
│   │   │   └── auth.js              # JWT-Middleware, requireRole(), location_ids laden
│   │   ├── routes/
│   │   │   ├── auth.js              # Login, /me, Passwort ändern
│   │   │   ├── audit-log.js         # Audit-Log: Dateiliste, Download, Compliance-Bericht
│   │   │   ├── dashboard.js         # Stats, Chart-Daten, Recent visits
│   │   │   ├── documents.js         # Dokument-Upload + Unterschrift
│   │   │   ├── host-portal.js       # Host-Portal: Login, Besucher, Vorregistrierungen
│   │   │   ├── hosts.js             # CRUD Gastgeber (GET public, ohne password_hash)
│   │   │   ├── locations.js         # CRUD Standorte
│   │   │   ├── preregistrations.js  # Vorregistrierung + Batch + QR-Versand
│   │   │   ├── reports.js           # Berichte, Evakuierung (standortgefiltert), CSV
│   │   │   ├── settings.js          # System-Settings, GDPR-Cleanup, E-Mail-Test
│   │   │   ├── users.js             # CRUD Benutzer + Standortzuweisung (superadmin)
│   │   │   ├── visit-purposes.js    # CRUD Besuchszwecke (GET public)
│   │   │   ├── visitors.js          # CRUD Besucher + Check-in (standortgefiltert)
│   │   │   └── visits.js            # Check-out, Checkout per QR, Namenssuche
│   │   ├── services/
│   │   │   ├── audit-log.js         # Log-Schreiben, Cleanup (90 Tage), Dateiliste
│   │   │   ├── auto-checkout.js     # Täglicher Auto-Checkout per setTimeout
│   │   │   ├── badge.js             # PDF-Badge Generierung (PDFKit, A6 Landscape)
│   │   │   ├── email.js             # Nodemailer: alle ausgehenden Mails
│   │   │   ├── label-printer.js     # Brother QL-820NWB RAW TCP Etikettendruck
│   │   │   └── qrcode.js            # QR-Code als Buffer oder DataURL
│   │   └── index.js                 # Express App, Port 3001
│   ├── data/
│   │   └── visitors.db              # SQLite-Datenbank (NICHT löschen!)
│   ├── uploads/
│   │   ├── documents/               # Hochgeladene Dokumente (PDF/DOC) — auth-geschützt
│   │   └── signatures/              # Unterschriften als PNG — auth-geschützt
│   ├── .env                         # Produktionskonfiguration
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   ├── logo-dark.png
│   │   ├── logo-light.png
│   │   └── fonts/
│   ├── src/
│   │   ├── api/client.js            # Axios-Instanz, 401-Redirect (kiosk-aware)
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── Sidebar.jsx          # Navigation mit rollenbasierter Filterung
│   │   │   ├── Modal.jsx
│   │   │   ├── QRScanner.jsx
│   │   │   ├── SignaturePad.jsx
│   │   │   └── DocumentSigning.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── KioskLangContext.jsx  # DE/EN Übersetzungen für Kiosk
│   │   └── pages/
│   │       ├── AuditLog.jsx         # Audit-Log & Compliance (superadmin)
│   │       ├── Dashboard.jsx
│   │       ├── Evacuation.jsx       # Nach Standort gruppiert, druckoptimiert
│   │       ├── HostLogin.jsx        # Gastgeber-Portal Login (kein Admin-Zugang)
│   │       ├── HostPortal.jsx       # Gastgeber-Portal (Besucher + Vorregistrierung)
│   │       ├── Hosts.jsx
│   │       ├── KioskCheckin.jsx
│   │       ├── KioskCheckout.jsx
│   │       ├── KioskManual.jsx
│   │       ├── KioskStart.jsx       # Mit Sprachschalter DE/EN
│   │       ├── Login.jsx
│   │       ├── NotFound.jsx         # 404-Fehlerseite
│   │       ├── PreRegistration.jsx  # Mit Gruppenregistrierung
│   │       ├── Reports.jsx
│   │       ├── Settings.jsx
│   │       └── Visitors.jsx         # Tabs: Alle / Angekündigt / Aktiv / Verlassen
│   ├── dist/                        # Produktions-Build
│   └── package.json
│
└── logs/
    └── audit-YYYY-MM-DD.log         # Tägliche Audit-Protokolle (90 Tage Aufbewahrung)
```

---

## 5. Datenbank

**Datei:** `/opt/visitor-mgmt/backend/data/visitors.db`  
**Engine:** SQLite mit WAL-Modus und Foreign Key Enforcement

### Tabellen

#### `users` — Systembenutzer
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | Anzeigename |
| email | TEXT UNIQUE | Login-E-Mail |
| password_hash | TEXT | bcrypt Hash (cost 12) |
| role | TEXT | `superadmin` / `admin` / `receptionist` |
| active | INTEGER | 1 = aktiv, 0 = deaktiviert |
| created_at | DATETIME | |

#### `user_locations` — Standortzuweisung für Benutzer (many-to-many)
| Spalte | Typ | Beschreibung |
|---|---|---|
| user_id | INTEGER PK | FK → users (CASCADE DELETE) |
| location_id | INTEGER PK | FK → locations (CASCADE DELETE) |

> Kein Eintrag = Benutzer sieht alle Standorte.

#### `locations` — Standorte
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | z.B. "Bremen", "Heidelberg" |
| address | TEXT | Straße & Hausnummer |
| city | TEXT | Stadt |
| active | INTEGER | |

#### `hosts` — Gastgeber
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | |
| email | TEXT | Für Benachrichtigungen und Portal-Login |
| phone | TEXT | |
| department | TEXT | Abteilung |
| location_id | INTEGER | FK → locations |
| password_hash | TEXT | bcrypt Hash (cost 12) — nur wenn Host-Portal aktiviert |
| active | INTEGER | Soft-Delete |

> `password_hash` wird **nicht** über die öffentliche API zurückgegeben.

#### `visitors` — Besucherstammdaten
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| abat_id | TEXT UNIQUE | Permanente Besucher-ID, Format `ABAT-########` |
| first_name | TEXT | |
| last_name | TEXT | |
| email | TEXT | |
| phone | TEXT | |
| company | TEXT | |
| nda_signed | INTEGER | 0 / 1 |
| nda_signed_at | DATETIME | |
| created_at | DATETIME | |

#### `visits` — Einzelne Besuche
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| visitor_id | INTEGER | FK → visitors |
| host_id | INTEGER | FK → hosts |
| location_id | INTEGER | FK → locations |
| purpose | TEXT | Besuchszweck |
| badge_number | TEXT | Eindeutige Badge-Nummer (B-XXXXX) |
| qr_code | TEXT | QR-Code-Inhalt |
| checked_in_at | DATETIME | Eincheck-Zeitstempel |
| checked_out_at | DATETIME | Auscheck-Zeitstempel (NULL = noch anwesend) |
| notes | TEXT | |
| status | TEXT | `active` / `completed` |
| privacy_policy_signed | INTEGER | 0 / 1 — Datenschutzerklärung unterzeichnet |
| privacy_policy_signature_path | TEXT | Dateiname der Unterschrift-PNG |

#### `preregistrations` — Vorregistrierungen
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| visitor_first_name | TEXT | |
| visitor_last_name | TEXT | |
| visitor_email | TEXT | QR-Code wird hierhin gesendet |
| visitor_company | TEXT | |
| host_id | INTEGER | FK → hosts |
| location_id | INTEGER | |
| expected_date | DATE | Erwartetes Anreisedatum |
| expected_time | TIME | Erwartete Anreisezeit |
| purpose | TEXT | |
| qr_code | TEXT UNIQUE | |
| status | TEXT | `pending` / `checked_in` / `expired` / `cancelled` |
| notes | TEXT | |
| group_id | TEXT | Gruppen-ID bei Sammelregistrierung (optional) |

#### `visit_purposes` — Besuchszwecke (konfigurierbar)
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT UNIQUE | z.B. "Besprechung", "Lieferung" |
| sort_order | INTEGER | Reihenfolge |
| active | INTEGER | |

Standardwerte: Besprechung, Lieferung, Interview, Wartung, Sonstiges

#### `system_settings` — Systemkonfiguration (key/value)
| Key | Standardwert | Beschreibung |
|---|---|---|
| `gdpr_retention_days` | `365` | Tage bis zur Anonymisierung |
| `visitor_email_confirmation` | `true` | Check-in-Bestätigung an Besucher |
| `printer_enabled` | `false` | Etikettendrucker aktiv |
| `printer_ip` | `` | IP-Adresse des Brother QL-820NWB |
| `printer_port` | `9100` | TCP-Port des Druckers |
| `smtp_security` | `starttls` | SMTP-Verschlüsselung: `starttls` / `ssl` / `none` |
| `privacy_policy_text` | *(Platzhaltertext)* | Datenschutztext — im Kiosk angezeigt |
| `privacy_policy_enabled` | `true` | Datenschutz-Unterschrift im Kiosk aktivieren |
| `auto_checkout_enabled` | `true` | Auto-Checkout täglich aktivieren |
| `auto_checkout_time` | `19:00` | Uhrzeit des Auto-Checkouts (HH:MM) |

#### `visit_documents` — Hochgeladene Dokumente & Unterschriften
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| visit_id | INTEGER | FK → visits |
| filename | TEXT | Gespeicherter Dateiname (zufällig generiert) |
| original_name | TEXT | Originaler Dateiname |
| document_type | TEXT | `nda` / `sonstiges` |
| signature_path | TEXT | PNG-Dateiname in `/uploads/signatures/` |
| signed_at | DATETIME | |

---

## 6. Backend API

**Base URL:** `https://visitor.luwilab.work/api`  
**Auth:** `Authorization: Bearer <JWT-Token>` (außer explizit als öffentlich markiert)  
**Admin-Token:** 8 Stunden Gültigkeit  
**Host-Token:** 12 Stunden Gültigkeit (`{ type: 'host', hostId }`)

### Authentifizierung (Admin)

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| POST | `/auth/login` | Nein | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | Ja | Aktueller Benutzer |
| PUT | `/auth/change-password` | Ja | Passwort ändern |

### Dashboard

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/dashboard/stats` | Kennzahlen: heute, aktuell, Woche, Monat |
| GET | `/dashboard/recent` | Letzte 10 Besuche |
| GET | `/dashboard/chart` | Besuche pro Tag, letzte 14 Tage |

### Besucher

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/visitors` | Ja | Liste (?search=, ?status=) — standortgefiltert |
| POST | `/visitors` | **Nein** | Neu erstellen + einchecken (Kiosk-kompatibel) |
| GET | `/visitors/active` | Ja | Aktuell anwesend |
| GET | `/visitors/:id` | Ja | Details + Besuchshistorie |
| PUT | `/visitors/:id` | Ja | Stammdaten bearbeiten |
| DELETE | `/visitors/:id` | Ja (superadmin) | Dauerhaft löschen (inkl. Besuche + Dokumente) |
| POST | `/visitors/:id/checkin` | Ja | Erneut einchecken |
| GET | `/visitors/:id/badge/:visitId` | Ja | Badge als PDF |
| POST | `/visitors/:id/print-badge/:visitId` | Ja | Badge an Etikettendrucker senden |
| POST | `/visitors/printer-test` | Ja | TCP-Verbindung zum Drucker testen |

### Besuche (Check-out)

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| POST | `/visits/:id/checkout` | Ja | Besucher auschecken |
| POST | `/visits/checkout-by-qr` | **Nein** | Kiosk: Auschecken per Badge-QR |
| POST | `/visits/checkout-by-abat-id` | **Nein** | Kiosk: Auschecken per abat-ID |
| GET | `/visits/search-active` | **Nein** | Kiosk: Aktive Besuche nach Name suchen |

### Vorregistrierungen

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/preregistrations` | Ja | Liste (?date_filter=, ?status=) |
| POST | `/preregistrations` | Ja | Einzelne Vorregistrierung + QR per E-Mail |
| POST | `/preregistrations/batch` | Ja | Gruppenregistrierung (mehrere Gäste) |
| PUT | `/preregistrations/:id` | Ja | Bearbeiten |
| DELETE | `/preregistrations/:id` | Ja | Superadmin: dauerhaft löschen; andere: stornieren |
| GET | `/preregistrations/qr-image/:qrcode` | **Nein** | QR-Code als PNG-Bild |
| GET | `/preregistrations/qr/:qrcode` | **Nein** | Kiosk: Infos via QR-Code |
| POST | `/preregistrations/qr/:qrcode/checkin` | **Nein** | Kiosk: Einchecken via QR |
| GET | `/preregistrations/by-abat-id/:abatId` | **Nein** | Kiosk: Vorregistrierung per abat-ID |

### Gastgeber

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/hosts` | **Nein** | Liste (öffentlich für Kiosk, ohne password_hash) |
| GET | `/hosts/:id` | Ja | Einzelner Gastgeber |
| POST | `/hosts` | Ja | Erstellen |
| PUT | `/hosts/:id` | Ja | Bearbeiten |
| PUT | `/hosts/:id/set-password` | Ja (superadmin) | Portal-Passwort setzen (min. 8 Zeichen) |
| DELETE | `/hosts/:id` | Ja | Soft-Delete |

### Host-Portal

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| POST | `/host-portal/login` | Nein | `{ email, password }` → `{ token, host }` |
| GET | `/host-portal/me` | Host-Token | Eigene Host-Daten |
| GET | `/host-portal/visitors` | Host-Token | Aktive + heutige abgeschlossene Besuche |
| GET | `/host-portal/preregistrations` | Host-Token | Kommende Vorregistrierungen |
| POST | `/host-portal/preregistrations` | Host-Token | Vorregistrierung erstellen + QR per E-Mail |

### Audit-Log (nur superadmin)

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/audit-log/available-dates` | Liste aller Tage mit vorhandenen Log-Dateien |
| GET | `/audit-log/download?date=YYYY-MM-DD` | Tagesprotokoll als `.log`-Datei herunterladen |
| GET | `/audit-log/compliance-report?from=&to=` | Compliance-Bericht als CSV (Besuche + Ereignisse) |

### Standorte

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/locations` | Alle aktiven Standorte |
| POST | `/locations` | Erstellen |
| PUT | `/locations/:id` | Bearbeiten |
| DELETE | `/locations/:id` | Deaktivieren |

### Besuchszwecke

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/visit-purposes` | **Nein** | Alle aktiven Zwecke (für Kiosk) |
| POST | `/visit-purposes` | Ja | Erstellen |
| PUT | `/visit-purposes/:id` | Ja | Bearbeiten |
| DELETE | `/visit-purposes/:id` | Ja | Löschen |

### Benutzer (nur superadmin)

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/users` | Alle Benutzer inkl. `location_ids[]` |
| POST | `/users` | Erstellen (mit `location_ids[]`) |
| PUT | `/users/:id` | Bearbeiten (mit `location_ids[]`) |
| POST | `/users/:id/reset-password` | Passwort zurücksetzen |
| DELETE | `/users/:id` | Deaktivieren (Soft-Delete) |

### Einstellungen (admin+)

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/settings/system` | Ja (admin+) | Alle system_settings |
| PUT | `/settings/system` | Ja (admin+) | Einstellungen speichern |
| GET | `/settings/smtp-config` | Ja (admin+) | Aktuelle SMTP-Konfiguration (Passwort maskiert) |
| GET | `/settings/privacy-policy` | **Nein** | Datenschutztext + enabled-Flag (für Kiosk) |
| POST | `/settings/email-test` | Ja (admin+) | Test-E-Mail senden |
| POST | `/settings/gdpr/cleanup` | Ja (admin+) | GDPR-Bereinigung ausführen |

### Berichte

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/reports/daily?date=YYYY-MM-DD` | Tagesbericht |
| GET | `/reports/monthly?year=YYYY&month=MM` | Monatsbericht |
| GET | `/reports/evacuation` | Evakuierungsliste — nach Standort gruppiert |
| GET | `/reports/export?from=&to=&format=csv` | CSV-Export Besuchsdaten |

### Dokumenten-Upload & Unterschrift

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| POST | `/visits/:visitId/documents` | Nein* | Dokument hochladen (für Kiosk) |
| POST | `/documents/:docId/signature-base64` | Nein* | Unterschrift speichern (für Kiosk) |
| GET | `/visits/:visitId/documents` | Ja | Dokumente abrufen |
| GET | `/documents/:docId/download` | Ja | Dokument herunterladen |

---

## 7. Frontend & Seiten

| Route | Seite | Auth | Beschreibung |
|---|---|---|---|
| `/login` | Login | Nein | Admin-Login |
| `/host/login` | HostLogin | Nein | Gastgeber-Portal Login |
| `/host` | HostPortal | Host-Token | Gastgeber-Portal |
| `/kiosk` | KioskStart | **Nein** | Sprachschalter DE/EN, 2 Optionen |
| `/kiosk/checkin` | KioskCheckin | **Nein** | QR-Scan oder abat-ID |
| `/kiosk/checkout` | KioskCheckout | **Nein** | QR, abat-ID oder Namenssuche |
| `/kiosk/manual` | KioskManual | **Nein** | Walk-in Formular |
| `/dashboard` | Dashboard | Ja | Kennzahlen, Diagramm, Quick-Check-in |
| `/visitors` | Besucher | Ja | Tabs: Alle / Angekündigt / Aktiv / Verlassen |
| `/hosts` | Gastgeber | Ja | inkl. Portal-Passwort setzen (superadmin) |
| `/preregistrations` | Vorregistrierung | Ja | Einzel- und Gruppenregistrierung |
| `/evacuation` | Evakuierung | Ja | Nach Standort gruppiert, Drucklayout |
| `/reports` | Berichte | Ja (admin+) | Tages-/Monatsberichte, CSV-Export |
| `/settings` | Einstellungen | Ja (admin+) | Alle Konfigurations-Tabs |
| `/audit-log` | Audit-Log & Compliance | Ja (superadmin) | Protokoll-Download, Compliance-Bericht |
| `*` | NotFound | — | 404-Fehlerseite |

### Einstellungs-Tabs (Settings.jsx)

| Tab | Inhalt | Rolle |
|---|---|---|
| Standorte | CRUD Standorte | admin+ |
| Besuchszwecke | CRUD Besuchszwecke | admin+ |
| Benutzer | CRUD Benutzer + Standortzuweisung | superadmin |
| Auto-Checkout | Aktivieren/Deaktivieren + Uhrzeit einstellen | superadmin |
| Etikettendrucker | IP, Port, Aktivierung, Verbindungstest | admin+ |
| Datenschutz | GDPR Aufbewahrungsdauer, Bereinigung, E-Mail-Bestätigung | admin+ |
| E-Mail | SMTP-Konfiguration (read-only), Verschlüsselung, Test-E-Mail | admin+ |
| Passwort ändern | Eigenes Passwort ändern | alle |

### Aktionsrechte nach Rolle

| Aktion | superadmin | admin | receptionist |
|---|---|---|---|
| Besucher dauerhaft löschen | ✓ | ✗ | ✗ |
| Vorregistrierung dauerhaft löschen | ✓ | ✗ | ✗ |
| Vorregistrierung stornieren | ✓ | ✓ | ✓ |
| Gastgeber-Portal-Passwort setzen | ✓ | ✗ | ✗ |
| Audit-Log & Compliance-Bericht | ✓ | ✗ | ✗ |
| Auto-Checkout konfigurieren | ✓ | ✗ | ✗ |

---

## 8. Kiosk-System

Läuft ohne Login, ausgelegt für Tablets am Empfang. Alle Kiosk-Routen sind öffentlich.

### Startseite (`/kiosk`)

Zwei Optionen:
- **Einchecken** → `/kiosk/checkin`
- **Auschecken** → `/kiosk/checkout`

### Mehrsprachigkeit

Der Kiosk unterstützt Deutsch und Englisch. Die Sprache wird per `localStorage` (Key: `kiosk_lang`) gespeichert. Umschalter erscheint im Header der Kiosk-Startseite.

### Check-in Flow (`/kiosk/checkin`) — Mehrstufig

```
scan → confirm → privacy → success
               ↘ (wenn Datenschutz deaktiviert) → success
```

| Stufe | Inhalt |
|---|---|
| **scan** | QR-Code per Kamera scannen **oder** abat-ID eingeben (`ABAT-` vorausgefüllt, 8 Ziffern) |
| **confirm** | Vorregistrierungsdaten anzeigen und ggf. korrigieren (Vorname, Nachname, Unternehmen) |
| **privacy** | Scrollbarer Datenschutztext + Unterschriftsfeld; Button erst nach Unterschrift aktiv |
| **success** | abat-ID groß angezeigt, Gastgeber, Badge-Nr.; automatischer Rücksprung nach 6 Sekunden |

### Check-out (`/kiosk/checkout`) — 3 Tabs

| Tab | Methode |
|---|---|
| QR-Code scannen | Kamera scannt Badge-QR → `POST /visits/checkout-by-qr` |
| abat-ID | `ABAT-` Präfix vorausgefüllt, 8 Ziffern → `POST /visits/checkout-by-abat-id` |
| Name suchen | Freitext-Suche → `GET /visits/search-active` → Auswahl → Check-out |

### Walk-in (`/kiosk/manual`)

Formularfelder: Vorname *, Nachname *, Gastgeber *, Unternehmen, Besuchszweck, Notizen.

### QR-Scanner — Technische Besonderheit

`QRScanner.jsx` verwendet `html5-qrcode`. Ein `stoppedRef`-Flag (`useRef(false)`) verhindert Doppel-`stop()`-Aufrufe, die sonst zu einem weißen Bildschirm führen können.

---

## 9. abat-ID

Jeder Besucher erhält eine permanente, einzigartige Kennung im Format `ABAT-########` (8 zufällige Ziffern).

| Eigenschaft | Wert |
|---|---|
| Format | `ABAT-00000000` bis `ABAT-99999999` |
| Speicherort | `visitors.abat_id` (UNIQUE INDEX) |
| Vergabe | Bei Vorregistrierung (wenn E-Mail angegeben) oder beim ersten Check-in |
| Beständigkeit | Permanent — bleibt bei allen späteren Besuchen gleich |

**Einsatz:**
- In der Vorregistrierungs-E-Mail als Fallback zum QR-Code
- Am Kiosk-Check-in und Check-out (Tab "abat-ID")
- Im Admin-Dashboard und Besucherliste als eigene Spalte

---

## 10. Dokumenten-Upload & Unterschrift

Ablauf: Besucher einchecken → Dokument hochladen (optional) → Unterschrift leisten (optional).

- Formate: PDF/DOC/DOCX, max. 20 MB
- Unterschrift als PNG (Canvas, Touch/Maus)
- Speicherorte: `/backend/uploads/documents/` und `/backend/uploads/signatures/`
- Beide Verzeichnisse sind **nur mit Admin-Token** über die API abrufbar

---

## 11. Zugangsdaten & Benutzerrollen

> Zugangsdaten werden separat verwaltet und nicht in der Dokumentation hinterlegt.

### Rollen & Berechtigungen

| Berechtigung | superadmin | admin | receptionist | host |
|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✗ |
| Besucher verwalten | ✓ | ✓ | ✓ (standortgef.) | ✗ |
| Besucher löschen | ✓ | ✗ | ✗ | ✗ |
| Gastgeber verwalten | ✓ | ✓ | ✓ | ✗ |
| Vorregistrierungen | ✓ | ✓ | ✓ | ✓ (nur eigene) |
| Evakuierungsliste | ✓ | ✓ | ✓ (standortgef.) | ✗ |
| Berichte | ✓ | ✓ | ✗ | ✗ |
| Einstellungen | ✓ | ✓ | ✗ | ✗ |
| Benutzer verwalten | ✓ | ✗ | ✗ | ✗ |
| Auto-Checkout konfigurieren | ✓ | ✗ | ✗ | ✗ |
| Audit-Log & Compliance | ✓ | ✗ | ✗ | ✗ |
| Host-Portal | ✗ | ✗ | ✗ | ✓ |

### Host-Accounts

Gastgeber-Accounts werden in der `hosts`-Tabelle verwaltet. Ein Portal-Passwort wird vom Superadmin unter **Gastgeber → Schlüssel-Icon** gesetzt (min. 8 Zeichen). Das Login erfolgt unter `/host/login` mit der E-Mail-Adresse des Gastgebers.

---

## 12. Standortbasierte Zugriffskontrolle

Benutzer können auf bestimmte Standorte beschränkt werden.

1. In **Einstellungen → Benutzer** werden Standorte zugewiesen
2. Zuordnung wird in `user_locations` gespeichert
3. Auth-Middleware lädt `location_ids[]` bei jedem Request
4. Gefilterte Endpunkte: `GET /visitors`, `GET /visitors/active`, `GET /reports/evacuation`

| Situation | Verhalten |
|---|---|
| superadmin / admin | Immer alle Standorte |
| Receptionist mit 0 Standorten | Alle Standorte sichtbar |
| Receptionist mit 1+ Standorten | Nur zugewiesene Standorte |

---

## 13. Badge-Drucker (Brother QL-820NWB)

| Eigenschaft | Wert |
|---|---|
| Modell | Brother QL-820NWB |
| Verbindung | Netzwerk (RAW TCP) |
| Port | 9100 (konfigurierbar) |
| Etikett | DK-11202 (62 × 100 mm) |
| Auflösung | 300 dpi → 696 × 1109 Pixel |

**Konfiguration:** Einstellungen → Etikettendrucker → IP, Port, Aktivierung, Verbindungstest.

**Label-Inhalt:** abat-Logo, Besuchername, Unternehmen, Gastgeber, Badge-Nr., Datum & Uhrzeit.

**PDF-Badge (A6 Landscape):** Alternativ als PDF downloadbar — blauer Header, QR-Code, Besuchsinfos.

---

## 14. E-Mail-System

### Ausgehende E-Mails

| Auslöser | Empfänger | Beschreibung |
|---|---|---|
| Vorregistrierung erstellt | Besucher | QR-Code (CID-Anhang), abat-ID, Besuchsdetails |
| Check-in | Gastgeber | Benachrichtigung: Besucher eingetroffen |
| Check-in (`visitor_email_confirmation = true`) | Besucher | Bestätigung mit Datum, Zeit, Gastgeber, Badge-Nr. |

### SMTP-Konfiguration

In `.env` gespeichert (Neustart bei Änderung nötig). Verschlüsselung (`smtp_security`) in `system_settings` ohne Neustart änderbar.

| Option | Port | Verwendung |
|---|---|---|
| **STARTTLS** | 587 | Standard — Gmail, Office 365 |
| **SSL / TLS** | 465 | Ältere Server / manche Hoster |
| **Keine** | 25 | Interne Mailserver ohne Zertifikat |

**Fallback:** Ohne SMTP-Konfiguration werden E-Mails nur in der Konsole geloggt — kein Absturz.

---

## 15. Auto-Checkout

Alle Besucher, die sich bis zur konfigurierten Uhrzeit nicht ausgecheckt haben, werden automatisch ausgecheckt.

### Funktionsweise

- Implementiert via nativem `setTimeout` in `backend/src/services/auto-checkout.js`
- Kein externer Cron-Job oder externes Paket erforderlich
- Plant sich nach jedem Lauf automatisch für den nächsten Tag neu
- Beim Serverstart wird der nächste Lauf berechnet und geplant

### Konfiguration

**Einstellungen → Auto-Checkout (superadmin):**

| Einstellung | Key in `system_settings` | Beschreibung |
|---|---|---|
| Aktiviert | `auto_checkout_enabled` | Ein/Aus |
| Uhrzeit | `auto_checkout_time` | Format `HH:MM`, Standard `19:00` |

### Audit-Log-Eintrag

Bei jedem Auto-Checkout wird ein `AUTO_CHECKOUT`-Eintrag im Audit-Log geschrieben mit Anzahl der ausgecheckten Besucher.

---

## 16. Host-Portal

Gastgeber erhalten Zugang zu einem separaten Portal unter `/host/login`, ohne dass sie Admin-Zugang benötigen.

### Funktionen

| Funktion | Beschreibung |
|---|---|
| Meine Besucher | Aktuell anwesende und heute ausgecheckte Besucher in Echtzeit (30 s Refresh) |
| Vorregistrierung erstellen | Neuen Besuch vorregistrieren, QR-Code wird per E-Mail verschickt |

### Technische Umsetzung

- **Separates JWT:** `{ type: 'host', hostId }` — verhindert Privilege-Escalation zwischen Admin- und Host-Token
- **Token-Gültigkeit:** 12 Stunden
- **Gespeichert:** `host_token` in `localStorage`
- **Middleware:** `authenticateHost()` in `routes/host-portal.js` prüft `type === 'host'`

### Portal-Passwort einrichten

1. Superadmin öffnet **Gastgeber** im Admin-Panel
2. Klick auf das Schlüssel-Icon in der Zeile des Gastgebers
3. Passwort eingeben (min. 8 Zeichen) und bestätigen
4. Gastgeber kann sich nun unter `/host/login` mit E-Mail + Passwort anmelden

---

## 17. Audit-Log & Compliance

### Protokollierung

Alle sicherheitsrelevanten Ereignisse werden automatisch protokolliert:

| Ereignis | Wann |
|---|---|
| `LOGIN` | Erfolgreicher Admin- oder Host-Login |
| `LOGIN_FAILED` | Fehlgeschlagener Login-Versuch |
| `CHECKIN` | Besucher eingecheckt |
| `CHECKOUT` | Besucher ausgecheckt |
| `AUTO_CHECKOUT` | Automatischer Checkout um 19:00 |
| `VORREGISTRIERUNG` | Vorregistrierung erstellt |
| `VORREGISTRIERUNG_GELÖSCHT` | Vorregistrierung dauerhaft gelöscht |
| `VISITOR_GELÖSCHT` | Besucher-Datensatz dauerhaft gelöscht |

### Dateiformat

- **Speicherort:** `/opt/visitor-mgmt/logs/audit-YYYY-MM-DD.log`
- **Format:** JSON-Lines (eine JSON-Zeile pro Ereignis)
- **Beispiel:** `{"ts":"2026-06-16T10:23:45.123Z","action":"LOGIN","actor":"admin@abat.de","detail":"Admin-Login erfolgreich"}`
- **Aufbewahrung:** 90 Tage — ältere Dateien werden automatisch beim Serverstart gelöscht

### Zugang im Admin-Panel

Nur für Superadmin unter `/audit-log`:

- **Tagesprotokoll herunterladen:** Liste aller verfügbaren Tage, Download als `.log`-Rohdatei
- **Compliance-Bericht:** CSV-Download für einen Zeitraum mit:
  - Abschnitt 1: Alle Besuche (abat-ID, Name, Firma, Gastgeber, Zeiten, Status)
  - Abschnitt 2: Alle Audit-Log-Ereignisse
  - Format: UTF-8 CSV mit BOM (direkt in Excel öffenbar)

---

## 18. Sicherheit

### HTTP-Sicherheitsheader (helmet)

| Header | Wert |
|---|---|
| `X-Frame-Options` | `SAMEORIGIN` — verhindert Clickjacking |
| `X-Content-Type-Options` | `nosniff` — verhindert MIME-Sniffing |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Cross-Origin-Resource-Policy` | `same-origin` |

### Brute-Force-Schutz

Rate-Limiting auf Login-Endpunkten: max. **20 Versuche pro 15 Minuten** pro IP-Adresse.  
Betrifft: `POST /auth/login` und `POST /host-portal/login`.

### Dateigeschützte Uploads

| Pfad | Zugriffsschutz |
|---|---|
| `/uploads/photos/` | Öffentlich (Admin-UI benötigt direkten Zugriff) |
| `/uploads/documents/` | Erfordert Admin-JWT |
| `/uploads/signatures/` | Erfordert Admin-JWT |

### Passwörter

- bcrypt mit **Kostenfaktor 12** (alle neuen Hashes)
- Mindestlänge: **8 Zeichen** für alle Konten
- `password_hash` wird **nie** über die API zurückgegeben

### JWT-Secret

- 128-Byte kryptografisch zufälliger Secret (generiert mit `crypto.randomBytes(64).toString('hex')`)
- Gespeichert in `/opt/visitor-mgmt/backend/.env`
- Bei Änderung des Secrets werden alle aktiven Sessions invalidiert

### Datenbankabfragen

Alle Datenbankabfragen verwenden parametrisierte Prepared Statements (better-sqlite3) — keine SQL-Injection möglich.

---

## 19. GDPR & Datenschutz

### Datenschutzerklärung-Unterschrift am Kiosk

Konfigurierbar unter **Einstellungen → Datenschutz:**

| Einstellung | Beschreibung |
|---|---|
| `privacy_policy_enabled` | Unterschrift am Kiosk erforderlich |
| `privacy_policy_text` | Vollständiger Datenschutztext (mehrzeilig, konfigurierbar) |

Ablauf: Besucher liest Text → unterschreibt mit Finger/Stift → PNG wird gespeichert → `privacy_policy_signed = 1`

### Automatische Anonymisierung

Besucher, deren letzter Check-in älter als N Tage und die keinen aktiven Visit haben:

```
first_name  → '[GELÖSCHT]'
last_name   → '[GELÖSCHT]'
email       → NULL
phone       → NULL
company     → NULL
```

Visit-Statistiken (Datum, Uhrzeit, Standort, Badge-Nr.) bleiben erhalten.

**Manuelle Auslösung:** Einstellungen → Datenschutz → "Jetzt bereinigen"

### Superadmin-Löschrechte

Superadmins können Besucher und Vorregistrierungen dauerhaft aus der Datenbank löschen (nicht nur anonymisieren). Jede Löschung wird im Audit-Log protokolliert.

---

## 20. Infrastruktur & Deployment

### Systemd-Service

**Service-Datei:** `/etc/systemd/system/visitor-mgmt.service`

```ini
[Unit]
Description=Visitor Management System Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/visitor-mgmt/backend
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/visitor-mgmt/backend/.env

[Install]
WantedBy=multi-user.target
```

### Nginx

- HTTP (80) → HTTPS-Redirect
- HTTPS (443) mit Cloudflare Origin Certificate
- `/api/*` → Proxy zu `http://127.0.0.1:3001`
- `/` → React SPA aus `/opt/visitor-mgmt/frontend/dist`
- Gzip-Komprimierung, 1 Jahr Cache für statische Assets

---

## 21. SSL & Cloudflare

| Eigenschaft | Wert |
|---|---|
| Typ | Cloudflare Origin Certificate |
| Gültig bis | 11. Juni 2041 |
| Zertifikat | `/etc/ssl/visitor-mgmt/cert.pem` |
| Private Key | `/etc/ssl/visitor-mgmt/key.pem` |

Cloudflare muss auf **Full (Strict)** SSL gestellt sein.

---

## 22. Umgebungsvariablen (.env)

**Pfad:** `/opt/visitor-mgmt/backend/.env`

```env
# Pflicht
JWT_SECRET=<128-Byte zufälliger String>  # node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
APP_URL=https://visitor.luwilab.work      # Öffentliche URL — kein abschließender Slash!

# Initialer Admin-Account (einmalig beim ersten Start, solange DB leer ist)
ADMIN_EMAIL=admin@firma.de
ADMIN_PASSWORD=<sicheres-passwort>
ADMIN_NAME=Administrator

PORT=3001
DB_PATH=./data/visitors.db

# E-Mail (optional — ohne SMTP werden Mails nur geloggt)
SMTP_HOST=<smtp-server>
SMTP_PORT=587
SMTP_USER=<smtp-benutzer>
SMTP_PASS=<smtp-passwort>
SMTP_SECURITY=starttls
FROM_EMAIL=<absender@firma.de>
COMPANY_NAME=<firmenname>
```

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `JWT_SECRET` | **Ja** | Kryptografisch zufälliger 128-Byte-String |
| `APP_URL` | **Ja** | Öffentliche URL — wird für CORS verwendet |
| `ADMIN_EMAIL` | Ja (Erststart) | E-Mail des initialen Admins |
| `ADMIN_PASSWORD` | Ja (Erststart) | Passwort des initialen Admins |
| `PORT` | Nein | Backend-Port (Standard: 3001) |
| `DB_PATH` | Nein | SQLite-Pfad (Standard: `./data/visitors.db`) |
| `SMTP_HOST` | Nein | SMTP-Server |
| `SMTP_USER` | Nein | SMTP-Benutzername |
| `SMTP_PASS` | Nein | SMTP-Passwort |
| `SMTP_SECURITY` | Nein | `starttls` / `ssl` / `none` (DB-Wert hat Vorrang) |
| `FROM_EMAIL` | Nein | Absender-Adresse |
| `COMPANY_NAME` | Nein | Firmenname (in Mails und Badge) |

---

## 23. Wichtige Befehle

### Service-Verwaltung

```bash
systemctl status visitor-mgmt
systemctl restart visitor-mgmt      # nach .env-Änderungen
systemctl reload nginx
journalctl -u visitor-mgmt -f       # Live-Logs
journalctl -u visitor-mgmt -n 100
```

### Frontend neu bauen

```bash
cd /opt/visitor-mgmt/frontend
npm run build
# Kein Nginx-Reload nötig — Nginx liest dist/ direkt
```

### Datenbank-Backup

```bash
sqlite3 /opt/visitor-mgmt/backend/data/visitors.db \
  ".backup /root/backup-$(date +%Y%m%d).db"
```

### Audit-Logs prüfen

```bash
ls /opt/visitor-mgmt/logs/
cat /opt/visitor-mgmt/logs/audit-$(date +%Y-%m-%d).log
```

### JWT-Secret neu generieren

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Wert in /opt/visitor-mgmt/backend/.env eintragen
systemctl restart visitor-mgmt
# Achtung: Alle aktiven Sessions werden invalidiert
```

### API testen

```bash
# Health Check
curl http://localhost:3001/api/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@abat.de","password":"<passwort>"}'
```

---

## 24. Fehlerbehebung

### Backend startet nicht

```bash
journalctl -u visitor-mgmt -n 50
cd /opt/visitor-mgmt/backend && node src/index.js  # detaillierter Fehler
```

Häufige Ursachen: `.env` fehlt, Port 3001 belegt (`ss -tlnp | grep 3001`), fehlende Pakete (`npm install`).

### Weißer Bildschirm / Seite lädt nicht

```bash
cd /opt/visitor-mgmt/frontend && npm run build
# Prüfen ob Build-Fehler aufgetreten sind
```

Anschließend Hard-Reload im Browser: `Ctrl+Shift+R`.

### Etikettendrucker antwortet nicht

1. `ping <Drucker-IP>`
2. `nc -zv <Drucker-IP> 9100`
3. "Verbindung testen" in Einstellungen → Etikettendrucker
4. Drucker-IP und Port im Admin prüfen

### E-Mail wird nicht gesendet

1. SMTP-Test unter **Einstellungen → E-Mail → Test-E-Mail senden**
2. `.env` prüfen: `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`
3. Verschlüsselung prüfen (STARTTLS ↔ SSL je nach Provider)
4. Bei Gmail: App-Passwort verwenden (kein normales Passwort)
5. Nach `.env`-Änderung: `systemctl restart visitor-mgmt`

### Login schlägt fehl

```bash
sqlite3 /opt/visitor-mgmt/backend/data/visitors.db \
  "SELECT id, name, email, role, active FROM users;"
```

Nach Änderung des JWT-Secrets müssen sich alle Nutzer neu einloggen.

### Benutzer sieht falsche Standortdaten

Standortzuweisungen in **Einstellungen → Benutzer** prüfen. Kein Eintrag = alle Standorte sichtbar.

### SSL-Fehler

Cloudflare SSL-Modus muss **Full (Strict)** sein.

### Auto-Checkout funktioniert nicht

```bash
journalctl -u visitor-mgmt | grep auto-checkout
```

Prüfen ob `auto_checkout_enabled = true` in den Einstellungen und ob die Uhrzeit korrekt als `HH:MM` eingetragen ist.

---

## Dateipfade auf einen Blick

| Was | Pfad |
|---|---|
| Projekt-Root | `/opt/visitor-mgmt/` |
| Backend-App | `/opt/visitor-mgmt/backend/src/index.js` |
| Datenbank | `/opt/visitor-mgmt/backend/data/visitors.db` |
| Umgebungsvariablen | `/opt/visitor-mgmt/backend/.env` |
| Uploads | `/opt/visitor-mgmt/backend/uploads/` |
| Audit-Logs | `/opt/visitor-mgmt/logs/` |
| Frontend-Build | `/opt/visitor-mgmt/frontend/dist/` |
| Nginx-Konfiguration | `/etc/nginx/sites-available/visitor.luwilab.work` |
| SSL-Zertifikat | `/etc/ssl/visitor-mgmt/cert.pem` |
| Systemd-Service | `/etc/systemd/system/visitor-mgmt.service` |
| Dokumentation | `/opt/visitor-mgmt/docs/` |
| Assets (Logos, Font) | `/opt/visitor-mgmt/assets/` |
