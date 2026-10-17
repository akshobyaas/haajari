const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { Attendance, User, REASON_CODES } = require('../models');
const { z, parse } = require('../utils/validate');
const { verify } = require('../utils/token');
const { vapidKeys } = require('../services/push');
const { unauthorized, notFound } = require('../utils/errors');
const { recordParentReason } = require('./me');
const env = require('../config/env');
const { createSchool } = require('../services/schools');
const { schoolRequestSchema } = require('./schoolRequestSchema');

const router = Router();

// A headmaster asks to put their school on Haajari. It waits as 'pending' until the approver accepts it.
const requestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.isProd ? 5 : 1000,
  message: { error: { code: 'rate_limited', message: 'Too many requests from this network. Try again in an hour.' } },
});
router.post('/school-requests', requestLimiter, async (req, res) => {
  const body = parse(schoolRequestSchema, req.body);
  const school = await createSchool({ ...body, status: 'pending' });
  res.status(201).json({ school: { id: school._id, name: school.name, status: school.status } });
});

router.get('/push/key', (_req, res) => res.json({ publicKey: vapidKeys().publicKey }));

/**
 * One-tap answer from the notification itself (e.g. "Sick"). The notification carries a
 * signed token naming this absence and this parent, so no login is needed.
 */
router.post('/absence-reply', rateLimit({ windowMs: 60_000, limit: 30 }), async (req, res) => {
  const body = parse(z.object({ token: z.string(), reason: z.enum(REASON_CODES) }), req.body);
  let t;
  try { t = verify(body.token); } catch { throw unauthorized('This link has expired. Open the app to reply.'); }
  if (t.purpose !== 'absence-reply') throw unauthorized();
  const [rec, parent] = await Promise.all([Attendance.findById(t.aid), User.findById(t.uid)]);
  if (!rec || !parent) throw notFound('Absence');
  res.json(await recordParentReason(rec, parent, body.reason));
});

module.exports = router;
