const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, LANGUAGES } = require('./constants');

const subjectAssignment = new Schema(
  { classId: { type: Schema.Types.ObjectId, ref: 'ClassRoom', required: true }, subject: { type: String, required: true } },
  { _id: false }
);

const userSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true },
    phone: { type: String, trim: true }, // 10-digit Indian mobile
    email: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, select: false },
    pinHash: { type: String, select: false },
    language: { type: String, enum: LANGUAGES, default: 'kn' },
    subjects: [subjectAssignment], // subject-teacher assignments (Grades 6-10)
    active: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } });
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};
userSchema.methods.checkPassword = function (plain) {
  return this.passwordHash ? bcrypt.compare(plain, this.passwordHash) : false;
};
userSchema.methods.setPin = async function (pin) {
  this.pinHash = await bcrypt.hash(pin, 10);
};
userSchema.methods.checkPin = function (pin) {
  return this.pinHash ? bcrypt.compare(pin, this.pinHash) : false;
};
userSchema.methods.toPublic = function () {
  const { _id, name, role, phone, email, language, subjects, schoolId } = this;
  return { id: _id, name, role, phone, email, language, subjects, schoolId, hasPin: Boolean(this.pinHash) };
};

module.exports = model('User', userSchema);
