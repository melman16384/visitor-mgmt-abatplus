require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const db = require('./database');

console.log('Seeding database...');

// Clear existing data
db.exec(`
  DELETE FROM watchlist;
  DELETE FROM preregistrations;
  DELETE FROM visits;
  DELETE FROM visitors;
  DELETE FROM hosts;
  DELETE FROM locations;
  DELETE FROM users;
`);

// Locations
const insertLocation = db.prepare(`INSERT INTO locations (name, address, city) VALUES (?, ?, ?)`);
const loc1 = insertLocation.run('Hauptsitz Berlin', 'Unter den Linden 42', 'Berlin');
const loc2 = insertLocation.run('Niederlassung München', 'Maximilianstraße 18', 'München');

// Users
const insertUser = db.prepare(`INSERT INTO users (name, email, password_hash, role, location_id) VALUES (?, ?, ?, ?, ?)`);
const adminHash = bcrypt.hashSync('Admin123!', 10);
const recepHash = bcrypt.hashSync('Empfang123!', 10);
insertUser.run('Administrator', 'admin@firma.de', adminHash, 'superadmin', loc1.lastInsertRowid);
insertUser.run('Maria Empfang', 'empfang@firma.de', recepHash, 'receptionist', loc1.lastInsertRowid);

// Hosts
const insertHost = db.prepare(`INSERT INTO hosts (name, email, phone, department, location_id) VALUES (?, ?, ?, ?, ?)`);
const hosts = [
  insertHost.run('Dr. Klaus Weber', 'k.weber@firma.de', '+49 30 12345-101', 'Geschäftsführung', loc1.lastInsertRowid),
  insertHost.run('Sandra Müller', 's.mueller@firma.de', '+49 30 12345-102', 'Vertrieb', loc1.lastInsertRowid),
  insertHost.run('Thomas Becker', 't.becker@firma.de', '+49 30 12345-103', 'IT', loc1.lastInsertRowid),
  insertHost.run('Petra Hoffmann', 'p.hoffmann@firma.de', '+49 30 12345-104', 'HR', loc1.lastInsertRowid),
  insertHost.run('Andreas Schulz', 'a.schulz@firma.de', '+49 89 98765-201', 'Einkauf', loc2.lastInsertRowid),
  insertHost.run('Claudia Fischer', 'c.fischer@firma.de', '+49 89 98765-202', 'Vertrieb', loc2.lastInsertRowid),
  insertHost.run('Michael Braun', 'm.braun@firma.de', '+49 89 98765-203', 'Produktion', loc2.lastInsertRowid),
  insertHost.run('Julia Zimmermann', 'j.zimmermann@firma.de', '+49 30 12345-105', 'Marketing', loc1.lastInsertRowid),
];

