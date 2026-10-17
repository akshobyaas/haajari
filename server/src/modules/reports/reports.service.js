const { ClassRoom, Student, Attendance, School } = require('../../models');
const { assertClassAccess } = require('../../middleware/access');
const { monthlyRegister, byGrade } = require('./stats.service');
const { pct, dayPeriod, academicYearStart } = require('../../shared/attendanceRules');
const { todayIn } = require('../../shared/dates');

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

async function registerFor(user, classId, month) {
  const cls = await assertClassAccess(user, classId);
  const school = await School.findById(user.schoolId);
  return { cls, register: await monthlyRegister(school, cls, month) };
}

// Children below the threshold this academic year (e.g. 75% before exams). Teachers: their classes.
async function shortage(user, threshold) {
  const school = await School.findById(user.schoolId);
  const limit = threshold ?? school.alertThreshold;
  const to = todayIn(school.timezone);
  const from = academicYearStart(to);
  const classIds = user.role === 'admin' ? null : await ClassRoom.find({ classTeacherId: user._id }).distinct('_id');
  const rows = (await yearSummary(school, { classIds, from, to })).filter((r) => r.days >= 10 && r.pct < limit);
  return { threshold: limit, from, to, rows };
}

/**
 * Month summary per child keyed by SATS ID, to copy into the state system.
 * The exact SATS upload layout is not public; this has the fields SATS asks for
 * (SATS ID, name, class, working days, days present) in one row per child.
 */
async function satsMonth(user, month) {
  const school = await School.findById(user.schoolId);
  const list = await yearSummary(school, { from: `${month}-01`, to: `${month}-31` });
  return list.map((r) => ({
    sats: r.student.satsId || '', name: r.student.name, adm: r.student.admissionNo, grade: r.cls.grade, section: r.cls.section,
    working: r.days, present: r.present, pct: r.pct ?? '',
  }));
}

module.exports = { registerFor, shortage, satsMonth };
