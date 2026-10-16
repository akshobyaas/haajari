const { Router } = require('express');
const { User, ClassRoom } = require('../models');
const { z, parse, objectId, phone } = require('../utils/validate');
const { notFound, badRequest } = require('../utils/errors');

// Admin-only (mounted behind requireRole('admin')).
const router = Router();

router.get('/', async (req, res) => {
  const { role } = parse(z.object({ role: z.enum(['admin', 'teacher', 'parent']).optional() }), req.query);
  const filter = { schoolId: req.user.schoolId, active: true, ...(role ? { role } : {}) };
  const users = await User.find(filter).select('+pinHash').sort({ name: 1 }).limit(1000);
  const led = await ClassRoom.find({ schoolId: req.user.schoolId, active: true, classTeacherId: { $ne: null } })
    .select('grade section classTeacherId');
  const ledBy = {};
  led.forEach((c) => (ledBy[String(c.classTeacherId)] ||= []).push(`${c.grade}-${c.section}`));
  res.json({ users: users.map((u) => ({ ...u.toPublic(), classTeacherOf: ledBy[String(u._id)] || [] })) });
});

const userBody = z.object({
  name: z.string().trim().min(2),
  role: z.enum(['admin', 'teacher']),
  phone: phone.optional(),
  email: z.email().optional(),
  password: z.string().min(8, 'Password needs at least 8 characters').optional(),
  language: z.enum(['kn', 'en', 'hi']).optional(),
  subjects: z.array(z.object({ classId: objectId, subject: z.string().min(1) })).optional(),
});

router.post('/', async (req, res) => {
  const body = parse(userBody, req.body);
  if (!body.phone && !body.email) throw badRequest('Add a mobile number or an email.');
  const { password, ...rest } = body;
  const user = new User({ ...rest, schoolId: req.user.schoolId });
  if (password) await user.setPassword(password);
  await user.save();
  res.status(201).json({ user: user.toPublic() });
});

router.patch('/:id', async (req, res) => {
  const body = parse(userBody.partial(), req.body);
  const user = await User.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!user) throw notFound('User');
  const { password, ...rest } = body;
  Object.assign(user, rest);
  if (password) await user.setPassword(password);
  await user.save();
  res.json({ user: user.toPublic() });
});

// Clears the PIN; the person sets a new one with an OTP next time.
router.post('/:id/reset-pin', async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, schoolId: req.user.schoolId }).select('+pinHash');
  if (!user) throw notFound('User');
  user.pinHash = undefined;
  await user.save();
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw badRequest('You cannot remove your own account.');
  const user = await User.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!user) throw notFound('User');
  user.active = false;
  await user.save();
  await ClassRoom.updateMany({ classTeacherId: user._id }, { $unset: { classTeacherId: 1 } });
  res.json({ ok: true });
});

module.exports = router;
