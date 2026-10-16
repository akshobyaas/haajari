const { Schema, model } = require('mongoose');
const { GRADES, MODES } = require('./constants');

// Named ClassRoom because "Class" is a reserved word in JavaScript.
const classSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    grade: { type: String, enum: GRADES, required: true },
    section: { type: String, required: true, uppercase: true, trim: true, default: 'A' },
    medium: { type: String, enum: ['kannada', 'english', 'urdu'], default: 'kannada' },
    classTeacherId: { type: Schema.Types.ObjectId, ref: 'User' },
    mode: { type: String, enum: MODES, required: true },
    periodsPerDay: { type: Number, default: 0, min: 0, max: 10 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

classSchema.index({ schoolId: 1, grade: 1, section: 1, medium: 1 }, { unique: true });

module.exports = model('ClassRoom', classSchema);
