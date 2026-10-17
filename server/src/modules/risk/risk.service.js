const { ACTIVE } = require('../../shared/schoolStatus');
const { Attendance, ClassRoom, Student, RiskFlag, User, School } = require('../../models');
const { notify } = require('../notifications/notify.service');
const { todayIn, nowTimeIn } = require('../../shared/dates');
const { notFound, forbidden } = require('../../shared/errors');
const { pct, dayPeriod, academicYearStart } = require('../../shared/attendanceRules');

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
  for (const school of await School.find(ACTIVE)) {
    const today = todayIn(school.timezone, now);
    if (school.riskEvaluatedOn === today) continue;
    if (school.riskEvaluatedOn && nowTimeIn(school.timezone, now) < '17:00') continue;
    await evaluateRisk(school, today, { log });
  }
}

// A teacher sees flags for the classes they lead; the headmaster (null) sees all.
async function visibleClassIds(user) {
  if (user.role === 'admin') return null;
  return ClassRoom.find({ classTeacherId: user._id, active: true }).distinct('_id');
}

async function listFlags(user, { classId, active }) {
  const filter = { schoolId: user.schoolId, active };
  const mine = await visibleClassIds(user);
  if (mine) filter.classId = { $in: mine };
  if (classId) filter.classId = mine && !mine.some((m) => String(m) === classId) ? null : classId;
  const [flags, school] = await Promise.all([
    RiskFlag.find(filter)
      .populate({ path: 'studentId', select: 'name rollNo parentIds', populate: { path: 'parentIds', select: 'name phone' } })
      .populate('classId', 'grade section')
      .populate('followUps.by', 'name')
      .limit(300),
    School.findById(user.schoolId),
  ]);
  // Longest streak first, then lowest attendance.
  flags.sort((a, b) => (b.streak || 0) - (a.streak || 0) || (a.monthPct ?? a.yearPct ?? 100) - (b.monthPct ?? b.yearPct ?? 100));
  return { flags, evaluatedOn: school.riskEvaluatedOn, rules: { streak: school.consecutiveAbsenceAlert, threshold: school.alertThreshold } };
}

// Record what was done: called the parent, visited the home, sent a message.
async function addFollowUp(user, flagId, body) {
  const flag = await RiskFlag.findOne({ _id: flagId, schoolId: user.schoolId });
  if (!flag) throw notFound('Follow-up');
  const mine = await visibleClassIds(user);
  if (mine && !mine.some((m) => String(m) === String(flag.classId))) throw forbidden('This child is not in your class.');
  flag.followUps.push({ ...body, by: user._id });
  await flag.save();
  await flag.populate('followUps.by', 'name');
  return { flag };
}

async function refreshNow(admin) {
  return evaluateRisk(await School.findById(admin.schoolId));
}

module.exports = { evaluateRisk, runDailyRisk, listFlags, addFollowUp, refreshNow };
