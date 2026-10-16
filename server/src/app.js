const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const { requireAuth, requireRole } = require('./middleware/auth');
const { errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin.split(','), credentials: false }));
  app.use(express.json({ limit: '1mb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'haajari', time: new Date().toISOString() }));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/school', requireAuth, require('./routes/school'));
  app.use('/api/classes', requireAuth, require('./routes/classes'));
  app.use('/api/students', requireAuth, require('./routes/students'));
  app.use('/api/users', requireAuth, requireRole('admin'), require('./routes/users'));
  app.use('/api/attendance', requireAuth, require('./routes/attendance'));
  app.use('/api/me', requireAuth, require('./routes/me'));
  app.use('/api/dashboard', requireAuth, requireRole('admin'), require('./routes/dashboard'));

  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'No such API route.' } }));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
