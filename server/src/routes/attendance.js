const { Router } = require('express');
const { School, Attendance, AuditLog } = require('../models');
const { z, parse, objectId, isoDate } = require('../utils/validate');
const { requireRole } = require('../middleware/auth');
const { assertClassAccess, assertStudentAccess } = require('../middleware/access');
const { saveBulk, classHistory } = require('../services/attendance');
const { todayIn, addDays } = require('../utils/dates');

const router = Router();

const markSchema = z.object({
  studentId: objectId,
  status: z.enum(['P', 'A', 'L', 'LV']),
  clientId: z.string().min(8).max(64),
  markedAt: z.iso.datetime(),
});

// Save a whole class at once. Also the endpoint the offline queue replays.
router.post('/bulk', requireRole('admin', 'teacher'), async (req, res) => {
  const body = parse(
    z.object({
      classId: objectId,
      date: isoDate,
      period: z.number().int().min(0).max(10).default(0),
      marks: z.array(markSchema).min(1).max(200),
      editReason: z.string().trim().min(3, 'Write a short reason, at least 3 letters').max(200).optional(),
    }),
    req.body
  );
  const cls = await assertClassAccess(req.user, body.classId);
  const school = await School.findById(req.user.schoolId);
  res.json(await saveBulk({ user: req.user, school, cls, ...body }));
});

// Day-by-day counts for the class history screen.
router.get('/class/:classId/history', requireRole('admin', 'teacher'), async (req, res) => {
  const cls = await assertClassAccess(req.user, req.params.classId);
  const school = await School.findById(req.user.schoolId);
  const q = parse(z.object({ from: isoDate.optional(), to: isoDate.optional() }), req.query);
  const to = q.to || todayIn(school.timezone);
  const from = q.from || addDays(to, -30);
  res.json({ days: await classHistory(cls, from, to) });
});

// Edit history for one student's day (shown under "who changed this").
router.get('/audit', requireRole('admin', 'teacher'), async (req, res) => {
  const q = parse(z.object({ studentId: objectId, date: isoDate }), req.query);
  await assertStudentAccess(req.user, q.studentId);
  const records = await Attendance.find({ studentId: q.studentId, date: q.date }).select('_id period');
  const logs = await AuditLog.find({ entity: 'attendance', entityId: { $in: records.map((r) => r._id) } })
    .sort({ at: -1 })
    .populate('changedBy', 'name');
  const periodOf = Object.fromEntries(records.map((r) => [String(r._id), r.period]));
  res.json({ logs: logs.map((l) => ({ ...l.toObject(), period: periodOf[String(l.entityId)] })) });
});

module.exports = router;
