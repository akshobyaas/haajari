const { Attendance, AuditLog, ClassRoom, School } = require('../models');
const { addDays, closedReason } = require('../utils/dates');

/**
 * Marks every open school day of an approved leave as LV.
 * Days not yet marked get a leave record; days already marked absent become leave
 * (the parent did inform the school); days the child actually came stay as they are.
 */
async function applyLeave(leave, decidedBy) {
  const [school, student] = await Promise.all([School.findById(leave.schoolId), require('../models').Student.findById(leave.studentId)]);
  const cls = await ClassRoom.findById(student.classId);
  const period = cls.mode === 'period' ? 1 : 0;
  let changed = 0;
  for (let d = leave.from; d <= leave.to; d = addDays(d, 1)) {
    if (closedReason(school, d)) continue;
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
  return changed;
}

module.exports = { applyLeave };
