const { Router } = require('express');
const { ClassRoom, Student, Attendance, School } = require('../models');
const { requireRole } = require('../middleware/auth');
const { assertClassAccess } = require('../middleware/access');
const { z, parse, objectId } = require('../utils/validate');
const { monthlyRegister, pct, byGrade, dayPeriod } = require('../services/stats');
const { registerWorkbook, tableWorkbook, send, gradeName } = require('../services/excel');
const { todayIn } = require('../utils/dates');

const router = Router();
router.use(requireRole('admin', 'teacher'));
const monthQ = z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM');
const academicYearStart = (iso) => (Number(iso.slice(5, 7)) >= 6 ? `${iso.slice(0, 4)}-06-01` : `${Number(iso.slice(0, 4)) - 1}-06-01`);

// Monthly register: JSON for the screen (printable), or Excel.
router.get('/register', async (req, res) => {
  const q = parse(z.object({ classId: objectId, month: monthQ, format: z.enum(['json', 'xlsx']).default('json') }), req.query);
  const cls = await assertClassAccess(req.user, q.classId);
  const school = await School.findById(req.user.schoolId);
  const reg = await monthlyRegister(school, cls, q.month);
  if (q.format === 'xlsx') return send(res, await registerWorkbook(reg), `register-${cls.grade}${cls.section}-${q.month}.xlsx`);
  res.json(reg);
});

/** Year-to-date attendance per child, for shortage lists and the SATS summary. */
async function yearSummary(school, { classIds, from, to }) {
  const classes = (await ClassRoom.find({ schoolId: school._id, active: true, ...(classIds ? { _id: { $in: classIds } } : {}) })).sort(byGrade);
  const periodOf = new Map(classes.map((c) => [String(c._id), dayPeriod(c)]));
  const [students, rows] = await Promise.all([
    Student.find({ classId: { $in: classes.map((c) => c._id) }, active: true }).select('name rollNo classId satsId admissionNo parentIds').populate('parentIds', 'name phone'),
    Attendance.aggregate([
      { $match: { schoolId: school._id, classId: { $in: classes.map((c) => c._id) }, date: { $gte: from, $lte: to }, period: { $in: [0, 1] } } },
      { $group: { _id: { s: '$studentId', c: '$classId', p: '$period', st: '$status' }, n: { $sum: 1 } } },
    ]),
  ]);
  const t = new Map();
  rows.forEach((r) => {
    if (r._id.p !== periodOf.get(String(r._id.c))) return;
    const k = String(r._id.s);
    if (!t.has(k)) t.set(k, { P: 0, A: 0, L: 0, LV: 0 });
    t.get(k)[r._id.st] += r.n;
  });
  const clsOf = new Map(classes.map((c) => [String(c._id), c]));
  return students
    .map((s) => {
      const x = t.get(String(s._id)) || { P: 0, A: 0, L: 0, LV: 0 };
      const days = x.P + x.A + x.L + x.LV;
      const c = clsOf.get(String(s.classId));
      return { student: s, cls: c, present: x.P + x.L, absent: x.A, leave: x.LV, days, pct: pct(x.P + x.L, days) };
    })
    .sort((a, b) => byGrade(a.cls, b.cls) || (a.student.rollNo || 0) - (b.student.rollNo || 0));
}

// Children below the threshold this academic year (e.g. 75% before exams).
router.get('/shortage', async (req, res) => {
  const school = await School.findById(req.user.schoolId);
  const q = parse(z.object({ threshold: z.coerce.number().min(1).max(100).optional(), format: z.enum(['json', 'xlsx']).default('json') }), req.query);
  const threshold = q.threshold ?? school.alertThreshold;
  const to = todayIn(school.timezone);
  const classIds = req.user.role === 'admin' ? null : await ClassRoom.find({ classTeacherId: req.user._id }).distinct('_id');
  const list = (await yearSummary(school, { classIds, from: academicYearStart(to), to })).filter((r) => r.days >= 10 && r.pct < threshold);
  if (q.format === 'xlsx') {
    const wb = await tableWorkbook('Shortage', [
      { header: 'Class', key: 'cls', width: 10 }, { header: 'Roll', key: 'roll', width: 6 }, { header: 'Name', key: 'name', width: 24 },
      { header: 'Days', key: 'days', width: 8 }, { header: 'Present', key: 'present', width: 9 }, { header: '%', key: 'pct', width: 7 },
      { header: 'Parent', key: 'parent', width: 18 }, { header: 'Phone', key: 'phone', width: 13 },
    ], list.map((r) => ({
      cls: `${gradeName(r.cls.grade)} ${r.cls.section}`, roll: r.student.rollNo, name: r.student.name, days: r.days, present: r.present, pct: r.pct,
      parent: r.student.parentIds[0]?.name, phone: r.student.parentIds[0]?.phone,
    })));
    return send(res, wb, `shortage-below-${threshold}-${to}.xlsx`);
  }
  res.json({
    threshold, from: academicYearStart(to), to,
    students: list.map((r) => ({
      _id: r.student._id, name: r.student.name, rollNo: r.student.rollNo, class: { _id: r.cls._id, grade: r.cls.grade, section: r.cls.section },
      days: r.days, present: r.present, absent: r.absent, leave: r.leave, pct: r.pct, parent: r.student.parentIds[0] ? { name: r.student.parentIds[0].name, phone: r.student.parentIds[0].phone } : null,
    })),
  });
});

/**
 * Month summary per child keyed by SATS ID, to copy into the state system.
 * The exact SATS upload layout is not public; this file has the fields SATS asks for
 * (SATS ID, name, class, working days, days present) in one row per child.
 */
router.get('/sats', requireRole('admin'), async (req, res) => {
  const school = await School.findById(req.user.schoolId);
  const q = parse(z.object({ month: monthQ, format: z.enum(['xlsx', 'csv']).default('xlsx') }), req.query);
  const list = await yearSummary(school, { from: `${q.month}-01`, to: `${q.month}-31` });
  const rows = list.map((r) => ({
    sats: r.student.satsId || '', name: r.student.name, adm: r.student.admissionNo, grade: r.cls.grade, section: r.cls.section,
    working: r.days, present: r.present, pct: r.pct ?? '',
  }));
  const cols = [
    { header: 'SATS ID', key: 'sats', width: 12 }, { header: 'Student name', key: 'name', width: 24 }, { header: 'Admission no', key: 'adm', width: 13 },
    { header: 'Class', key: 'grade', width: 7 }, { header: 'Section', key: 'section', width: 8 }, { header: 'Working days', key: 'working', width: 13 },
    { header: 'Days present', key: 'present', width: 13 }, { header: 'Attendance %', key: 'pct', width: 13 },
  ];
  if (q.format === 'csv') {
    const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
    res.type('text/csv').attachment(`sats-attendance-${q.month}.csv`);
    return res.send([cols.map((c) => c.header).join(','), ...rows.map((r) => cols.map((c) => esc(r[c.key] ?? '')).join(','))].join('\n'));
  }
  return send(res, await tableWorkbook(`SATS ${q.month}`, cols, rows), `sats-attendance-${q.month}.xlsx`);
});

module.exports = router;
