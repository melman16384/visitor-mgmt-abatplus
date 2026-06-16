# Besucherverwaltungssystem

Ein vollständiges, produktionsreifes Besucherverwaltungssystem mit Node.js/Express Backend und React Frontend.

## Schnellstart

### Backend starten
```bash
cd backend
npm start
# Server läuft auf http://localhost:3001
```

### Frontend (Entwicklung)
```bash
cd frontend
npm run dev
# App läuft auf http://localhost:3000
```

### Datenbank zurücksetzen / neu befüllen
```bash
cd backend
npm run seed
```

## Demo-Zugangsdaten
- **Admin:** admin@firma.de / Admin123!
- **Empfang:** empfang@firma.de / Empfang123!

## Routen
- `/login` – Anmeldung
- `/dashboard` – Übersicht mit Statistiken und Diagrammen
- `/visitors` – Besucherliste und Eincheck-Funktion
- `/hosts` – Gastgeberverwaltung
- `/preregistrations` – Vorregistrierungen mit QR-Code
- `/watchlist` – Sperrliste
- `/evacuation` – Evakuierungsliste (Echtzeit)
- `/reports` – Berichte und CSV-Export
- `/settings` – Standorte, E-Mail-Einstellungen, Passwortänderung
- `/kiosk` – Selbst-Eincheck-Kiosk (öffentlich, kein Login erforderlich)

## Tech Stack
- **Backend:** Node.js, Express, better-sqlite3, JWT, bcryptjs, PDFKit, QRCode, Nodemailer
- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, Lucide Icons, date-fns
