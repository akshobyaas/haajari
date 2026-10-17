const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { REASON_CODES } = require('../../models');
const { z, parse } = require('../../shared/validate');
const env = require('../../config/env');
const { vapidKeys } = require('../notifications/push.service');
const { answerFromNotification } = require('../parents/parents.service');
const { createSchool } = require('../platform/platform.service');
const { schoolRequest } = require('../platform/platform.schemas');

// Endpoints that need no login. Each one is rate-limited or carries its own signed token.
const router = Router();

const limit = (windowMs, max, message) => rateLimit({
  windowMs,
  limit: env.isProd ? max : 1000,
  message: { error: { code: 'rate_limited', message } },
});

// A headmaster asks to put their school on Haajari. It waits as 'pending' until the approver accepts it.
router.post('/school-requests', limit(60 * 60 * 1000, 5, 'Too many requests from this network. Try again in an hour.'), async (req, res) => {
  const school = await createSchool({ ...parse(schoolRequest, req.body), status: 'pending' });
  res.status(201).json({ school: { id: school._id, name: school.name, status: school.status } });
});

// The public key phones need to turn on notifications.
router.get('/push/key', (_req, res) => res.json({ publicKey: vapidKeys().publicKey }));

// The "Sick" / "Family" buttons on an absence notification.
router.post('/absence-reply', limit(60_000, 30, 'Too many replies. Try again in a minute.'), async (req, res) => {
  const { token, reason } = parse(z.object({ token: z.string(), reason: z.enum(REASON_CODES) }), req.body);
  res.json(await answerFromNotification(token, reason));
});

module.exports = router;
