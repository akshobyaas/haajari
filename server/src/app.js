const path = require('path');
const fs = require('fs');
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const { createApiRouter } = require('./api');
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
  if (!env.isTest) app.use(morgan(env.isProd ? 'tiny' : 'dev'));

  app.use('/api', createApiRouter());
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
  const dist = env.clientDist || path.join(__dirname, '../../client/dist');
  if (!env.serveClient || !fs.existsSync(path.join(dist, 'index.html'))) return;
  // Hashed assets never change; the shell and service worker must always be fresh.
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(dist, { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } }));
}

module.exports = { createApp };
