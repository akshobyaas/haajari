const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const { parse } = require('../../shared/validate');
const service = require('./parents.service');
const schemas = require('./parents.schemas');

// The parent app: children, their month, absence reasons, pickup list and pass. Mounted at /api/me.
const router = Router();
router.use(['/children', '/absences'], requireRole('parent'));

router.get('/children', async (req, res) => {
  res.json(await service.listChildren(req.user));
});

router.get('/children/:id/attendance', async (req, res) => {
  const { month } = parse(schemas.monthQuery, req.query);
  res.json(await service.childMonth(req.user, req.params.id, month));
});

router.post('/absences/:attendanceId/reason', async (req, res) => {
  res.json(await service.answerAbsence(req.user, req.params.attendanceId, parse(schemas.absenceReason, req.body)));
});

router.put('/children/:id/guardians', async (req, res) => {
  const { guardians } = parse(schemas.guardians, req.body);
  res.json(await service.setGuardians(req.user, req.params.id, guardians));
});

router.get('/children/:id/pickup-pass', async (req, res) => {
  const { guardianId } = parse(schemas.passQuery, req.query);
  res.json(await service.pickupPass(req.user, req.params.id, guardianId));
});

module.exports = router;
