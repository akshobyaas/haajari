const { Router } = require('express');
const { z, parse, objectId } = require('../../shared/validate');
const { requireRole } = require('../../middleware/auth');
const service = require('./pickup.service');

// Pre-primary arrival and hand-over (teachers and headmaster). Mounted at /api/pickup.
const router = Router();
router.use(requireRole('admin', 'teacher'));

const checkoutBody = z.object({ studentId: objectId.optional(), guardianId: objectId.optional(), passToken: z.string().optional() });

router.get('/class/:id/today', async (req, res) => res.json(await service.board(req.user, req.params.id)));
router.post('/checkout', async (req, res) => res.json(await service.checkout(req.user, parse(checkoutBody, req.body))));
router.post('/undo', async (req, res) => res.json(await service.undoCheckout(req.user, parse(z.object({ studentId: objectId }), req.body).studentId)));

module.exports = router;
