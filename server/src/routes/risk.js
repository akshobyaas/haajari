const { Router } = require('express');
const { RiskFlag, ClassRoom, School } = require('../models');
const { requireRole } = require('../middleware/auth');
const { z, parse, objectId } = require('../utils/validate');
const { notFound, forbidden } = require('../utils/errors');
const { evaluateRisk } = require('../workers/risk');

const router = Router();
router.use(requireRole('admin', 'teacher'));

async function visibleClassIds(user) {
  if (user.role === 'admin') return null;
  return ClassRoom.find({ classTeacherId: user._id, active: true }).distinct('_id');
}

// Children who need follow-up. Teachers see their own class; the headmaster sees all.
router.get('/', async (req, res) => {
  const q = parse(z.object({ classId: objectId.optional(), active: z.enum(['true', 'false']).default('true') }), req.query);
  const filter = { schoolId: req.user.schoolId, active: q.active === 'true' };
  const mine = await visibleClassIds(req.user);
  if (mine) filter.classId = { $in: mine };
  if (q.classId) filter.classId = mine && !mine.some((m) => String(m) === q.classId) ? null : q.classId;
  const flags = await RiskFlag.find(filter)
    .populate({ path: 'studentId', select: 'name rollNo parentIds', populate: { path: 'parentIds', select: 'name phone' } })
    .populate('classId', 'grade section')
    .populate('followUps.by', 'name')
    .limit(300);
  // Longest streak first, then lowest attendance.
  flags.sort((a, b) => (b.streak || 0) - (a.streak || 0) || (a.monthPct ?? a.yearPct ?? 100) - (b.monthPct ?? b.yearPct ?? 100));
  const school = await School.findById(req.user.schoolId);
  res.json({ flags, evaluatedOn: school.riskEvaluatedOn, rules: { streak: school.consecutiveAbsenceAlert, threshold: school.alertThreshold } });
});

// Record what was done: called the parent, visited the home, sent a message.
router.post('/:id/follow-up', async (req, res) => {
  const body = parse(z.object({ type: z.enum(['call', 'visit', 'message', 'note']), note: z.string().trim().max(300).optional() }), req.body);
  const flag = await RiskFlag.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!flag) throw notFound('Follow-up');
  const mine = await visibleClassIds(req.user);
  if (mine && !mine.some((m) => String(m) === String(flag.classId))) throw forbidden('This child is not in your class.');
  flag.followUps.push({ ...body, by: req.user._id });
  await flag.save();
  await flag.populate('followUps.by', 'name');
  res.json({ flag });
});

// Headmaster can re-run the check now instead of waiting for the evening run.
router.post('/refresh', requireRole('admin'), async (req, res) => {
  const school = await School.findById(req.user.schoolId);
  res.json(await evaluateRisk(school));
});

module.exports = router;
