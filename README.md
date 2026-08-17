# abat+ Besucherverwaltung

Individuell für **abat+** angepasste Instanz des allgemeinen Besucherverwaltungssystems: schlank, mitarbeitergesteuert. Mitarbeiter checken Besucher direkt vom eigenen Desktop oder Handy ein — kein Empfangskiosk, keine Selbstbedienung durch den Besucher. Gegenüber der Ausgangsversion wurden Features wie Kiosk-Modus, Host-Portal, QR-Scanner, Badge-Druck und Evakuierungsliste bewusst entfernt (Details siehe [Projektdokumentation](docs/dokumentation.md#1-projektübersicht)).

## Dokumentation

| Dokument | Beschreibung |
|---|---|
| [Installation](docs/installation.md) | Setup direkt auf Ubuntu/Debian mit Nginx, pm2 & MariaDB |
| [Projektdokumentation](docs/dokumentation.md) | Vollständige technische Dokumentation: Architektur, API, DB-Schema, Features, Sicherheit |
| [Mitarbeiter-Anleitung](docs/mitarbeiter-anleitung.md) | Kurzanleitung für den täglichen Gebrauch (Check-in/-out, Vorregistrierung) |

## Tech Stack

| Bereich | Technologien |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS 4 |
| **Backend** | Node.js (≥ 22), Express.js 5, `mysql2` (MariaDB, async Pool), JWT |
| **Sicherheit** | helmet, express-rate-limit, bcryptjs (cost 12) |
| **Services** | MSAL (Microsoft SSO), Microsoft Graph (AD-Suche, Gastgeber-Sync, Mailversand) |
| **Infra** | Nginx, pm2, Cloudflare, MariaDB 10.11 |

## Features

- Check-in / Check-out durch den Mitarbeiter — kein Kiosk, kein Empfang
- Check-in-/Check-out-Zeiten nachträglich korrigierbar
- Vorregistrierungen — in derselben Besucherliste integriert, kein separater Bereich
- Besuchszwecke — konfigurierbare, sortierbare Liste
- **Microsoft SSO mit Zugriffsliste** — nur explizit freigeschaltete E-Mail-Adressen dürfen sich anmelden, Rolle wird bei jedem Login synchronisiert
- **Gastgeber-Synchronisierung (Entra ID)** — Gastgeber automatisch aus Microsoft Entra ID übernehmen, täglich oder manuell (nutzt dieselbe App-Registrierung wie Microsoft SSO)
- **Auto-Checkout** täglich zur konfigurierten Uhrzeit (Standard: 20:00), abschaltbar
- Datenschutz-Checkbox mit konfigurierbarem Hinweistext — kein Unterschriftspad
- Datenschutz-Bereinigung — automatisch nach Aufbewahrungsfrist, zusätzlich manuell auslösbar
- Vollständig responsiv — Handy + Desktop gleichwertig

## Schnellstart (Entwicklung)

```bash
# Backend
cd backend
cp .env.example .env   # .env ausfüllen
npm install
npm start               # http://localhost:3001

# Frontend (separates Terminal)
cd frontend
npm install
npm run dev              # http://localhost:5173  (Proxy /api → :3001)
```

Vollständige Installationsanleitung (Produktivbetrieb): [docs/installation.md](docs/installation.md)

## Routen

| Route | Beschreibung | Auth |
|---|---|---|
| `/login` | Anmeldung (Microsoft SSO + lokaler Fallback) | Nein |
| `/auth-callback` | Verarbeitet OAuth-Redirect, tauscht Code gegen JWT | Nein |
| `/dashboard` | Statistiken, letzte Aktivitäten, Check-in-Button | Ja |
| `/visitors` | Zentrale Besucherliste — Vorregistriert / Anwesend / Ausgecheckt / Abgesagt | Ja |
| `/settings` | Auto-Checkout, Besuchszwecke, Datenschutz, Benutzer, Gastgeber, Gastgeber-Sync, Microsoft SSO | Ja (admin für die meisten Tabs) |

Rollen: `admin` (Vollzugriff inkl. Benutzerverwaltung & Einstellungen) / `user` (Einchecken, Auschecken, Besucher & Vorregistrierungen lesen). Details siehe [docs/dokumentation.md](docs/dokumentation.md#2-benutzerrollen--berechtigungen).
