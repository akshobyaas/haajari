const { Router } = require('express');
const { ClassRoom, Student, User, School, PRE_PRIMARY } = require('../models');
const { dayOverview, trend } = require('../services/stats');
const { todayIn } = require('../utils/dates');
const { z, parse, isoDate } = require('../utils/validate');

// Admin only (mounted behind requireRole('admin')).
const router = Router();

// Setup completeness (Phase 1).
router.get('/summary', async (req, res) => {
  const schoolId = req.user.schoolId;
  const [classes, students, teachers, parents, noSats, noParent] = await Promise.all([
    ClassRoom.find({ schoolId, active: true }).select('grade classTeacherId'),
    Student.countDocuments({ schoolId, active: true }),
    User.countDocuments({ schoolId, role: 'teacher', active: true }),
    User.countDocuments({ schoolId, role: 'parent', active: true }),
    Student.countDocuments({ schoolId, active: true, satsId: { $exists: false } }),
    Student.countDocuments({ schoolId, active: true, parentIds: { $size: 0 } }),
  ]);
  res.json({
    classes: classes.length,
    prePrimaryClasses: classes.filter((c) => PRE_PRIMARY.includes(c.grade)).length,
    classesWithoutTeacher: classes.filter((c) => !c.classTeacherId).length,
    students, teachers, parents,
    studentsWithoutSats: noSats,
    studentsWithoutParent: noParent,
  });
});

// Live picture of the day: headcount, registers taken, class-wise %, meals, who is in school now.
router.get('/today', async (req, res) => {
  const school = await School.findById(req.user.schoolId);
  const { date } = parse(z.object({ date: isoDate.optional() }), req.query);
  res.json(await dayOverview(school, date || todayIn(school.timezone)));
});

router.get('/trend', async (req, res) => {
  const school = await School.findById(req.user.schoolId);
  const { days } = parse(z.object({ days: z.coerce.number().int().min(5).max(120).default(30) }), req.query);
  res.json({ days: await trend(school, todayIn(school.timezone), days) });
});

module.exports = router;
