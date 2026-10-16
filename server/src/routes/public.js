const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { Attendance, User, REASON_CODES } = require('../models');
const { z, parse } = require('../utils/validate');
const { verify } = require('../utils/token');
const { vapidKeys } = require('../services/push');
const { unauthorized, notFound } = require('../utils/errors');
const { recordParentReason } = require('./me');

const router = Router();

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
