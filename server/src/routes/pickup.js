const { Router } = require('express');
const { Attendance, PickupLog, Student, School, User, AuditLog } = require('../models');
const { z, parse, objectId } = require('../utils/validate');
const { requireRole } = require('../middleware/auth');
const { assertClassAccess, assertStudentAccess } = require('../middleware/access');
const { todayIn, nowTimeIn } = require('../utils/dates');
const { verifyPass } = require('../utils/pass');
const { badRequest, forbidden, HttpError } = require('../utils/errors');
const { notify } = require('../services/notify');

const router = Router();
router.use(requireRole('admin', 'teacher'));

// The pickup board: who arrived, who has gone home, and who may collect each child.
router.get('/class/:id/today', async (req, res) => {
  const cls = await assertClassAccess(req.user, req.params.id);
  const school = await School.findById(req.user.schoolId);
  const date = todayIn(school.timezone);
  const [students, marks, logs] = await Promise.all([
    Student.find({ classId: cls._id, active: true }).select('name rollNo gender pickupGuardians').sort({ rollNo: 1 }),
    Attendance.find({ classId: cls._id, date, period: 0 }).select('studentId status markedAt reason reasonBy source'),
    PickupLog.find({ studentId: { $in: await Student.find({ classId: cls._id }).distinct('_id') }, date }),
  ]);
  const markOf = new Map(marks.map((m) => [String(m.studentId), m]));
  const logOf = new Map(logs.map((l) => [String(l.studentId), l]));
  res.json({
    date,
    pickupTime: school.pickupTime,
    class: { _id: cls._id, grade: cls.grade, section: cls.section },
    students: students.map((s) => ({ ...s.toObject(), mark: markOf.get(String(s._id)) || null, pickup: logOf.get(String(s._id)) || null })),
  });
});

/**
 * Hand a child over. Either the teacher picks the guardian from the photo list (manual),
 * or scans the parent's QR pass, which names the guardian and is checked here.
 */
router.post('/checkout', async (req, res) => {
  const body = parse(z.object({ studentId: objectId.optional(), guardianId: objectId.optional(), passToken: z.string().optional() }), req.body);
  let studentId = body.studentId;
  let guardianId = body.guardianId;
  let method = 'manual';
  if (body.passToken) {
    let pass;
    try {
      pass = verifyPass(body.passToken);
    } catch (e) {
      throw badRequest({
        not_a_pass: 'This QR code is not a Haajari pickup pass.',
        expired: 'This pickup pass has expired. Ask the parent to open today’s pass.',
      }[e.message] || 'This pickup pass is not valid. Do not hand over; call the parent.');
    }
    if (studentId && studentId !== pass.sid) throw badRequest('This pass belongs to a different child.');
    studentId = pass.sid;
    guardianId = pass.gid;
    method = 'qr';
  }
  if (!studentId || !guardianId) throw badRequest('Choose who is collecting the child.');
  const student = await assertStudentAccess(req.user, studentId);
  const guardian = student.pickupGuardians.id(guardianId);
  if (!guardian) throw forbidden('This person is not on the list of people allowed to collect the child.');
  const school = await School.findById(req.user.schoolId);
  const date = todayIn(school.timezone);
  const mark = await Attendance.findOne({ studentId, date, period: 0 });
  if (!mark || !['P', 'L'].includes(mark.status)) throw badRequest('This child was not checked in today.');
  const existing = await PickupLog.findOne({ studentId, date });
  if (existing?.checkOutAt) throw new HttpError(409, 'already_picked_up', `Already picked up by ${existing.collectedBy?.name}.`);
  const log = await PickupLog.findOneAndUpdate(
    { studentId, date },
    { $set: { schoolId: school._id, checkOutAt: new Date(), checkOutBy: req.user._id, collectedBy: { name: guardian.name, relation: guardian.relation, guardianId: guardian._id }, method } },
    { upsert: true, new: true }
  );
  const time = nowTimeIn(school.timezone);
  const parents = await User.find({ _id: { $in: student.parentIds }, active: true });
  for (const p of parents) {
    await notify(p, 'picked_up', { studentName: student.name, by: guardian.name, relation: guardian.relation, time, key: `${studentId}:${date}` }, { url: `/p/child/${studentId}` });
  }
  res.json({ pickup: log, student: { _id: student._id, name: student.name }, guardian });
});

// Undo a hand-over tapped by mistake. Logged, because pickup is a safety record.
router.post('/undo', async (req, res) => {
  const body = parse(z.object({ studentId: objectId }), req.body);
  await assertStudentAccess(req.user, body.studentId);
  const school = await School.findById(req.user.schoolId);
  const log = await PickupLog.findOne({ studentId: body.studentId, date: todayIn(school.timezone) });
  if (!log?.checkOutAt) throw badRequest('This child has not been handed over.');
  await AuditLog.create({ schoolId: school._id, entity: 'pickup', entityId: log._id, action: 'undo', changedBy: req.user._id, from: log.collectedBy });
  log.checkOutAt = undefined;
  log.collectedBy = undefined;
  log.method = undefined;
  await log.save();
  res.json({ ok: true });
});

module.exports = router;
