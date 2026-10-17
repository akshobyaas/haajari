const { Router } = require('express');
const { z, parse, objectId, isoDate } = require('../../shared/validate');
const service = require('./leave.service');

// Leave requests from parents, decided by the class teacher. Mounted at /api/leave.
const router = Router();

const applyBody = z.object({ studentId: objectId, from: isoDate, to: isoDate, reason: z.string().trim().min(3, 'Write a short reason').max(300) });
const listQuery = z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional(), studentId: objectId.optional() });
const decisionBody = z.object({ decision: z.enum(['approved', 'rejected']) });

router.post('/', async (req, res) => res.status(201).json(await service.applyForLeave(req.user, parse(applyBody, req.body))));
router.get('/', async (req, res) => res.json(await service.listLeave(req.user, parse(listQuery, req.query))));
router.patch('/:id', async (req, res) => res.json(await service.decideLeave(req.user, req.params.id, parse(decisionBody, req.body).decision)));
router.delete('/:id', async (req, res) => res.json(await service.withdrawLeave(req.user, req.params.id)));

module.exports = router;