// Visitors
const insertVisitor = db.prepare(`INSERT INTO visitors (first_name, last_name, email, phone, company, nda_signed, nda_signed_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
const visitors = [
  insertVisitor.run('Hans', 'Schmidt', 'h.schmidt@bmw.de', '+49 89 382-0', 'BMW AG', 1, new Date(Date.now() - 86400000 * 5).toISOString()),
  insertVisitor.run('Ingrid', 'Meier', 'i.meier@siemens.com', '+49 89 636-0', 'Siemens AG', 1, new Date(Date.now() - 86400000 * 10).toISOString()),
  insertVisitor.run('Wolfgang', 'König', 'w.koenig@sap.com', '+49 6227 7-0', 'SAP SE', 1, new Date(Date.now() - 86400000 * 3).toISOString()),
  insertVisitor.run('Ursula', 'Richter', 'u.richter@bosch.de', '+49 711 811-0', 'Robert Bosch GmbH', 0, null),
  insertVisitor.run('Günter', 'Krause', 'g.krause@vw.de', '+49 5361 9-0', 'Volkswagen AG', 1, new Date(Date.now() - 86400000 * 7).toISOString()),
  insertVisitor.run('Monika', 'Wagner', 'm.wagner@telekom.de', '+49 228 181-0', 'Deutsche Telekom AG', 1, new Date(Date.now() - 86400000 * 2).toISOString()),
  insertVisitor.run('Dieter', 'Bauer', 'd.bauer@lufthansa.de', '+49 69 696-0', 'Lufthansa AG', 0, null),
  insertVisitor.run('Renate', 'Schwarz', 'r.schwarz@allianz.de', '+49 89 3800-0', 'Allianz SE', 1, new Date(Date.now() - 86400000 * 1).toISOString()),
  insertVisitor.run('Friedrich', 'Hartmann', 'f.hartmann@dhl.de', '+49 228 182-0', 'Deutsche Post DHL', 0, null),
  insertVisitor.run('Helga', 'Jung', 'h.jung@basf.de', '+49 621 60-0', 'BASF SE', 1, new Date(Date.now() - 86400000 * 4).toISOString()),
  insertVisitor.run('Erich', 'Lange', 'e.lange@thyssen.de', '+49 201 844-0', 'ThyssenKrupp AG', 0, null),
  insertVisitor.run('Karin', 'Krüger', 'k.krueger@adidas.de', '+49 9132 84-0', 'Adidas AG', 1, new Date(Date.now() - 86400000 * 6).toISOString()),
  insertVisitor.run('Otto', 'Braun', 'o.braun@porsche.de', '+49 711 911-0', 'Porsche AG', 1, new Date(Date.now() - 86400000 * 8).toISOString()),
  insertVisitor.run('Anna', 'Schäfer', 'a.schaefer@zalando.de', '+49 30 2000-0', 'Zalando SE', 0, null),
  insertVisitor.run('Bernd', 'Koch', 'b.koch@daimler.de', '+49 711 17-0', 'Mercedes-Benz AG', 1, new Date(Date.now() - 86400000 * 9).toISOString()),
  insertVisitor.run('Petra', 'Vogt', 'p.vogt@bayer.de', '+49 214 30-0', 'Bayer AG', 1, new Date(Date.now() - 86400000 * 11).toISOString()),
  insertVisitor.run('Stefan', 'Frank', 's.frank@eon.de', '+49 211 45-0', 'E.ON SE', 0, null),
  insertVisitor.run('Brigitte', 'Arnold', 'b.arnold@rwe.de', '+49 201 12-0', 'RWE AG', 1, new Date(Date.now() - 86400000 * 12).toISOString()),
  insertVisitor.run('Horst', 'Peters', 'h.peters@henkel.de', '+49 211 797-0', 'Henkel AG', 0, null),
  insertVisitor.run('Susanne', 'Winter', 's.winter@otto.de', '+49 40 6461-0', 'Otto GmbH', 1, new Date(Date.now() - 86400000 * 13).toISOString()),
];

// Badge counter
let badgeCounter = 1000;
const getBadge = () => `B-${++badgeCounter}`;

// Past visits (last 30 days)
const insertVisit = db.prepare(`
  INSERT INTO visits (visitor_id, host_id, location_id, purpose, badge_number, qr_code, checked_in_at, checked_out_at, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const purposes = ['Besprechung', 'Lieferung', 'Interview', 'Wartung', 'Sonstiges'];
const pastVisits = [
  [visitors[0].lastInsertRowid, hosts[0].lastInsertRowid, loc1.lastInsertRowid, 'Besprechung', getBadge(), null, new Date(Date.now() - 86400000 * 28).toISOString(), new Date(Date.now() - 86400000 * 28 + 7200000).toISOString(), 'completed'],
  [visitors[1].lastInsertRowid, hosts[1].lastInsertRowid, loc1.lastInsertRowid, 'Vertragsgespräch', getBadge(), null, new Date(Date.now() - 86400000 * 25).toISOString(), new Date(Date.now() - 86400000 * 25 + 5400000).toISOString(), 'completed'],
  [visitors[2].lastInsertRowid, hosts[2].lastInsertRowid, loc1.lastInsertRowid, 'IT-Support', getBadge(), null, new Date(Date.now() - 86400000 * 22).toISOString(), new Date(Date.now() - 86400000 * 22 + 3600000).toISOString(), 'completed'],
  [visitors[3].lastInsertRowid, hosts[3].lastInsertRowid, loc1.lastInsertRowid, 'Bewerbungsgespräch', getBadge(), null, new Date(Date.now() - 86400000 * 20).toISOString(), new Date(Date.now() - 86400000 * 20 + 5400000).toISOString(), 'completed'],
  [visitors[4].lastInsertRowid, hosts[4].lastInsertRowid, loc2.lastInsertRowid, 'Lieferung', getBadge(), null, new Date(Date.now() - 86400000 * 18).toISOString(), new Date(Date.now() - 86400000 * 18 + 1800000).toISOString(), 'completed'],
  [visitors[5].lastInsertRowid, hosts[5].lastInsertRowid, loc2.lastInsertRowid, 'Verkaufsgespräch', getBadge(), null, new Date(Date.now() - 86400000 * 15).toISOString(), new Date(Date.now() - 86400000 * 15 + 7200000).toISOString(), 'completed'],
  [visitors[6].lastInsertRowid, hosts[6].lastInsertRowid, loc2.lastInsertRowid, 'Wartung', getBadge(), null, new Date(Date.now() - 86400000 * 14).toISOString(), new Date(Date.now() - 86400000 * 14 + 10800000).toISOString(), 'completed'],
  [visitors[7].lastInsertRowid, hosts[7].lastInsertRowid, loc1.lastInsertRowid, 'Besprechung', getBadge(), null, new Date(Date.now() - 86400000 * 12).toISOString(), new Date(Date.now() - 86400000 * 12 + 3600000).toISOString(), 'completed'],
  [visitors[8].lastInsertRowid, hosts[0].lastInsertRowid, loc1.lastInsertRowid, 'Sonstiges', getBadge(), null, new Date(Date.now() - 86400000 * 10).toISOString(), new Date(Date.now() - 86400000 * 10 + 2700000).toISOString(), 'completed'],
  [visitors[9].lastInsertRowid, hosts[1].lastInsertRowid, loc1.lastInsertRowid, 'Besprechung', getBadge(), null, new Date(Date.now() - 86400000 * 8).toISOString(), new Date(Date.now() - 86400000 * 8 + 5400000).toISOString(), 'completed'],
  [visitors[10].lastInsertRowid, hosts[2].lastInsertRowid, loc1.lastInsertRowid, 'IT-Projekt', getBadge(), null, new Date(Date.now() - 86400000 * 7).toISOString(), new Date(Date.now() - 86400000 * 7 + 14400000).toISOString(), 'completed'],
  [visitors[11].lastInsertRowid, hosts[3].lastInsertRowid, loc1.lastInsertRowid, 'Interview', getBadge(), null, new Date(Date.now() - 86400000 * 5).toISOString(), new Date(Date.now() - 86400000 * 5 + 3600000).toISOString(), 'completed'],
  [visitors[12].lastInsertRowid, hosts[4].lastInsertRowid, loc2.lastInsertRowid, 'Besprechung', getBadge(), null, new Date(Date.now() - 86400000 * 4).toISOString(), new Date(Date.now() - 86400000 * 4 + 7200000).toISOString(), 'completed'],
  [visitors[13].lastInsertRowid, hosts[5].lastInsertRowid, loc2.lastInsertRowid, 'Vertrieb', getBadge(), null, new Date(Date.now() - 86400000 * 3).toISOString(), new Date(Date.now() - 86400000 * 3 + 5400000).toISOString(), 'completed'],
  [visitors[14].lastInsertRowid, hosts[6].lastInsertRowid, loc2.lastInsertRowid, 'Produktpräsentation', getBadge(), null, new Date(Date.now() - 86400000 * 2).toISOString(), new Date(Date.now() - 86400000 * 2 + 7200000).toISOString(), 'completed'],
];

for (const v of pastVisits) {
  insertVisit.run(...v);
}

// Active visits (today, not checked out)
const todayStart = new Date();
todayStart.setHours(8, 0, 0, 0);

const activeVisitData = [
  [visitors[15].lastInsertRowid, hosts[0].lastInsertRowid, loc1.lastInsertRowid, 'Besprechung', getBadge()],
  [visitors[16].lastInsertRowid, hosts[1].lastInsertRowid, loc1.lastInsertRowid, 'Vertriebsgespräch', getBadge()],
  [visitors[17].lastInsertRowid, hosts[2].lastInsertRowid, loc1.lastInsertRowid, 'IT-Beratung', getBadge()],
  [visitors[18].lastInsertRowid, hosts[4].lastInsertRowid, loc2.lastInsertRowid, 'Lieferung', getBadge()],
  [visitors[19].lastInsertRowid, hosts[5].lastInsertRowid, loc2.lastInsertRowid, 'Besprechung', getBadge()],
];

const insertActiveVisit = db.prepare(`
  INSERT INTO visits (visitor_id, host_id, location_id, purpose, badge_number, checked_in_at, status)
  VALUES (?, ?, ?, ?, ?, ?, 'active')
`);

let minuteOffset = 30;
for (const v of activeVisitData) {
  const checkinTime = new Date(todayStart.getTime() + minuteOffset * 60000);
  insertActiveVisit.run(v[0], v[1], v[2], v[3], v[4], checkinTime.toISOString());
  minuteOffset += 25;
}

// Pre-registrations
const insertPreReg = db.prepare(`
  INSERT INTO preregistrations (visitor_first_name, visitor_last_name, visitor_email, visitor_company, host_id, location_id, expected_date, expected_time, purpose, qr_code, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const tomorrow = new Date(Date.now() + 86400000);
const nextWeek = new Date(Date.now() + 7 * 86400000);
const yesterday = new Date(Date.now() - 86400000);
const fmtDate = (d) => d.toISOString().split('T')[0];

insertPreReg.run('Klaus', 'Neumann', 'k.neumann@mercedes.de', 'Mercedes-Benz AG', hosts[0].lastInsertRowid, loc1.lastInsertRowid, fmtDate(tomorrow), '09:00', 'Besprechung', 'PRE-' + Date.now() + '-001', 'pending');
insertPreReg.run('Helga', 'Sommer', 'h.sommer@porsche.de', 'Porsche AG', hosts[1].lastInsertRowid, loc1.lastInsertRowid, fmtDate(tomorrow), '14:00', 'Vertrieb', 'PRE-' + Date.now() + '-002', 'pending');
insertPreReg.run('Fritz', 'Baumann', 'f.baumann@audi.de', 'Audi AG', hosts[2].lastInsertRowid, loc1.lastInsertRowid, fmtDate(nextWeek), '10:30', 'IT-Demo', 'PRE-' + Date.now() + '-003', 'pending');
insertPreReg.run('Lotte', 'Keller', 'l.keller@vw.de', 'Volkswagen AG', hosts[4].lastInsertRowid, loc2.lastInsertRowid, fmtDate(yesterday), '11:00', 'Lieferung', 'PRE-' + Date.now() + '-004', 'expired');
insertPreReg.run('Max', 'Steiner', 'm.steiner@bmw.de', 'BMW AG', hosts[5].lastInsertRowid, loc2.lastInsertRowid, fmtDate(yesterday), '15:00', 'Besprechung', 'PRE-' + Date.now() + '-005', 'checked_in');

// Watchlist
const insertWatch = db.prepare(`
  INSERT INTO watchlist (first_name, last_name, email, company, reason, severity, active)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

insertWatch.run('Franz', 'Müller', 'f.mueller@spam.de', 'Unbekannt', 'Unbefugter Zutrittsversuch am 12.03.2024', 'high', 1);
insertWatch.run('Rita', 'Schwarz', null, 'Konkurrenz GmbH', 'Industriespionage-Verdacht', 'medium', 1);

console.log('Database seeded successfully!');
console.log('Login credentials:');
console.log('  Admin: admin@firma.de / Admin123!');
console.log('  Receptionist: empfang@firma.de / Empfang123!');
