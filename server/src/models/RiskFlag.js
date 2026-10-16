const { Schema, model } = require('mongoose');

// A child who needs follow-up: absent several days in a row, or attendance below the school's threshold.
const followUpSchema = new Schema(
  {
    type: { type: String, enum: ['call', 'visit', 'message', 'note'], required: true },
    note: { type: String, maxlength: 300 },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const riskSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'ClassRoom', required: true },
    active: { type: Boolean, default: true },
    since: { type: String, required: true }, // date first flagged in this episode
    evaluatedOn: String,
    reasons: [{ type: String, enum: ['streak', 'low_month', 'low_year'] }],
    streak: Number, // school days absent in a row, up to the last marked day
    monthPct: Number,
    yearPct: Number,
    lastPresent: String,
    followUps: [followUpSchema],
  },
  { timestamps: true }
);

riskSchema.index({ studentId: 1, active: 1 });
riskSchema.index({ classId: 1, active: 1 });

module.exports = model('RiskFlag', riskSchema);
