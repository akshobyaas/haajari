const { Router } = require('express');
const { LeaveRequest, Student, School, User, ClassRoom } = require('../models');
const { z, parse, objectId, isoDate } = require('../utils/validate');
const { assertStudentAccess } = require('../middleware/access');
const { todayIn, daysBetween } = require('../utils/dates');
const { badRequest, forbidden, notFound } = require('../utils/errors');
const { applyLeave } = require('../services/leave');
const { notify } = require('../services/notify');

const router = Router();

// Parent asks for leave (in advance, or for days just missed).
router.post('/', async (req, res) => {
  if (req.user.role !== 'parent') throw forbidden('Parents apply for leave from their own app.');
  const body = parse(z.object({ studentId: objectId, from: isoDate, to: isoDate, reason: z.string().trim().min(3, 'Write a short reason').max(300) }), req.body);
  const student = await assertStudentAccess(req.user, body.studentId);
  const school = await School.findById(req.user.schoolId);
  if (body.to < body.from) throw badRequest('The last day is before the first day.');
  if (daysBetween(body.from, body.to) > 30) throw badRequest('Leave can be at most 31 days. Talk to the class teacher for longer.');
  if (daysBetween(body.from, todayIn(school.timezone)) > school.teacherBackdateDays) throw badRequest(`Leave can start at most ${school.teacherBackdateDays} days ago.`);
  const leave = await LeaveRequest.create({ ...body, schoolId: req.user.schoolId, requestedBy: req.user._id });
  const cls = await ClassRoom.findById(student.classId);
  const teacher = cls?.classTeacherId && (await User.findById(cls.classTeacherId));
  if (teacher) await notify(teacher, 'leave_request', { studentName: student.name, from: body.from, to: body.to, key: String(leave._id) }, { url: '/t/leave' });
  res.status(201).json({ leave });
});

router.get('/', async (req, res) => {
  const q = parse(z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional(), studentId: objectId.optional() }), req.query);
  const filter = { schoolId: req.user.schoolId, ...(q.status ? { status: q.status } : {}) };
  if (req.user.role === 'parent') {
    const mine = await Student.find({ parentIds: req.user._id }).distinct('_id');
    filter.studentId = q.studentId ? (mine.some((m) => String(m) === q.studentId) ? q.studentId : null) : { $in: mine };
  } else if (req.user.role === 'teacher') {
    // Class teachers decide leave for their own class.
    const led = await ClassRoom.find({ classTeacherId: req.user._id }).distinct('_id');
    const kids = await Student.find({ classId: { $in: led } }).distinct('_id');
    filter.studentId = q.studentId ? (kids.some((k) => String(k) === q.studentId) ? q.studentId : null) : { $in: kids };
  } else if (q.studentId) filter.studentId = q.studentId;
  const leaves = await LeaveRequest.find(filter)
    .sort({ status: -1, from: -1 })
    .limit(100)
    .populate({ path: 'studentId', select: 'name rollNo classId', populate: { path: 'classId', select: 'grade section' } })
    .populate('requestedBy', 'name phone')
    .populate('decidedBy', 'name');
  res.json({ leaves });
});

router.patch('/:id', async (req, res) => {
  const body = parse(z.object({ decision: z.enum(['approved', 'rejected']) }), req.body);
  const leave = await LeaveRequest.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!leave) throw notFound('Leave request');
  const student = await Student.findById(leave.studentId);
  if (req.user.role === 'teacher') {
    const cls = await ClassRoom.findById(student.classId);
    if (String(cls.classTeacherId) !== String(req.user._id)) throw forbidden('Only the class teacher or headmaster can decide leave.');
  } else if (req.user.role !== 'admin') throw forbidden();
  if (leave.status !== 'pending') throw badRequest(`This request was already ${leave.status}.`);
  leave.status = body.decision;
  leave.decidedBy = req.user._id;
  leave.decidedAt = new Date();
  await leave.save();
  const marked = body.decision === 'approved' ? await applyLeave(leave, req.user) : 0;
  const parent = await User.findById(leave.requestedBy);
  if (parent) await notify(parent, 'leave_decision', { studentName: student.name, from: leave.from, to: leave.to, approved: body.decision === 'approved', key: String(leave._id) }, { url: `/p/child/${student._id}` });
  res.json({ leave, daysMarked: marked });
});

// A parent can withdraw a request the teacher has not decided yet.
router.delete('/:id', async (req, res) => {
  const leave = await LeaveRequest.findOne({ _id: req.params.id, requestedBy: req.user._id });
  if (!leave) throw notFound('Leave request');
  if (leave.status !== 'pending') throw badRequest('Only a pending request can be withdrawn.');
  await leave.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
