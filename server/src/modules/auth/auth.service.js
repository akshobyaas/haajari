const { User, School } = require('../../models');
const env = require('../../config/env');
const otp = require('../../shared/otp');
const { signAuth, signSetup, verify } = require('../../shared/token');
const { assertSchoolOpen } = require('../../shared/schoolStatus');
const { unauthorized, badRequest } = require('../../shared/errors');

const NOT_REGISTERED = 'This number is not registered with the school. Ask the school office to add it.';

// Every successful login ends here: the school must be approved, then a token is issued.
async function session(user) {
  await assertSchoolOpen(user, School);
  user.lastLoginAt = new Date();
  await user.save();
  return { token: signAuth(user), user: user.toPublic() };
}

// Staff (headmaster, block office) log in with email and password.
async function loginWithPassword(email, password) {
  const user = await User.findOne({ email: email.toLowerCase(), active: true }).select('+passwordHash +pinHash');
  if (!user || !(await user.checkPassword(password))) throw unauthorized('Email or password is wrong.');
  return session(user);
}

// Teachers and parents log in with mobile number + 4-digit PIN (works without SMS).
async function loginWithPin(phone, pin) {
  const user = await User.findOne({ phone, active: true }).select('+pinHash');
  if (!user) throw unauthorized(NOT_REGISTERED);
  if (!user.pinHash) throw badRequest('Set up your PIN first.', { needsSetup: true });
  if (!(await user.checkPin(pin))) throw unauthorized('Wrong PIN. Try again or reset it with an OTP.');
  return session(user);
}

// First-time setup and PIN reset: a one-time code to the registered number.
async function requestOtp(phone) {
  if (!(await User.exists({ phone, active: true }))) throw badRequest(NOT_REGISTERED);
  const code = otp.issue(phone);
  // Production: send `code` by SMS here (e.g. MSG91). Dev mode returns it so the demo works offline.
  return { sent: true, ...(env.otpMode === 'dev' ? { devCode: code } : {}) };
}

const OTP_ERRORS = {
  expired: 'This OTP has expired. Request a new one.',
  locked: 'Too many wrong tries. Request a new OTP.',
  wrong: 'Wrong OTP. Check the SMS and try again.',
};

async function verifyOtp(phone, code) {
  const result = otp.check(phone, code);
  if (OTP_ERRORS[result]) throw badRequest(OTP_ERRORS[result]);
  const user = await User.findOne({ phone, active: true });
  if (!user) throw badRequest(NOT_REGISTERED);
  return { setupToken: signSetup(user._id), name: user.name };
}

const isWeakPin = (pin) => /^(\d)\1{3}$/.test(pin) || ['1234', '4321'].includes(pin);

async function setupPin(setupToken, pin) {
  let payload;
  try {
    payload = verify(setupToken);
  } catch {
    throw unauthorized('Setup took too long. Verify your number again.');
  }
  if (payload.purpose !== 'pin-setup') throw unauthorized();
  if (isWeakPin(pin) && env.isProd) throw badRequest('Pick a PIN that is harder to guess, not 1234 or 1111.');
  const user = await User.findOne({ _id: payload.sub, active: true }).select('+pinHash');
  if (!user) throw unauthorized('This account is no longer active.');
  await user.setPin(pin);
  return session(user);
}

async function setLanguage(user, language) {
  user.language = language;
  await user.save();
  return { user: user.toPublic() };
}

module.exports = { loginWithPassword, loginWithPin, requestOtp, verifyOtp, setupPin, setLanguage };
