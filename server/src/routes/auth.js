const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { User } = require('../models');
const env = require('../config/env');
const otp = require('../utils/otp');
const { signAuth, signSetup, verify } = require('../utils/token');
const { z, parse, phone, pin } = require('../utils/validate');
const { unauthorized, badRequest } = require('../utils/errors');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// Slows down PIN guessing: 10 tries per 15 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many attempts. Wait 15 minutes and try again.' } },
});

const session = async (user) => {
  user.lastLoginAt = new Date();
  await user.save();
  return { token: signAuth(user), user: user.toPublic() };
};

// Staff (admin, office) log in with email and password.
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = parse(z.object({ email: z.email(), password: z.string().min(1) }), req.body);
  const user = await User.findOne({ email: email.toLowerCase(), active: true }).select('+passwordHash +pinHash');
  if (!user || !(await user.checkPassword(password))) throw unauthorized('Email or password is wrong.');
  res.json(await session(user));
});

// Teachers and parents log in with mobile number + 4-digit PIN (works without SMS).
router.post('/pin-login', loginLimiter, async (req, res) => {
  const body = parse(z.object({ phone, pin }), req.body);
  const user = await User.findOne({ phone: body.phone, active: true }).select('+pinHash');
  if (!user) throw unauthorized('This number is not registered with the school. Ask the school office to add it.');
  if (!user.pinHash) throw badRequest('Set up your PIN first.', { needsSetup: true });
  if (!(await user.checkPin(body.pin))) throw unauthorized('Wrong PIN. Try again or reset it with an OTP.');
  res.json(await session(user));
});

// First-time setup and PIN reset: OTP to the registered number.
router.post('/otp/request', loginLimiter, async (req, res) => {
  const body = parse(z.object({ phone }), req.body);
  const user = await User.findOne({ phone: body.phone, active: true });
  if (!user) throw badRequest('This number is not registered with the school. Ask the school office to add it.');
  const code = otp.issue(body.phone);
  // Production: send `code` by SMS here (e.g. MSG91). Dev mode returns it so the demo works offline.
  res.json({ sent: true, ...(env.otpMode === 'dev' ? { devCode: code } : {}) });
});

router.post('/otp/verify', loginLimiter, async (req, res) => {
  const body = parse(z.object({ phone, code: z.string().regex(/^\d{6}$/, 'OTP is 6 digits') }), req.body);
  const result = otp.check(body.phone, body.code);
  if (result === 'expired') throw badRequest('This OTP has expired. Request a new one.');
  if (result === 'locked') throw badRequest('Too many wrong tries. Request a new OTP.');
  if (result === 'wrong') throw badRequest('Wrong OTP. Check the SMS and try again.');
  const user = await User.findOne({ phone: body.phone, active: true });
  res.json({ setupToken: signSetup(user._id), name: user.name });
});

router.post('/pin/setup', async (req, res) => {
  const body = parse(z.object({ setupToken: z.string(), pin }), req.body);
  let payload;
  try {
    payload = verify(body.setupToken);
  } catch {
    throw unauthorized('Setup took too long. Verify your number again.');
  }
  if (payload.purpose !== 'pin-setup') throw unauthorized();
  const weak = /^(\d)\1{3}$/.test(body.pin) || ['1234', '4321'].includes(body.pin);
  if (weak && env.isProd) throw badRequest('Pick a PIN that is harder to guess, not 1234 or 1111.');
  const user = await User.findById(payload.sub).select('+pinHash');
  await user.setPin(body.pin);
  res.json(await session(user));
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toPublic() }));

router.patch('/me', requireAuth, async (req, res) => {
  const body = parse(z.object({ language: z.enum(['kn', 'en', 'hi']) }), req.body);
  req.user.language = body.language;
  await req.user.save();
  res.json({ user: req.user.toPublic() });
});

module.exports = router;
