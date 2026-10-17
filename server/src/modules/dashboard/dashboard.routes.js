const { Router } = require('express');
const { z, parse, isoDate } = require('../../shared/validate');
const { todayIn } = require('../../shared/dates');
const { getSchool } = require('../school/school.service');
const { dayOverview, trend } = require('../reports/stats.service');
const { setupSummary } = require('./dashboard.service');

// Headmaster's home screen (mounted behind requireRole('admin') in src/api).
const router = Router();

router.get('/summary', async (req, res) => {
  res.json(await setupSummary(req.user.schoolId));
});

// Live picture of the day: headcount, registers taken, class-wise %, meals, who is in school now.
router.get('/today', async (req, res) => {
  const school = await getSchool(req.user.schoolId);
  const { date } = parse(z.object({ date: isoDate.optional() }), req.query);
  res.json(await dayOverview(school, date || todayIn(school.timezone)));
});

router.get('/trend', async (req, res) => {
  const school = await getSchool(req.user.schoolId);
  const { days } = parse(z.object({ days: z.coerce.number().int().min(5).max(120).default(30) }), req.query);
  res.json({ days: await trend(school, todayIn(school.timezone), days) });
});

module.exports = router;
