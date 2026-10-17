const { Router } = require('express');
const { z, parse, objectId } = require('../../shared/validate');
const { createSchool, decide, listSchools } = require('./platform.service');
const { schoolRequest } = require('./platform.schemas');

// The approver's console: requests waiting for approval, all schools, and adding a school directly.
const router = Router();

router.get('/schools', async (_req, res) => {
  res.json({ schools: await listSchools() });
});

router.post('/schools', async (req, res) => {
  const body = parse(schoolRequest, req.body);
  const school = await createSchool({ ...body, status: 'active', decidedBy: req.user });
  res.status(201).json({ school: { id: school._id, name: school.name, status: school.status } });
});

router.post('/schools/:id/decision', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const body = parse(z.object({
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().max(300).optional(),
  }), req.body);
  const school = await decide(id, body, req.user);
  res.json({ school: { id: school._id, name: school.name, status: school.status } });
});

module.exports = router;
