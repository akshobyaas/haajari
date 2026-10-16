const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signAuth = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role, school: String(user.schoolId) }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

// Short-lived token proving the phone passed OTP; only usable to set a PIN.
const signSetup = (userId) => jwt.sign({ sub: String(userId), purpose: 'pin-setup' }, env.jwtSecret, { expiresIn: '10m' });

const verify = (token) => jwt.verify(token, env.jwtSecret);

module.exports = { signAuth, signSetup, verify };

// Lets a parent answer "why absent?" straight from the notification, without opening a session.
const signAbsenceReply = (attendanceId, parentId) =>
  jwt.sign({ purpose: 'absence-reply', aid: String(attendanceId), uid: String(parentId) }, env.jwtSecret, { expiresIn: '3d' });

module.exports.signAbsenceReply = signAbsenceReply;
