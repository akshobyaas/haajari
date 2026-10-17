const { Router } = require('express');
const { parse } = require('../../shared/validate');
const service = require('./users.service');
const { listQuery, userBody } = require('./users.schemas');

// Teachers and office staff (headmaster only). Mounted at /api/users behind requireRole('admin').
const router = Router();

router.get('/', async (req, res) => res.json(await service.listUsers(req.user, parse(listQuery, req.query).role)));
router.post('/', async (req, res) => res.status(201).json(await service.createUser(req.user, parse(userBody, req.body))));
router.patch('/:id', async (req, res) => res.json(await service.updateUser(req.user, req.params.id, parse(userBody.partial(), req.body))));
router.post('/:id/reset-pin', async (req, res) => res.json(await service.resetPin(req.user, req.params.id)));
router.delete('/:id', async (req, res) => res.json(await service.removeUser(req.user, req.params.id)));

module.exports = router;
