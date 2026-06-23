require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-origin' },
  contentSecurityPolicy: false,
}));

const corsOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
if (process.env.APP_URL) corsOrigins.push(process.env.APP_URL);

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use('/api/auth/microsoft', require('./routes/auth-microsoft'));
app.use('/api/auth', loginLimiter, require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/visitors', require('./routes/visitors'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/hosts', require('./routes/hosts'));
app.use('/api/preregistrations', require('./routes/preregistrations'));
app.use('/api/users', require('./routes/users'));
app.use('/api/settings', require('./routes/settings'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Interner Serverfehler' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route nicht gefunden' });
});

// Init DB + start
const { cleanup: auditCleanup } = require('./services/audit-log');
require('./db/database');
auditCleanup();

const { scheduleNext } = require('./services/auto-checkout');
const { scheduleRetention } = require('./services/data-retention');
app.listen(PORT, () => {
  console.log(`✓ Besucherverwaltung Backend läuft auf Port ${PORT}`);
  scheduleNext();
  scheduleRetention();
});

module.exports = app;
