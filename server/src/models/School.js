const { Schema, model } = require('mongoose');
const { SCHOOL_STATUSES } = require('./constants');

const holidaySchema = new Schema({ date: { type: String, required: true }, name: String }, { _id: false });

const schoolSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // A school asking to join waits as 'pending' until the approver accepts it; nobody can log in before that.
    status: { type: String, enum: SCHOOL_STATUSES, default: 'active', index: true },
    request: {
      hmName: String,
      hmEmail: String,
      hmPhone: String,
      note: String,
      requestedAt: Date,
    },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: Date,
    rejectReason: String,
    udiseCode: { type: String, trim: true },
    district: String,
    block: String,
    academicYear: { type: String, required: true }, // e.g. "2026-27"
    markingWindow: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '11:00' },
    },
    alertThreshold: { type: Number, default: 75, min: 0, max: 100 },
    consecutiveAbsenceAlert: { type: Number, default: 3, min: 1 },
    holidays: [holidaySchema],
    defaultLanguage: { type: String, enum: ['kn', 'en', 'hi'], default: 'kn' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    // Parents hear about an absence this many minutes after it is saved, so a quick correction does not alarm them.
    alertDelayMinutes: { type: Number, default: 2, min: 0, max: 60 },
    // Pre-primary pickup time; staff are alerted if a child is still waiting this many minutes after it.
    pickupTime: { type: String, default: '12:30' },
    pickupGraceMinutes: { type: Number, default: 20, min: 0, max: 180 },
    // Classes that get the mid-day meal (PM POSHAN covers pre-primary to Class 8 in government schools).
    mealGrades: { type: [String], default: ['PREKG', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8'] },
    riskEvaluatedOn: String, // date of the last at-risk run
    // Teachers may mark or correct this many past days; admins any day.
    teacherBackdateDays: { type: Number, default: 7, min: 0, max: 60 },
  },
  { timestamps: true }
);

module.exports = model('School', schoolSchema);
