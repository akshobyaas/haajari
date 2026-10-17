const { Student, Attendance, PickupLog, School, LeaveRequest, ClassRoom, User } = require('../../models');
const { assertStudentAccess } = require('../../middleware/access');
const { todayIn, addDays } = require('../../shared/dates');
const { dayPeriod, academicYearStart, tally } = require('../../shared/attendanceRules');
const { badRequest, notFound, forbidden } = require('../../shared/errors');
const { signPass } = require('../pickup/pickup.pass');
const { notify } = require('../notifications/notify.service');
const { verify } = require('../../shared/token');
const { unauthorized } = require('../../shared/errors');

// Parent home: each child with today's status and pickup.
async function listChildren(parent) {
  const school = await School.findById(parent.schoolId);
  const today = todayIn(school.timezone);
  const children = await Student.find({ parentIds: parent._id, active: true })
    .select('name admissionNo rollNo photoUrl classId pickupGuardians')
    .populate({ path: 'classId', select: 'grade section mode classTeacherId', populate: { path: 'classTeacherId', select: 'name phone' } });
  const out = await Promise.all(children.map(async (c) => {
    const [mark, pickup] = await Promise.all([
      Attendance.findOne({ studentId: c._id, date: today, period: dayPeriod(c.classId) }).select('status reason reasonBy markedAt alertedAt source'),
      PickupLog.findOne({ studentId: c._id, date: today }).select('checkOutAt collectedBy'),
    ]);
    return { ...c.toObject(), today: { date: today, mark, pickup } };
  }));
  return { date: today, children: out };
}

// One child's month: day-by-day calendar plus month and year percentages.
async function childMonth(parent, studentId, month) {
  const student = await assertStudentAccess(parent, studentId);
  const [cls, school] = await Promise.all([ClassRoom.findById(student.classId), School.findById(parent.schoolId)]);
  const today = todayIn(school.timezone);
  const m = month || today.slice(0, 7);
  const period = dayPeriod(cls);
  const [monthRows, yearRows, leaves] = await Promise.all([
    Attendance.find({ studentId: student._id, period, date: { $gte: `${m}-01`, $lte: `${m}-31` } }).select('date status reason reasonBy alertedAt').sort({ date: 1 }),
    Attendance.find({ studentId: student._id, period, date: { $gte: academicYearStart(today), $lte: today } }).select('status'),
    LeaveRequest.find({ studentId: student._id }).sort({ from: -1 }).limit(20).populate('decidedBy', 'name'),
  ]);
  return {
    today,
    month: m,
    holidays: school.holidays.filter((h) => h.date.startsWith(m)),
    days: monthRows,
    monthStats: tally(monthRows),
    yearStats: tally(yearRows),
    threshold: school.alertThreshold,
    leaves,
  };
}

/**
 * Records why a child was absent ("Sick", ...) and tells the class teacher.
 * Used from the app and from the one-tap notification reply (public module).
 */
async function recordParentReason(rec, parent, code, note) {
  if (rec.status !== 'A') throw badRequest('This day is no longer marked absent.');
  rec.reason = note ? `${code}: ${note}` : code;
  rec.reasonBy = 'parent';
  rec.reasonAt = new Date();
  await rec.save();
  const [student, cls] = await Promise.all([Student.findById(rec.studentId), ClassRoom.findById(rec.classId)]);
  const teacher = cls?.classTeacherId && (await User.findById(cls.classTeacherId));
  if (teacher) await notify(teacher, 'absence_reason', { studentName: student.name, code, note, key: String(rec._id) }, { url: `/t/class/${cls._id}/mark?date=${rec.date}` });
  return { ok: true, attendance: { _id: rec._id, reason: rec.reason, reasonBy: rec.reasonBy } };
}

async function answerAbsence(parent, attendanceId, { reason, note }) {
  const rec = await Attendance.findById(attendanceId);
  if (!rec) throw notFound('Absence');
  await assertStudentAccess(parent, rec.studentId);
  return recordParentReason(rec, parent, reason, note);
}

async function setGuardians(parent, studentId, guardians) {
  const student = await assertStudentAccess(parent, studentId);
  student.pickupGuardians = guardians.map((g) => ({ ...g, phone: g.phone || undefined, photoUrl: g.photoUrl || undefined }));
  await student.save();
  return { guardians: student.pickupGuardians };
}

// QR pickup pass for today, naming the person who will collect the child.
async function pickupPass(parent, studentId, guardianId) {
  const student = await assertStudentAccess(parent, studentId);
  const guardian = student.pickupGuardians.id(guardianId);
  if (!guardian) throw forbidden('Add this person to the pickup list first.');
  const school = await School.findById(parent.schoolId);
  // Valid until midnight, school time (IST is UTC+5:30 with no daylight saving).
  const expiresAt = Date.parse(`${addDays(todayIn(school.timezone), 1)}T00:00:00+05:30`);
  return {
    qr: signPass({ studentId: student._id, guardianId, expiresAt }),
    expiresAt,
    guardian: { _id: guardian._id, name: guardian.name, relation: guardian.relation },
  };
}

/**
 * One-tap answer from the notification itself (e.g. "Sick"). The notification carries a
 * signed token naming this absence and this parent, so no login is needed.
 */
async function answerFromNotification(token, reason) {
  let t;
  try { t = verify(token); } catch { throw unauthorized('This link has expired. Open the app to reply.'); }
  if (t.purpose !== 'absence-reply') throw unauthorized();
  const [rec, parent] = await Promise.all([Attendance.findById(t.aid), User.findById(t.uid)]);
  if (!rec || !parent) throw notFound('Absence');
  return recordParentReason(rec, parent, reason);
}

module.exports = { listChildren, childMonth, answerAbsence, answerFromNotification, setGuardians, pickupPass };
