const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const { parse } = require('../../shared/validate');
const service = require('./classes.service');
const { classBody, rosterQuery } = require('./classes.schemas');

// Classes: teachers see theirs, the headmaster manages all. Mounted at /api/classes.
const router = Router();

router.get('/', async (req, res) => res.json(await service.listClasses(req.user)));
router.get('/:id/roster', async (req, res) => res.json(await service.roster(req.user, req.params.id, parse(rosterQuery, req.query).date)));
router.get('/:id', async (req, res) => res.json(await service.getClass(req.user, req.params.id)));
router.post('/', requireRole('admin'), async (req, res) => res.status(201).json(await service.createClass(req.user, parse(classBody, req.body))));
router.patch('/:id', requireRole('admin'), async (req, res) => res.json(await service.updateClass(req.user, req.params.id, parse(classBody.partial(), req.body))));
router.delete('/:id', requireRole('admin'), async (req, res) => res.json(await service.removeClass(req.user, req.params.id)));

module.exports = router;
