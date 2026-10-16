const { Attendance, ClassRoom, Student, RiskFlag, User, School } = require('../models');
const { notify } = require('../services/notify');
const { todayIn, nowTimeIn } = require('../utils/dates');
const { pct, dayPeriod } = require('../services/stats');

const academicYearStart = (iso) => (Number(iso.slice(5, 7)) >= 6 ? `${iso.slice(0, 4)}-06-01` : `${Number(iso.slice(0, 4)) - 1}-06-01`);
const MIN_MONTH_DAYS = 5; // too few marked days says nothing about a child
const MIN_YEAR_DAYS = 10;

/**
 * Finds children who need follow-up (research issue #10; Delhi's early-warning
 * programme flagged 7+ days in a row or very low attendance). Here the rules come
 * from school settings: `consecutiveAbsenceAlert` days in a row, or below `alertThreshold` %.
 * Leave breaks a streak: the school was told.
 */
async function evaluateRisk(school, today = todayIn(school.timezone), { log = () => {} } = {}) {
  const classes = await ClassRoom.find({ schoolId: school._id, active: true });
  const periodOf = new Map(classes.map((c) => [String(c._id), dayPeriod(c)]));
  const [students, marks, open] = await Promise.all([
    Student.find({ schoolId: school._id, active: true }).select('name classId'),
    Attendance.find({ schoolId: school._id, date: { $gte: academicYearStart(today), $lte: today }, period: { $in: [0, 1] } }).select('studentId classId date period status').sort({ date: -1 }),
    RiskFlag.find({ schoolId: school._id, active: true }),
  ]);
  const byStudent = new Map();
  marks.forEach((m) => {
    if (m.period !== periodOf.get(String(m.classId))) return;
    const k = String(m.studentId);
    if (!byStudent.has(k)) byStudent.set(k, []);
    byStudent.get(k).push(m);
  });
  const openOf = new Map(open.map((f) => [String(f.studentId), f]));
  const month = today.slice(0, 7);
  let flagged = 0;
  let resolved = 0;

  for (const s of students) {
    const recs = byStudent.get(String(s._id)) || []; // newest first
    let streak = 0;
    for (const r of recs) { if (r.status === 'A') streak += 1; else break; }
    const lastPresent = recs.find((r) => r.status === 'P' || r.status === 'L')?.date || null;
    const monthRecs = recs.filter((r) => r.date.startsWith(month));
    const count = (list) => list.filter((r) => r.status === 'P' || r.status === 'L').length;
    const monthPct = monthRecs.length >= MIN_MONTH_DAYS ? pct(count(monthRecs), monthRecs.length) : null;
    const yearPct = recs.length >= MIN_YEAR_DAYS ? pct(count(recs), recs.length) : null;
    const reasons = [];
    if (streak >= school.consecutiveAbsenceAlert) reasons.push('streak');
    if (monthPct !== null && monthPct < school.alertThreshold) reasons.push('low_month');
    if (yearPct !== null && yearPct < school.alertThreshold) reasons.push('low_year');

    const existing = openOf.get(String(s._id));
    if (!reasons.length) {
      if (existing) { existing.active = false; existing.evaluatedOn = today; await existing.save(); resolved += 1; }
      continue;
    }
    const stats = { reasons, streak, monthPct, yearPct, lastPresent, evaluatedOn: today, classId: s.classId };
    if (existing) { Object.assign(existing, stats); await existing.save(); continue; }
    await RiskFlag.create({ schoolId: school._id, studentId: s._id, since: today, ...stats });
    flagged += 1;
    const cls = classes.find((c) => String(c._id) === String(s.classId));
    const teacher = cls?.classTeacherId && (await User.findById(cls.classTeacherId));
    if (teacher) await notify(teacher, 'at_risk', { studentName: s.name, streak, pct: monthPct ?? yearPct, key: `${s._id}:${today}` }, { url: '/t/at-risk' });
  }
  await School.updateOne({ _id: school._id }, { $set: { riskEvaluatedOn: today } });
  log(`At-risk check ${today}: ${flagged} new, ${resolved} resolved`);
  return { flagged, resolved };
}

/** Runs once a day after school (17:00), and once at start-up if it has never run. */
async function runDailyRisk({ now = new Date(), log } = {}) {
  for (const school of await School.find()) {
    const today = todayIn(school.timezone, now);
    if (school.riskEvaluatedOn === today) continue;
    if (school.riskEvaluatedOn && nowTimeIn(school.timezone, now) < '17:00') continue;
    await evaluateRisk(school, today, { log });
  }
}

module.exports = { evaluateRisk, runDailyRisk };
