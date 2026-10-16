const { Router } = require('express');
const { School } = require('../models');
const { z, parse, isoDate } = require('../utils/validate');
const { requireRole } = require('../middleware/auth');

const router = Router();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

router.get('/', async (req, res) => {
  res.json({ school: await School.findById(req.user.schoolId) });
});

router.patch('/', requireRole('admin'), async (req, res) => {
  const body = parse(
    z.object({
      name: z.string().min(2).optional(),
      udiseCode: z.string().optional(),
      district: z.string().optional(),
      block: z.string().optional(),
      academicYear: z.string().regex(/^\d{4}-\d{2}$/, 'Use 2026-27 format').optional(),
      markingWindow: z.object({ start: time, end: time }).optional(),
      alertThreshold: z.number().min(0).max(100).optional(),
      consecutiveAbsenceAlert: z.number().int().min(1).max(30).optional(),
      holidays: z.array(z.object({ date: isoDate, name: z.string() })).optional(),
      defaultLanguage: z.enum(['kn', 'en', 'hi']).optional(),
    }),
    req.body
  );
  const school = await School.findByIdAndUpdate(req.user.schoolId, body, { new: true, runValidators: true });
  res.json({ school });
});

module.exports = router;
