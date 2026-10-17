const { Router } = require('express');
const { parse } = require('../../shared/validate');
const { requireRole } = require('../../middleware/auth');
const { getSchool, updateSchool } = require('./school.service');
const { schoolSettings } = require('./school.schemas');

const router = Router();

router.get('/', async (req, res) => {
  res.json({ school: await getSchool(req.user.schoolId) });
});

router.patch('/', requireRole('admin'), async (req, res) => {
  res.json({ school: await updateSchool(req.user.schoolId, parse(schoolSettings, req.body)) });
});

module.exports = router;
