const { Attendance, ClassRoom, Student, PickupLog } = require('../models');
const { addDays, closedReason } = require('../utils/dates');

const dayPeriod = (cls) => (cls.mode === 'period' ? 1 : 0);
const pct = (present, total) => (total ? Math.round((present / total) * 1000) / 10 : null);
const GRADE_ORDER = ['PREKG', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const byGrade = (a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade) || a.section.localeCompare(b.section);

/** The day's register for the whole school, class by class. One query per collection. */
async function dayOverview(school, date) {
  const classes = (await ClassRoom.find({ schoolId: school._id, active: true }).populate('classTeacherId', 'name phone')).sort(byGrade);
  const [students, marks, pickups] = await Promise.all([
    Student.find({ schoolId: school._id, active: true }).select('name rollNo classId parentIds').populate('parentIds', 'phone'),
    Attendance.find({ schoolId: school._id, date, period: { $in: [0, 1] } }).select('studentId classId period status source'),
    PickupLog.find({ schoolId: school._id, date, checkOutAt: { $ne: null } }).select('studentId'),
  ]);
  const gone = new Set(pickups.map((p) => String(p.studentId)));
  const markOf = new Map();
  const classOf = new Map(classes.map((c) => [String(c._id), c]));
  marks.forEach((m) => {
    const cls = classOf.get(String(m.classId));
    if (cls && m.period === dayPeriod(cls)) markOf.set(String(m.studentId), m);
  });
  const rows = classes.map((c) => {
    const kids = students.filter((s) => String(s.classId) === String(c._id));
    const t = { P: 0, A: 0, L: 0, LV: 0, unmarked: 0, teacherMarked: 0 };
    const inSchool = [];
    kids.forEach((s) => {
      const m = markOf.get(String(s._id));
      if (!m) { t.unmarked += 1; return; }
      t[m.status] += 1;
      if (m.source !== 'leave') t.teacherMarked += 1;
      if ((m.status === 'P' || m.status === 'L') && !gone.has(String(s._id))) inSchool.push({ _id: s._id, name: s.name, rollNo: s.rollNo });
    });
    const marked = t.teacherMarked > 0;
    return {
      _id: c._id, grade: c.grade, section: c.section, mode: c.mode,
      teacher: c.classTeacherId ? { name: c.classTeacherId.name, phone: c.classTeacherId.phone } : null,
      total: kids.length, marked, ...t,
      present: t.P + t.L,
      pct: marked ? pct(t.P + t.L, t.P + t.L + t.A + t.LV) : null,
      goneHome: kids.filter((s) => gone.has(String(s._id))).length,
      inSchool,
      meal: school.mealGrades.includes(c.grade),
    };
  });
  const markedRows = rows.filter((r) => r.marked);
  const sum = (k, list = rows) => list.reduce((a, r) => a + r[k], 0);
  return {
    date,
    closed: closedReason(school, date),
    totals: {
      students: sum('total'),
      classes: rows.length,
      marked: markedRows.length,
      present: sum('present', markedRows),
      absent: sum('A', markedRows),
      leave: sum('LV', markedRows),
      late: sum('L', markedRows),
      inSchool: rows.reduce((a, r) => a + r.inSchool.length, 0),
      pct: pct(sum('present', markedRows), sum('present', markedRows) + sum('A', markedRows) + sum('LV', markedRows)),
      // PM POSHAN: plates to cook = children present in meal classes.
      meals: rows.filter((r) => r.meal && r.marked).reduce((a, r) => a + r.present, 0),
      mealClassesUnmarked: rows.filter((r) => r.meal && !r.marked).length,
    },
    classes: rows,
  };
}

/** School-wide % present for each of the last `days` school days. */
async function trend(school, today, days = 30) {
  const dates = [];
  for (let d = today; dates.length < days; d = addDays(d, -1)) if (!closedReason(school, d)) dates.push(d);
  const from = dates.at(-1);
  const rows = await Attendance.aggregate([
    { $match: { schoolId: school._id, date: { $gte: from, $lte: today }, period: { $in: [0, 1] } } },
    { $group: { _id: { date: '$date', period: '$period', classId: '$classId', status: '$status' }, n: { $sum: 1 } } },
  ]);
  const periodClasses = new Set((await ClassRoom.find({ schoolId: school._id, mode: 'period' }).distinct('_id')).map(String));
  const byDate = {};
  rows.forEach((r) => {
    if (r._id.period !== (periodClasses.has(String(r._id.classId)) ? 1 : 0)) return;
    const d = (byDate[r._id.date] ||= { P: 0, A: 0, L: 0, LV: 0 });
    d[r._id.status] += r.n;
  });
  return dates.reverse().filter((d) => byDate[d]).map((d) => {
    const x = byDate[d];
    return { date: d, pct: pct(x.P + x.L, x.P + x.L + x.A + x.LV), present: x.P + x.L, absent: x.A };
  });
}

/**
 * The monthly register for one class, laid out like the paper register:
 * a row per child, a column per day, totals per child and per day.
 */
async function monthlyRegister(school, cls, month) {
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const days = Array.from({ length: last }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    return { date, day: i + 1, closed: closedReason(school, date) };
  });
  const [students, marks] = await Promise.all([
    Student.find({ classId: cls._id }).select('name rollNo admissionNo satsId active').sort({ rollNo: 1, name: 1 }),
    Attendance.find({ classId: cls._id, period: dayPeriod(cls), date: { $gte: `${month}-01`, $lte: `${month}-31` } }).select('studentId date status'),
  ]);
  const grid = new Map(); // studentId -> date -> status
  marks.forEach((m) => {
    const k = String(m.studentId);
    if (!grid.has(k)) grid.set(k, {});
    grid.get(k)[m.date] = m.status;
  });
  // Working days = open days on which the register was taken for this class.
  const takenDays = new Set(marks.map((m) => m.date));
  const workingDays = days.filter((d) => !d.closed && takenDays.has(d.date)).map((d) => d.date);
  const rows = students
    .filter((s) => s.active || grid.has(String(s._id)))
    .map((s) => {
      const g = grid.get(String(s._id)) || {};
      const t = { P: 0, A: 0, L: 0, LV: 0 };
      workingDays.forEach((d) => { if (g[d]) t[g[d]] += 1; });
      const present = t.P + t.L;
      return {
        _id: s._id, rollNo: s.rollNo, name: s.name, admissionNo: s.admissionNo, satsId: s.satsId,
        marks: g, ...t, present, workingDays: workingDays.length, pct: pct(present, workingDays.length),
      };
    });
  const daily = days.map((d) => {
    const c = { P: 0, A: 0, L: 0, LV: 0 };
    rows.forEach((r) => { if (r.marks[d.date]) c[r.marks[d.date]] += 1; });
    return { date: d.date, present: c.P + c.L, absent: c.A, leave: c.LV, marked: c.P + c.L + c.A + c.LV };
  });
  const totals = {
    workingDays: workingDays.length,
    presentDays: rows.reduce((a, r) => a + r.present, 0),
    absentDays: rows.reduce((a, r) => a + r.A, 0),
    leaveDays: rows.reduce((a, r) => a + r.LV, 0),
    students: rows.length,
  };
  totals.pct = pct(totals.presentDays, totals.presentDays + totals.absentDays + totals.leaveDays);
  totals.averageDaily = workingDays.length ? Math.round((totals.presentDays / workingDays.length) * 10) / 10 : null;
  return { class: { _id: cls._id, grade: cls.grade, section: cls.section }, month, days, rows, daily, totals, school: { name: school.name, udiseCode: school.udiseCode, academicYear: school.academicYear } };
}

module.exports = { dayOverview, trend, monthlyRegister, pct, byGrade, dayPeriod };
