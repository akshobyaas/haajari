const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const { z, parse, objectId } = require('../../shared/validate');
const service = require('./risk.service');

// Children who need follow-up. Mounted at /api/risk (teachers: their class; headmaster: all).
const router = Router();
router.use(requireRole('admin', 'teacher'));

const listQuery = z.object({ classId: objectId.optional(), active: z.enum(['true', 'false']).default('true') });
const followUpBody = z.object({ type: z.enum(['call', 'visit', 'message', 'note']), note: z.string().trim().max(300).optional() });

router.get('/', async (req, res) => {
  const q = parse(listQuery, req.query);
  res.json(await service.listFlags(req.user, { classId: q.classId, active: q.active === 'true' }));
});
router.post('/:id/follow-up', async (req, res) => res.json(await service.addFollowUp(req.user, req.params.id, parse(followUpBody, req.body))));
// The headmaster can re-run the check now instead of waiting for the evening run.
router.post('/refresh', requireRole('admin'), async (req, res) => res.json(await service.refreshNow(req.user)));

module.exports = router;
