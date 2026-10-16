const { Schema, model } = require('mongoose');

const holidaySchema = new Schema({ date: { type: String, required: true }, name: String }, { _id: false });

const schoolSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
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
    // Teachers may mark or correct this many past days; admins any day.
    teacherBackdateDays: { type: Number, default: 7, min: 0, max: 60 },
  },
  { timestamps: true }
);

module.exports = model('School', schoolSchema);
