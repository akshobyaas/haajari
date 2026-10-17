const path = require('path');
const fs = require('fs');
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const { requireAuth, requireRole } = require('./middleware/auth');
const { errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind Render's proxy: real client IPs for rate limiting
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        // The QR scanner runs its decoder in a worker built from a blob: URL,
        // and guardian photos are resized through blob: images on the phone.
        'worker-src': ["'self'", 'blob:'],
        'img-src': ["'self'", 'data:', 'blob:'],
      },
    },
  }));
  app.use(compression()); // a 3G phone gets about a third of the bytes
  app.use(cors({ origin: env.clientOrigin.split(','), credentials: false }));
  app.use(express.json({ limit: '1mb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'haajari', time: new Date().toISOString() }));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/public', require('./routes/public'));
  app.use('/api/school', requireAuth, require('./routes/school'));
  app.use('/api/classes', requireAuth, require('./routes/classes'));
  app.use('/api/students', requireAuth, require('./routes/students'));
  app.use('/api/users', requireAuth, requireRole('admin'), require('./routes/users'));
  app.use('/api/attendance', requireAuth, require('./routes/attendance'));
  app.use('/api/leave', requireAuth, require('./routes/leave'));
  app.use('/api/pickup', requireAuth, require('./routes/pickup'));
  app.use('/api/risk', requireAuth, require('./routes/risk'));
  app.use('/api/reports', requireAuth, require('./routes/reports'));
  app.use('/api/me', requireAuth, require('./routes/me'));
  app.use('/api/dashboard', requireAuth, requireRole('admin'), require('./routes/dashboard'));
  app.use('/api/platform', requireAuth, requireRole('superadmin'), require('./routes/platform'));

  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'No such API route.' } }));
  serveClient(app);
  app.use(errorHandler);
  return app;
}

/**
 * In production one service serves both the API and the built app, so the app, its service
 * worker and push notifications share one HTTPS origin (browsers require that for offline
 * start and notifications). Set SERVE_CLIENT=false to serve the API alone.
 */
function serveClient(app) {
  const dist = process.env.CLIENT_DIST || path.join(__dirname, '../../client/dist');
  if (process.env.SERVE_CLIENT === 'false' || !fs.existsSync(path.join(dist, 'index.html'))) return;
  // Hashed assets never change; the shell and service worker must always be fresh.
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(dist, { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } }));
}

module.exports = { createApp };
