const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notFound } = require('../shared/errors');

/**
 * The whole API in one table: URL prefix, who may call it, and the module that handles it.
 * Each module's *.routes.js only parses the request and calls its *.service.js.
 * To add a feature: create src/modules/<name>/ with routes + service, then add one line here.
 */
const PUBLIC = [];
const SIGNED_IN = [requireAuth];
const ADMIN = [requireAuth, requireRole('admin')];
const APPROVER = [requireAuth, requireRole('superadmin')];

const MODULES = [
  ['/auth', PUBLIC, require('../modules/auth/auth.routes')],
  ['/public', PUBLIC, require('../modules/public/public.routes')],
  ['/school', SIGNED_IN, require('../modules/school/school.routes')],
  ['/classes', SIGNED_IN, require('../modules/classes/classes.routes')],
  ['/students', SIGNED_IN, require('../modules/students/students.routes')],
  ['/users', ADMIN, require('../modules/users/users.routes')],
  ['/attendance', SIGNED_IN, require('../modules/attendance/attendance.routes')],
  ['/leave', SIGNED_IN, require('../modules/leave/leave.routes')],
  ['/pickup', SIGNED_IN, require('../modules/pickup/pickup.routes')],
  ['/risk', SIGNED_IN, require('../modules/risk/risk.routes')],
  ['/reports', SIGNED_IN, require('../modules/reports/reports.routes')],
  ['/me', SIGNED_IN, require('../modules/parents/parents.routes')],
  ['/me', SIGNED_IN, require('../modules/notifications/notifications.routes')],
  ['/dashboard', ADMIN, require('../modules/dashboard/dashboard.routes')],
  ['/platform', APPROVER, require('../modules/platform/platform.routes')],
];

function createApiRouter() {
  const api = Router();
  api.get('/health', (_req, res) => res.json({ ok: true, name: 'haajari', time: new Date().toISOString() }));
  for (const [prefix, guards, router] of MODULES) api.use(prefix, ...guards, router);
  api.use((_req, _res, next) => next(notFound('API route')));
  return api;
}

module.exports = { createApiRouter };
