const { Attendance, PickupLog, Student, School, User, AuditLog } = require('../../models');
const { assertClassAccess, assertStudentAccess } = require('../../middleware/access');
const { todayIn, nowTimeIn } = require('../../shared/dates');
const { badRequest, forbidden, HttpError } = require('../../shared/errors');
const { notify } = require('../notifications/notify.service');
const { verifyPass } = require('./pickup.pass');

const PASS_ERRORS = {
  not_a_pass: 'This QR code is not a Haajari pickup pass.',
  expired: 'This pickup pass has expired. Ask the parent to open today’s pass.',
};

// The pickup board: who arrived, who has gone home, and who may collect each child.
async function board(user, classId) {
  const cls = await assertClassAccess(user, classId);
  const school = await School.findById(user.schoolId);
  const date = todayIn(school.timezone);
  const [students, marks, logs] = await Promise.all([
    Student.find({ classId: cls._id, active: true }).select('name rollNo gender pickupGuardians').sort({ rollNo: 1 }),
    Attendance.find({ classId: cls._id, date, period: 0 }).select('studentId status markedAt reason reasonBy source'),
    PickupLog.find({ studentId: { $in: await Student.find({ classId: cls._id }).distinct('_id') }, date }),
  ]);
  const markOf = new Map(marks.map((m) => [String(m.studentId), m]));
  const logOf = new Map(logs.map((l) => [String(l.studentId), l]));
  return {
    date,
    pickupTime: school.pickupTime,
    class: { _id: cls._id, grade: cls.grade, section: cls.section },
    students: students.map((s) => ({ ...s.toObject(), mark: markOf.get(String(s._id)) || null, pickup: logOf.get(String(s._id)) || null })),
  };
}

// Reads a scanned QR pass: which child, and which guardian is collecting.
function readPass(passToken, expectedStudentId) {
  let pass;
  try {
    pass = verifyPass(passToken);
  } catch (e) {
    throw badRequest(PASS_ERRORS[e.message] || 'This pickup pass is not valid. Do not hand over; call the parent.');
  }
  if (expectedStudentId && expectedStudentId !== pass.sid) throw badRequest('This pass belongs to a different child.');
  return { studentId: pass.sid, guardianId: pass.gid };
}

/**
 * Hand a child over. Either the teacher picks the guardian from the photo list (manual),
 * or scans the parent's QR pass, which names the guardian and is checked here.
 */
async function checkout(user, { studentId: sid, guardianId: gid, passToken }) {
  const fromPass = passToken ? readPass(passToken, sid) : null;
  const studentId = fromPass?.studentId || sid;
  const guardianId = fromPass?.guardianId || gid;
  if (!studentId || !guardianId) throw badRequest('Choose who is collecting the child.');

  const student = await assertStudentAccess(user, studentId);
  const guardian = student.pickupGuardians.id(guardianId);
  if (!guardian) throw forbidden('This person is not on the list of people allowed to collect the child.');
  const school = await School.findById(user.schoolId);
  const date = todayIn(school.timezone);
  const mark = await Attendance.findOne({ studentId, date, period: 0 });
  if (!mark || !['P', 'L'].includes(mark.status)) throw badRequest('This child was not checked in today.');
  const existing = await PickupLog.findOne({ studentId, date });
  if (existing?.checkOutAt) throw new HttpError(409, 'already_picked_up', `Already picked up by ${existing.collectedBy?.name}.`);

  const log = await PickupLog.findOneAndUpdate(
    { studentId, date },
    { $set: { schoolId: school._id, checkOutAt: new Date(), checkOutBy: user._id, collectedBy: { name: guardian.name, relation: guardian.relation, guardianId: guardian._id }, method: fromPass ? 'qr' : 'manual' } },
    { upsert: true, new: true }
  );
  const time = nowTimeIn(school.timezone);
  const parents = await User.find({ _id: { $in: student.parentIds }, active: true });
  await Promise.all(parents.map((p) => notify(p, 'picked_up', { studentName: student.name, by: guardian.name, relation: guardian.relation, time, key: `${studentId}:${date}` }, { url: `/p/child/${studentId}` })));
  return { pickup: log, student: { _id: student._id, name: student.name }, guardian };
}

// Undo a hand-over tapped by mistake. Logged, because pickup is a safety record.
async function undoCheckout(user, studentId) {
  await assertStudentAccess(user, studentId);
  const school = await School.findById(user.schoolId);
  const log = await PickupLog.findOne({ studentId, date: todayIn(school.timezone) });
  if (!log?.checkOutAt) throw badRequest('This child has not been handed over.');
  await AuditLog.create({ schoolId: school._id, entity: 'pickup', entityId: log._id, action: 'undo', changedBy: user._id, from: log.collectedBy });
  log.checkOutAt = undefined;
  log.collectedBy = undefined;
  log.method = undefined;
  await log.save();
  return { ok: true };
}

module.exports = { board, checkout, undoCheckout };
