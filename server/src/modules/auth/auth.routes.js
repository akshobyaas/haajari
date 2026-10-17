const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const env = require('../../config/env');
const { z, parse, phone, pin } = require('../../shared/validate');
const { requireAuth } = require('../../middleware/auth');
const service = require('./auth.service');

// Login, PIN setup with OTP, and the signed-in user's own profile. Mounted at /api/auth.
const router = Router();

// Slows down PIN guessing: 10 tries per 15 minutes per network.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many attempts. Wait 15 minutes and try again.' } },
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = parse(z.object({ email: z.email(), password: z.string().min(1) }), req.body);
  res.json(await service.loginWithPassword(email, password));
});

router.post('/pin-login', loginLimiter, async (req, res) => {
  const body = parse(z.object({ phone, pin }), req.body);
  res.json(await service.loginWithPin(body.phone, body.pin));
});

router.post('/otp/request', loginLimiter, async (req, res) => {
  res.json(await service.requestOtp(parse(z.object({ phone }), req.body).phone));
});

router.post('/otp/verify', loginLimiter, async (req, res) => {
  const body = parse(z.object({ phone, code: z.string().regex(/^\d{6}$/, 'OTP is 6 digits') }), req.body);
  res.json(await service.verifyOtp(body.phone, body.code));
});

router.post('/pin/setup', async (req, res) => {
  const body = parse(z.object({ setupToken: z.string(), pin }), req.body);
  res.json(await service.setupPin(body.setupToken, body.pin));
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toPublic() }));

router.patch('/me', requireAuth, async (req, res) => {
  res.json(await service.setLanguage(req.user, parse(z.object({ language: z.enum(['kn', 'en', 'hi']) }), req.body).language));
});

module.exports = router;
