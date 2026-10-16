const { Schema, model } = require('mongoose');

const guardianSchema = new Schema(
  {
    name: { type: String, required: true },
    relation: { type: String, required: true }, // Mother, Father, Grandparent...
    phone: String,
    photoUrl: String, // consent-based photo used only for pickup checks
  },
  { _id: true }
);

const studentSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    admissionNo: { type: String, required: true, trim: true },
    satsId: { type: String, trim: true, match: [/^\d{9}$/, 'SATS ID must be 9 digits'] },
    name: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['M', 'F', 'O'] },
    dob: String, // YYYY-MM-DD
    photoUrl: String,
    classId: { type: Schema.Types.ObjectId, ref: 'ClassRoom', required: true, index: true },
    rollNo: { type: Number, min: 1 },
    parentIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    pickupGuardians: [guardianSchema],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

studentSchema.index({ schoolId: 1, admissionNo: 1 }, { unique: true });
studentSchema.index({ satsId: 1 }, { unique: true, partialFilterExpression: { satsId: { $type: 'string' } } });
studentSchema.index({ parentIds: 1 });

module.exports = model('Student', studentSchema);
