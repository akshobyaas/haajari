const { Attendance, AuditLog, ClassRoom, School, LeaveRequest, Student, User } = require('../../models');
const { assertStudentAccess } = require('../../middleware/access');
const { badRequest, forbidden, notFound } = require('../../shared/errors');
const { notify } = require('../notifications/notify.service');
const { addDays, closedReason, todayIn, daysBetween } = require('../../shared/dates');

/**
 * Marks every open school day of an approved leave as LV.
 * Days not yet marked get a leave record; days already marked absent become leave
 * (the parent did inform the school); days the child actually came stay as they are.
 */
async function applyLeave(leave, decidedBy) {
  const [school, student] = await Promise.all([School.findById(leave.schoolId), require('../../models').Student.findById(leave.studentId)]);
  const cls = await ClassRoom.findById(student.classId);
  // Period-wise classes get a leave mark in every period, so no subject teacher starts the child as present.
  const periods = cls.mode === 'period' ? Array.from({ length: Math.max(cls.periodsPerDay || 0, 1) }, (_, i) => i + 1) : [0];
  let changed = 0;
  for (let d = leave.from; d <= leave.to; d = addDays(d, 1)) {
    if (closedReason(school, d)) continue;
    for (const period of periods) {
      const prev = await Attendance.findOne({ studentId: student._id, date: d, period });
      if (!prev) {
        await Attendance.create({
          schoolId: school._id, studentId: student._id, classId: cls._id, date: d, period, status: 'LV',
          reason: leave.reason, reasonBy: 'leave', source: 'leave', markedBy: decidedBy._id, markedAt: new Date(),
        });
        changed += 1;
      } else if (prev.status === 'A') {
        await Attendance.updateOne({ _id: prev._id }, { $set: { status: 'LV', reason: leave.reason, reasonBy: 'leave' } });
        await AuditLog.create({ schoolId: school._id, entity: 'attendance', entityId: prev._id, action: 'update', changedBy: decidedBy._id, from: 'A', to: 'LV', reason: 'Leave approved' });
        changed += 1;
      }
    }
  }
  return changed;
}

// Tells the class teacher about a new request, and the parent about a decision.
async function classTeacherOf(student) {
  const cls = await ClassRoom.findById(student.classId);
  return cls?.classTeacherId ? User.findById(cls.classTeacherId) : null;
}

// Parent asks for leave (in advance, or for days just missed).
async function applyForLeave(parent, body) {
  if (parent.role !== 'parent') throw forbidden('Parents apply for leave from their own app.');
  const student = await assertStudentAccess(parent, body.studentId);
  const school = await School.findById(parent.schoolId);
  if (body.to < body.from) throw badRequest('The last day is before the first day.');
  if (daysBetween(body.from, body.to) > 30) throw badRequest('Leave can be at most 31 days. Talk to the class teacher for longer.');
  if (daysBetween(body.from, todayIn(school.timezone)) > school.teacherBackdateDays) throw badRequest(`Leave can start at most ${school.teacherBackdateDays} days ago.`);
  const leave = await LeaveRequest.create({ ...body, schoolId: parent.schoolId, requestedBy: parent._id });
  const teacher = await classTeacherOf(student);
  if (teacher) await notify(teacher, 'leave_request', { studentName: student.name, from: body.from, to: body.to, key: String(leave._id) }, { url: '/t/leave' });
  return { leave };
}

// A parent sees their children's requests; a class teacher their class; the headmaster all.
async function listLeave(user, { status, studentId }) {
  const filter = { schoolId: user.schoolId, ...(status ? { status } : {}) };
  const only = (allowed) => (studentId ? (allowed.some((id) => String(id) === studentId) ? studentId : null) : { $in: allowed });
  if (user.role === 'parent') {
    filter.studentId = only(await Student.find({ parentIds: user._id }).distinct('_id'));
  } else if (user.role === 'teacher') {
    const led = await ClassRoom.find({ classTeacherId: user._id }).distinct('_id');
    filter.studentId = only(await Student.find({ classId: { $in: led } }).distinct('_id'));
  } else if (studentId) filter.studentId = studentId;
  const leaves = await LeaveRequest.find(filter)
    .sort({ status: -1, from: -1 })
    .limit(100)
    .populate({ path: 'studentId', select: 'name rollNo classId', populate: { path: 'classId', select: 'grade section' } })
    .populate('requestedBy', 'name phone')
    .populate('decidedBy', 'name');
  return { leaves };
}

// Class teacher or headmaster approves (days become Lv) or rejects; the parent is told.
async function decideLeave(user, id, decision) {
  const leave = await LeaveRequest.findOne({ _id: id, schoolId: user.schoolId });
  if (!leave) throw notFound('Leave request');
  const student = await Student.findById(leave.studentId);
  if (user.role === 'teacher') {
    const cls = await ClassRoom.findById(student.classId);
    if (String(cls.classTeacherId) !== String(user._id)) throw forbidden('Only the class teacher or headmaster can decide leave.');
  } else if (user.role !== 'admin') throw forbidden();
  if (leave.status !== 'pending') throw badRequest(`This request was already ${leave.status}.`);
  leave.status = decision;
  leave.decidedBy = user._id;
  leave.decidedAt = new Date();
  await leave.save();
  const daysMarked = decision === 'approved' ? await applyLeave(leave, user) : 0;
  const parent = await User.findById(leave.requestedBy);
  if (parent) await notify(parent, 'leave_decision', { studentName: student.name, from: leave.from, to: leave.to, approved: decision === 'approved', key: String(leave._id) }, { url: `/p/child/${student._id}` });
  return { leave, daysMarked };
}

// A parent can withdraw a request the teacher has not decided yet.
async function withdrawLeave(parent, id) {
  const leave = await LeaveRequest.findOne({ _id: id, requestedBy: parent._id });
  if (!leave) throw notFound('Leave request');
  if (leave.status !== 'pending') throw badRequest('Only a pending request can be withdrawn.');
  await leave.deleteOne();
  return { ok: true };
}

module.exports = { applyLeave, applyForLeave, listLeave, decideLeave, withdrawLeave };
