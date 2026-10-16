const { Schema, model } = require('mongoose');

const leaveSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    reason: { type: String, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: Date,
  },
  { timestamps: true }
);

module.exports = model('LeaveRequest', leaveSchema);
