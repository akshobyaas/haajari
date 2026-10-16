const { Schema, model } = require('mongoose');
const { STATUSES } = require('./constants');

const attendanceSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'ClassRoom', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // school-local date, no timezone drift
    period: { type: Number, default: 0 }, // 0 = whole day
    status: { type: String, enum: STATUSES, required: true },
    reason: String, // free text, or a parent's reason code: sick, family, travel, other
    reasonBy: { type: String, enum: ['teacher', 'parent', 'leave'] },
    reasonAt: Date,
    // Who created the mark: the class register, an approved leave, or pre-primary check-in.
    source: { type: String, enum: ['teacher', 'leave', 'checkin'], default: 'teacher' },
    alertedAt: Date, // when the parent was told about this absence
    markedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    markedAt: { type: Date, required: true },
    clientId: { type: String }, // generated on the phone; makes offline retries idempotent
  },
  { timestamps: true }
);

attendanceSchema.index({ studentId: 1, date: 1, period: 1 }, { unique: true });
attendanceSchema.index({ classId: 1, date: 1 });
attendanceSchema.index({ schoolId: 1, date: 1 }); // dashboard and alert worker read a whole day at once
attendanceSchema.index({ clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } });

module.exports = model('Attendance', attendanceSchema);
