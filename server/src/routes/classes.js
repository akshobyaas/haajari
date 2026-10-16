const { Router } = require('express');
const { ClassRoom, Student, User, School, Attendance, GRADES, MODES, defaultModeFor } = require('../models');
const { todaySummary } = require('../services/attendance');
const { todayIn, closedReason, editNeedsReason } = require('../utils/dates');
const { isoDate } = require('../utils/validate');
const { z, parse, objectId } = require('../utils/validate');
const { requireRole } = require('../middleware/auth');
const { teacherClassIds, assertClassAccess } = require('../middleware/access');
const { badRequest, forbidden } = require('../utils/errors');

const router = Router();
const gradeOrder = (g) => GRADES.indexOf(g);

async function withCounts(classes) {
  const counts = await Student.aggregate([
    { $match: { classId: { $in: classes.map((c) => c._id) }, active: true } },
    { $group: { _id: '$classId', n: { $sum: 1 } } },
  ]);
  const byId = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  return classes
    .map((c) => ({ ...c.toObject(), studentCount: byId[String(c._id)] || 0 }))
    .sort((a, b) => gradeOrder(a.grade) - gradeOrder(b.grade) || a.section.localeCompare(b.section));
}

router.get('/', async (req, res) => {
  const filter = { schoolId: req.user.schoolId, active: true };
  if (req.user.role === 'teacher') filter._id = { $in: await teacherClassIds(req.user) };
  else if (req.user.role !== 'admin') throw forbidden();
  const classes = await ClassRoom.find(filter).populate('classTeacherId', 'name phone');
  const school = await School.findById(req.user.schoolId);
  const today = todayIn(school.timezone);
  const marked = await todaySummary(classes, today);
  const list = (await withCounts(classes)).map((c) => ({ ...c, today: marked[String(c._id)] || null }));
  res.json({ date: today, closed: closedReason(school, today), classes: list });
});

// Everything the marking screen needs, in one request (also cached on the phone for offline use).
router.get('/:id/roster', async (req, res) => {
  const cls = await assertClassAccess(req.user, req.params.id);
  const school = await School.findById(req.user.schoolId);
  const q = parse(z.object({ date: isoDate.optional() }), req.query);
  const date = q.date || todayIn(school.timezone);
  const [students, marks] = await Promise.all([
    Student.find({ classId: cls._id, active: true }).select('name rollNo gender photoUrl admissionNo').sort({ rollNo: 1, name: 1 }),
    Attendance.find({ classId: cls._id, date }).select('studentId period status markedAt reason reasonBy source alertedAt').populate('markedBy', 'name'),
  ]);
  res.json({
    class: { _id: cls._id, grade: cls.grade, section: cls.section, mode: cls.mode, periodsPerDay: cls.periodsPerDay, classTeacherId: cls.classTeacherId },
    date,
    today: todayIn(school.timezone),
    closed: closedReason(school, date),
    editNeedsReason: editNeedsReason(school, date),
    school: { markingWindow: school.markingWindow, timezone: school.timezone, teacherBackdateDays: school.teacherBackdateDays, holidays: school.holidays },
    students,
    marks,
  });
});

router.get('/:id', async (req, res) => {
  const cls = await assertClassAccess(req.user, req.params.id);
  await cls.populate('classTeacherId', 'name phone');
  res.json({ class: (await withCounts([cls]))[0] });
});

const classBody = z.object({
  grade: z.enum(GRADES),
  section: z.string().trim().min(1).max(3),
  medium: z.enum(['kannada', 'english', 'urdu']).optional(),
  classTeacherId: objectId.nullable().optional(),
  mode: z.enum(MODES).optional(),
  periodsPerDay: z.number().int().min(0).max(10).optional(),
});

async function checkTeacher(schoolId, id) {
  if (!id) return;
  const t = await User.findOne({ _id: id, schoolId, role: 'teacher', active: true });
  if (!t) throw badRequest('Pick a teacher from this school.');
}

router.post('/', requireRole('admin'), async (req, res) => {
  const body = parse(classBody, req.body);
  await checkTeacher(req.user.schoolId, body.classTeacherId);
  const cls = await ClassRoom.create({ ...body, mode: body.mode || defaultModeFor(body.grade), schoolId: req.user.schoolId });
  res.status(201).json({ class: cls });
});

router.patch('/:id', requireRole('admin'), async (req, res) => {
  const body = parse(classBody.partial(), req.body);
  await checkTeacher(req.user.schoolId, body.classTeacherId);
  const cls = await assertClassAccess(req.user, req.params.id);
  Object.assign(cls, body);
  await cls.save();
  res.json({ class: cls });
});

// Soft delete: attendance history stays intact.
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const cls = await assertClassAccess(req.user, req.params.id);
  const n = await Student.countDocuments({ classId: cls._id, active: true });
  if (n > 0) throw badRequest(`Move or remove the ${n} students in this class first.`);
  cls.active = false;
  await cls.save();
  res.json({ ok: true });
});

module.exports = router;
