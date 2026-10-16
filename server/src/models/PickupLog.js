const { Schema, model } = require('mongoose');

const pickupSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    date: { type: String, required: true },
    checkInAt: Date,
    checkInBy: { type: Schema.Types.ObjectId, ref: 'User' },
    checkOutAt: Date,
    checkOutBy: { type: Schema.Types.ObjectId, ref: 'User' },
    collectedBy: { name: String, relation: String, guardianId: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

pickupSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = model('PickupLog', pickupSchema);
