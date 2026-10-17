const { Router } = require('express');
const { parse } = require('../../shared/validate');
const { todayIn, addDays } = require('../../shared/dates');
const { requireRole } = require('../../middleware/auth');
const { assertClassAccess, assertStudentAccess } = require('../../middleware/access');
const { getSchool } = require('../school/school.service');
const { saveBulk, classHistory, auditTrail } = require('./attendance.service');
const { bulkSave, historyRange, auditQuery } = require('./attendance.schemas');

const router = Router();
const staff = requireRole('admin', 'teacher');

// Save a whole class at once. Also the endpoint the offline queue replays.
router.post('/bulk', staff, async (req, res) => {
  const body = parse(bulkSave, req.body);
  const cls = await assertClassAccess(req.user, body.classId);
  const school = await getSchool(req.user.schoolId);
  res.json(await saveBulk({ user: req.user, school, cls, ...body }));
});

// Day-by-day counts for the class history screen (last 30 days by default).
router.get('/class/:classId/history', staff, async (req, res) => {
  const cls = await assertClassAccess(req.user, req.params.classId);
  const school = await getSchool(req.user.schoolId);
  const q = parse(historyRange, req.query);
  const to = q.to || todayIn(school.timezone);
  res.json({ days: await classHistory(cls, q.from || addDays(to, -30), to) });
});

// Edit history for one student's day.
router.get('/audit', staff, async (req, res) => {
  const q = parse(auditQuery, req.query);
  await assertStudentAccess(req.user, q.studentId);
  res.json({ logs: await auditTrail(q.studentId, q.date) });
});

module.exports = router;
