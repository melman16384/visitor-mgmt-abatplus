# Besucherverwaltung abat+ — Projektdokumentation

> Erstellt: 15. Juni 2026 | Zuletzt aktualisiert: 23. Juni 2026  
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
12. [Einstellungen](#12-einstellungen)
13. [Infrastruktur & Deployment](#13-infrastruktur--deployment)
14. [Umgebungsvariablen (.env)](#14-umgebungsvariablen-env)
15. [Wichtige Befehle](#15-wichtige-befehle)
16. [Fehlerbehebung](#16-fehlerbehebung)

---

## 1. Projektübersicht

Schlanke, mitarbeitergesteuerte Besucherverwaltung, entwickelt ausschließlich für den internen Einsatz bei abat+. Mitarbeiter melden sich mit ihrem Microsoft-Firmenkonto an und checken Besucher direkt vom eigenen Desktop oder Handy ein — ohne Empfangskiosk, ohne Selbstbedienung durch den Besucher.

### Designprinzipien

- **Kein Kiosk, keine Selbstbedienung** — Besucher werden immer durch einen Mitarbeiter erfasst
- **Nachvollziehbarkeit** — jeder Besuch speichert, wer wann eingecheckt hat (`Erfasst am … durch …`)
- **Minimaler Aufwand** — zwei Klicks zum Einchecken, kein zusätzliches Passwort (Microsoft SSO)
- **Abgeschlossene Instanz** — läuft nur auf dem abat+-Server, keine externe Abhängigkeit im Betrieb

### Features im Überblick

| Feature | Beschreibung |
|---|---|
| Check-in | Mitarbeiter checkt Besucher über ein einfaches Formular ein |
| Check-out | Manuell per Klick oder automatisch zur konfigurierten Uhrzeit |
| „Erfasst durch" | Speichert Name + Zeitstempel des einchecke­nden Mitarbeiters |
| Vorregistrierungen | Besucher vorab eintragen; bei Ankunft per Klick einchecken |
| Microsoft SSO | Login mit Firmenkonto; User + Mitarbeiter-Eintrag automatisch angelegt |
| Datenschutz-Checkbox | Einfache Bestätigung statt Unterschriftspad |
| Mobil-optimiert | Vollständig responsiv — Handy + Desktop gleichwertig |
| Auto-Checkout | Täglich zur konfigurierbaren Uhrzeit (Standard: 20:00), abschaltbar |
| Zwei Rollen | `admin` (Vollzugriff) / `user` (einchecken + lesen) |

### Bewusst nicht enthalten

Folgende Features wurden gegenüber der Ausgangsversion bewusst entfernt, da sie für den abat+-Betrieb nicht benötigt werden:

Kiosk-Modus · Host-Portal · QR-Scanner · Badge-/Etikettendrucker · E-Mail-Benachrichtigungen · Mehrsprachigkeit (EN/LT/RU) · Zwei-Faktor-Authentifizierung · GDPR-Cleanup-Automatismus · Evakuierungsliste · Berichte/Exports · Audit-Log UI · abat-ID · Dokumenten-Upload · Unterschriftspad · Standortbasierte Zugriffskontrolle · Gruppenregistrierungen

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
                              └── SQLite-Datenbank
                                  (better-sqlite3, synchron)
```

**Technologie-Stack:**

| Schicht | Technologie | Version |
|---|---|---|
| Frontend | React | 19 |
| Build-Tool | Vite | 8 |
| CSS-Framework | Tailwind CSS | 4 |
| Backend | Express.js | 5 |
| Datenbank | SQLite via better-sqlite3 | — |
| Authentifizierung | JWT (8h) + MSAL (Microsoft SSO) | — |
| Prozessmanager | pm2 | — |
| Webserver | Nginx | — |
| CDN/Proxy | Cloudflare | — |

**Warum SQLite?** Die App läuft als einzelne Instanz auf einem Server. SQLite benötigt keinen separaten Datenbankdienst, ist wartungsarm und für die erwartete Last (< 500 Besucher/Tag) vollständig ausreichend. better-sqlite3 arbeitet synchron — kein Callback-Chaos, kein Connection-Pool.

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
│   │   │   ├── visitors.js          # Besucher-CRUD, Check-in (POST /)
│   │   │   ├── visits.js            # Check-out (POST /:id/checkout)
│   │   │   ├── hosts.js             # Mitarbeiter-CRUD
│   │   │   ├── preregistrations.js  # Vorregistrierungen + POST /:id/checkin
│   │   │   ├── users.js             # Benutzerverwaltung (admin only)
│   │   │   ├── settings.js          # Auto-Checkout-Einstellungen
│   │   │   └── dashboard.js         # Statistiken + letzte Aktivitäten
│   │   ├── services/
│   │   │   ├── auto-checkout.js     # Täglicher Auto-Checkout per setTimeout
│   │   │   └── audit-log.js         # Dateibasiertes Audit-Log (optional)
│   │   └── index.js                 # App-Einstieg, Middleware, Route-Mounting
│   ├── data/
│   │   └── visitors.db              # SQLite-Datenbank (nicht in Git)
│   ├── .env                         # Secrets — nicht in Git, nicht committen!
│   ├── .env.example                 # Vorlage ohne echte Werte
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx            # Anmeldeseite (Microsoft-Button + lokaler Fallback)
│   │   │   ├── AuthCallback.jsx     # Verarbeitet OAuth-Redirect + speichert JWT
│   │   │   ├── Dashboard.jsx        # Übersicht, Statistiken, Check-in-Button
│   │   │   ├── Visitors.jsx         # Besucherliste mit Tabs + mobiler Kartenansicht
│   │   │   ├── Hosts.jsx            # Mitarbeiterliste
│   │   │   ├── PreRegistration.jsx  # Vorregistrierungen verwalten + einchecken
│   │   │   └── Settings.jsx         # Auto-Checkout, Passwort, Benutzerverwaltung
│   │   ├── components/
│   │   │   ├── Layout.jsx           # Shell mit Header, Toast-System
│   │   │   ├── Sidebar.jsx          # Navigation (mobile Burger + Desktop kollabierbar)
│   │   │   ├── VisitorCheckinForm.jsx # Check-in-Modal mit Formular
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

**Datei:** `/opt/visitor-mgmt-abatplus/backend/data/visitors.db`  
**Engine:** SQLite 3 via better-sqlite3  
**Initialisierung:** Beim ersten Start von `index.js` wird das Schema automatisch angelegt. Neue Spalten werden per `ALTER TABLE … ADD COLUMN IF NOT EXISTS` idempotent hinzugefügt — kein manuelles Migrations-Skript nötig.

### Tabellen

#### `users` — Systembenutzer (Mitarbeiter mit Login)
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | Auto-Increment |
| name | TEXT NOT NULL | Anzeigename |
| email | TEXT UNIQUE | Login-E-Mail (Kleinbuchstaben) |
| password_hash | TEXT | bcrypt-Hash; leer bei reinen SSO-Nutzern |
| role | TEXT | `admin` oder `user` |
| active | INTEGER | 1 = aktiv, 0 = deaktiviert |
| created_at | TEXT | ISO 8601 Timestamp |

#### `visitors` — Besucherstammdaten
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| first_name | TEXT NOT NULL | |
| last_name | TEXT NOT NULL | |
| company | TEXT | Unternehmen (optional) |
| created_at | TEXT | Wann erstmals im System angelegt |

#### `visits` — Einzelne Besuche (ein Besucher kann mehrfach kommen)
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| visitor_id | INTEGER FK | → visitors.id |
| host_id | INTEGER FK | → hosts.id (Ansprechpartner) |
| checked_in_at | TEXT | Zeitstempel des Check-ins |
| checked_out_at | TEXT | Zeitstempel des Check-outs; NULL = noch anwesend |
| status | TEXT | `active` (anwesend) oder `completed` (ausgecheckt) |
| privacy_accepted | INTEGER | 1 = Datenschutz-Checkbox wurde gesetzt |
| checked_in_by | INTEGER FK | → users.id — wer hat eingecheckt |
| notes | TEXT | Freitext-Notiz |

#### `hosts` — Mitarbeiter (Ansprechpartner für Besucher)
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT NOT NULL | |
| email | TEXT | Firmenemail |
| active | INTEGER | 1 = aktiv, erscheint im Dropdown |
| created_at | TEXT | |

> Hosts werden bei Microsoft-Login automatisch angelegt. Sie können auch manuell über die Mitarbeiter-Seite gepflegt werden.

#### `preregistrations` — Vorangemeldete Besucher
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| visitor_first_name | TEXT NOT NULL | |
| visitor_last_name | TEXT NOT NULL | |
| visitor_company | TEXT | |
| host_id | INTEGER FK | → hosts.id |
| expected_date | TEXT | YYYY-MM-DD |
| expected_time | TEXT | HH:MM (optional) |
| notes | TEXT | |
| status | TEXT | `pending` → `checked_in` oder `cancelled` |
| created_by | INTEGER FK | → users.id — wer hat vorregistriert |
| created_at | TEXT | |

#### `system_settings` — Schlüssel-Wert-Konfiguration
| Key | Default | Beschreibung |
|---|---|---|
| `auto_checkout_enabled` | `1` | Auto-Checkout aktiv (1) oder deaktiviert (0) |
| `auto_checkout_time` | `20:00` | Uhrzeit im Format HH:MM |

---

## 6. Backend API

**Basis-URL:** `https://visitorplus.luwilab.work/api`

Alle Endpunkte außer `/auth/login`, `/auth/microsoft`, `/auth/microsoft/callback` und `GET /hosts` erfordern einen gültigen JWT im Header:

```
Authorization: Bearer <token>
```

Der Token wird nach Login zurückgegeben und ist 8 Stunden gültig.

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
Kein JSON — direkte Browser-Navigation.

#### `GET /auth/microsoft/callback`
Wird von Microsoft nach erfolgreicher Anmeldung aufgerufen. Tauscht den Code gegen ein Token, legt ggf. User + Host an und leitet zu `/auth-callback?token=…` weiter.

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
Gibt eine paginierte Besucherliste zurück.

**Query-Parameter:**
| Parameter | Default | Beschreibung |
|---|---|---|
| `status` | — | `active` oder `completed` — leer = alle |
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

Jeder Eintrag enthält `visit_id`, `visit_status`, `checked_in_at`, `checked_out_at`, `host_name`, `checked_in_by_name`.

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
  "privacy_accepted": true
}
```

**Pflichtfelder:** `first_name`, `last_name`, `host_id`, `privacy_accepted: true`

**Antwort (201):** Neu angelegter Visitor + Visit.

---

#### `DELETE /visitors/:id`
Löscht einen Besucher dauerhaft inkl. aller zugehörigen Visits. Nur `admin`.

---

### Visits (Check-out)

#### `POST /visits/:id/checkout`
Checkt einen aktiven Visit aus. Setzt `checked_out_at = jetzt` und `status = completed`.

**Antwort:**
```json
{ "message": "Erfolgreich ausgecheckt" }
```

**Fehler:** `404` wenn Visit nicht existiert, `400` wenn bereits ausgecheckt.

---

### Hosts (Mitarbeiter)

#### `GET /hosts`
Gibt alle aktiven Mitarbeiter zurück. Öffentlich zugänglich (kein Token nötig) — wird für das Dropdown im Check-in-Formular genutzt.

**Query:** `?search=Max` — filtert nach Name oder E-Mail.

**Antwort:**
```json
[
  { "id": 1, "name": "Max Mustermann", "email": "max@abat.de" },
  ...
]
```

#### `POST /hosts` / `PUT /hosts/:id`
Erstellt oder bearbeitet einen Mitarbeiter. Nur `admin`.

**Body:**
```json
{ "name": "Max Mustermann", "email": "max@abat.de" }
```

#### `DELETE /hosts/:id`
Soft-Delete: setzt `active = 0`. Der Mitarbeiter verschwindet aus dem Dropdown, bleibt aber in historischen Besuchen referenzierbar.

---

### Vorregistrierungen

#### `GET /preregistrations`
Gibt alle Vorregistrierungen zurück, neueste zuerst.

#### `POST /preregistrations`
Erstellt eine neue Vorregistrierung.

**Body:**
```json
{
  "visitor_first_name": "Anna",
  "visitor_last_name": "Schmidt",
  "visitor_company": "Partner GmbH",
  "host_id": 2,
  "expected_date": "2026-06-25",
  "expected_time": "10:00",
  "notes": "Bewerbungsgespräch"
}
```

#### `POST /preregistrations/:id/checkin`
Kernfunktion: Checkt einen vorangemeldeten Besucher ein. Erstellt einen echten `visit`-Eintrag, setzt `checked_in_by = req.user.id` und ändert den Status auf `checked_in`.

**Antwort:**
```json
{ "message": "Eingecheckt", "visit_id": 42 }
```

#### `DELETE /preregistrations/:id`
Admin: löscht dauerhaft. User: setzt Status auf `cancelled`.

---

### Einstellungen

#### `GET /settings`
Gibt alle Einstellungen als flaches Objekt zurück.

**Antwort:**
```json
{ "auto_checkout_enabled": "1", "auto_checkout_time": "20:00" }
```

#### `PUT /settings`
Aktualisiert Einstellungen. Nur erlaubte Keys werden akzeptiert. Nur `admin`.

**Body:**
```json
{ "auto_checkout_enabled": "0", "auto_checkout_time": "19:30" }
```

> Nach Änderung der Zeit wird der interne Scheduler beim nächsten `pm2 restart visitor-mgmt` neu initialisiert. Alternativ genügt auch ein Neustart.

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

---

## 7. Microsoft SSO

### Funktionsweise

Das System nutzt den **OAuth2 Authorization Code Flow** über Microsoft Entra ID (ehemals Azure AD):

```
1. Mitarbeiter klickt „Mit Microsoft-Konto anmelden"
2. Browser → GET /api/auth/microsoft
3. Backend generiert Microsoft-Auth-URL (via MSAL) und leitet weiter
4. Mitarbeiter meldet sich bei Microsoft an (ggf. bereits eingeloggt = automatisch)
5. Microsoft → GET /api/auth/microsoft/callback?code=…
6. Backend tauscht Code gegen Benutzerinfo (Name, E-Mail)
7. Falls User noch nicht existiert: User + Host werden automatisch angelegt
8. Backend stellt JWT aus und leitet zu /auth-callback?token=… weiter
9. Frontend speichert Token, leitet auf /dashboard weiter
```

### Automatische Account-Erstellung

Beim **ersten Login** eines Mitarbeiters:
- `users`-Eintrag wird angelegt (Rolle: `user`, kein Passwort)
- `hosts`-Eintrag wird angelegt (Name + E-Mail aus Microsoft-Profil)

Bei **weiteren Logins** desselben Accounts:
- Bestehender User wird gefunden (E-Mail-Match, case-insensitive)
- Kein neuer Eintrag — sofortiger Login

### Azure App Registration einrichten

**Azure Portal → Microsoft Entra ID → App-Registrierungen → Neue Registrierung**

| Feld | Wert |
|---|---|
| Name | `abat+ Besucherverwaltung` (oder beliebig) |
| Unterstützte Kontotypen | Nur Konten in diesem Organisationsverzeichnis |
| Umleitungs-URI (Web) | `https://visitorplus.luwilab.work/api/auth/microsoft/callback` |

Nach Erstellung folgende Werte notieren und in `.env` eintragen:

| Wert im Portal | .env-Variable |
|---|---|
| Anwendungs-ID (Client ID) | `AZURE_CLIENT_ID` |
| Verzeichnis-ID (Tenant ID) | `AZURE_TENANT_ID` |
| Clientgeheimnis (neu erstellen) | `AZURE_CLIENT_SECRET` |

**Clientgeheimnis erstellen:**  
App-Registrierung → Zertifikate & Geheimnisse → Neuer geheimer Clientschlüssel → Wert sofort kopieren (wird nur einmal angezeigt).

**API-Berechtigungen:**  
Standardmäßig sind `openid`, `profile` und `email` als delegierte Berechtigungen vorhanden. `User.Read` ggf. ergänzen. Administratorzustimmung erteilen.

Nach dem Eintragen in `.env`:
```bash
pm2 restart visitor-mgmt --update-env
```

---

## 8. Frontend & Seiten

### Routen

| Route | Seite | Zugriff |
|---|---|---|
| `/login` | Anmeldung (Microsoft-Button + lokaler Fallback) | öffentlich |
| `/auth-callback` | OAuth-Rückgabe — verarbeitet Token, leitet weiter | öffentlich |
| `/dashboard` | Statistiken, letzte Aktivitäten, Check-in-Button | alle |
| `/visitors` | Besucherliste mit Tabs und mobiler Kartenansicht | alle |
| `/preregistrations` | Vorregistrierungen anlegen + einchecken | alle |
| `/hosts` | Mitarbeiterliste (Bearbeiten/Löschen nur admin) | alle |
| `/settings` | Einstellungen (Tabs je nach Rolle) | alle |

### Navigation

**Desktop:** kollabierbare Sidebar links — per Pfeil-Button ein-/ausklappen.  
**Mobil:** Sidebar versteckt, Burger-Menü oben links öffnet Overlay.

### Login-Seite

Primär: großer **„Mit Microsoft-Konto anmelden"**-Button. Darunter ein ausklappbarer Bereich für E-Mail/Passwort-Login (Fallback für den Admin-Account).

### Dashboard

Vier Statistik-Karten:
- Aktuell anwesend
- Heute eingecheckt
- Heute ausgecheckt
- Vorregistrierungen offen

Darunter eine Liste der letzten 10 Aktivitäten mit Name, Unternehmen, Mitarbeiter und „Erfasst durch".

### Besucherliste (`/visitors`)

Drei Tabs: **Anwesend** · **Ausgecheckt** · **Alle**  
Suchfeld filtert in Echtzeit nach Name und Unternehmen.

Desktop: Tabelle mit Spalten Name, Mitarbeiter, Check-in-Zeit, Erfasst durch, Status, Aktionen.  
Mobil: Karten-Layout mit denselben Informationen und Touch-freundlichen Buttons.

„Auschecken"-Button erscheint nur bei aktiven Besuchen.

---

## 9. Check-in Ablauf

**Direkter Check-in (häufigster Fall):**

1. Mitarbeiter öffnet **https://visitorplus.luwilab.work** — meldet sich per Microsoft an (einmalig, danach meist automatisch)
2. Dashboard oder Besucher-Seite → Button **„Einchecken"**
3. Modal öffnet sich mit Formular:
   - Vorname* + Nachname*
   - Unternehmen (optional)
   - Mitarbeiter/Ansprechpartner* (Dropdown aller aktiven Hosts)
   - Notizen (optional)
   - Datenschutz-Checkbox*
4. Absenden → Backend legt `visitor` + `visit` an, setzt `checked_in_by = ID des eingeloggten Users`
5. Besucher erscheint sofort in der Liste mit **„Erfasst am [Zeit] durch [Name]"**

**Check-out:**

- Klick auf **„Auschecken"** in der Zeile → `POST /visits/:id/checkout`
- Alternativ: automatisch um 20:00 Uhr (konfigurierbar)

---

## 10. Vorregistrierungen

Für Besucher, die im Voraus angekündigt sind (z.B. Termine, Bewerbungsgespräche).

**Ablauf:**

1. Mitarbeiter öffnet **Vorregistrierungen → „Vorregistrierung"**
2. Formular ausfüllen: Name, Unternehmen (optional), Mitarbeiter, Datum, Uhrzeit (optional), Notizen
3. Eintrag erscheint im Tab **„Ausstehend"**
4. Wenn Besucher ankommt: irgendein eingeloggter Mitarbeiter klickt **„Einchecken"** bei dem Eintrag
5. Backend erstellt `visit`, setzt `checked_in_by = aktueller User`, Status → `checked_in`
6. Eintrag wandert in Tab **„Eingecheckt"**

**Wichtig:** Der Mitarbeiter der einscheckt muss nicht identisch mit dem sein, der vorregistriert hat.

**Abbrechen:** User kann eigene ausstehende Vorregistrierungen auf `cancelled` setzen. Admin kann löschen.

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

> Nach Änderung der Checkout-Zeit im UI muss das Backend neugestartet werden, damit der Scheduler die neue Zeit übernimmt: `pm2 restart visitor-mgmt`

---

## 12. Einstellungen

Erreichbar unter `/settings`. Drei Tabs abhängig von der Rolle:

### Auto-Checkout (nur admin)
- Toggle: Auto-Checkout ein- oder ausschalten
- Uhrzeit-Feld: Zeit im Format HH:MM
- Speichern → schreibt in `system_settings` Tabelle

### Passwort ändern (alle)
- Aktuelles Passwort + neues Passwort + Bestätigung
- Mindestlänge: 8 Zeichen
- Für reine SSO-Nutzer (kein Passwort gesetzt) nicht sinnvoll nutzbar

### Benutzer (nur admin)
- Tabelle aller Benutzer mit Name, E-Mail, Rolle
- Erstellen: Name, E-Mail, Passwort, Rolle
- Bearbeiten: alle Felder; Passwort leer lassen = unverändert
- Löschen: dauerhaft; eigener Account kann nicht gelöscht werden
- Rollenwechsel: `user` ↔ `admin`

**Mitarbeiterverwaltung** (Ansprechpartner für Besucher) ist eine separate Seite (`/hosts`), erreichbar über die Sidebar.

---

## 13. Infrastruktur & Deployment

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

---

## 14. Umgebungsvariablen (.env)

**Datei:** `/opt/visitor-mgmt-abatplus/backend/.env`  
**Nicht in Git** — von `.gitignore` ausgeschlossen. Vorlage unter `backend/.env.example`.

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `PORT` | Ja | Backend-Port (Standard: 3001) |
| `JWT_SECRET` | Ja | Mindestens 64 zufällige Zeichen — `openssl rand -hex 64` |
| `DB_PATH` | Ja | Absoluter Pfad zur SQLite-DB — nie relativ! |
| `APP_URL` | Ja | Öffentliche URL der App inkl. Schema, ohne Slash |
| `AZURE_CLIENT_ID` | SSO | Client-ID der Azure App Registration |
| `AZURE_TENANT_ID` | SSO | Tenant-ID des Entra ID-Verzeichnisses |
| `AZURE_CLIENT_SECRET` | SSO | Clientgeheimnis — läuft ab, muss erneuert werden! |
| `ADMIN_EMAIL` | Optional | Initialer Admin (nur beim allerersten Start wirksam) |
| `ADMIN_PASSWORD` | Optional | Initiales Admin-Passwort |

> **JWT_SECRET:** Niemals leer lassen, niemals in Git einchecken. Bei Änderung werden alle bestehenden Tokens ungültig — alle Nutzer müssen sich neu anmelden.

> **DB_PATH absolut:** Ein relativer Pfad führt dazu, dass je nach Startverzeichnis eine andere DB geöffnet wird. Bei `pm2` ist das Arbeitsverzeichnis gesetzt, aber bei manuellen Starts kann es abweichen.

> **AZURE_CLIENT_SECRET Ablauf:** Clientgeheimnisse laufen nach 1–2 Jahren ab (konfigurierbar in Azure). Bei Ablauf schlägt der Microsoft-Login still fehl. Rechtzeitig erneuern und `.env` aktualisieren.

---

## 15. Wichtige Befehle

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
# Tabellen anzeigen
sqlite3 /opt/visitor-mgmt-abatplus/backend/data/visitors.db ".tables"

# Alle Benutzer anzeigen
sqlite3 /opt/visitor-mgmt-abatplus/backend/data/visitors.db \
  "SELECT id, name, email, role, active FROM users;"

# Passwort zurücksetzen
cd /opt/visitor-mgmt-abatplus/backend
HASH=$(node -e "const b=require('bcryptjs'); b.hash('NeuesPasswort123!',12).then(h=>process.stdout.write(h))")
sqlite3 data/visitors.db "UPDATE users SET password_hash='$HASH' WHERE email='admin@example.com';"

# Benutzer auf admin hochstufen
sqlite3 /opt/visitor-mgmt-abatplus/backend/data/visitors.db \
  "UPDATE users SET role='admin' WHERE email='max.mustermann@abat.de';"

# Datenbank-Backup
mkdir -p /root/backups
sqlite3 /opt/visitor-mgmt-abatplus/backend/data/visitors.db \
  ".backup /root/backups/visitors-$(date +%Y%m%d-%H%M).db"

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

## 16. Fehlerbehebung

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
| `sso_cancelled` | Nutzer hat Anmeldung abgebrochen |
| `sso_token_failed` | Code-Austausch fehlgeschlagen — Client Secret abgelaufen? |
| `no_email` | Microsoft-Profil hat keine E-Mail-Adresse |

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

### Datenbank beschädigt / gesperrt
```bash
sqlite3 /opt/visitor-mgmt-abatplus/backend/data/visitors.db "PRAGMA integrity_check;"
# Ausgabe sollte "ok" sein
```
