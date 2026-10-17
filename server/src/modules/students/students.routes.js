const { Router } = require('express');
const multer = require('multer');
const { requireRole } = require('../../middleware/auth');
const { parse } = require('../../shared/validate');
const { badRequest } = require('../../shared/errors');
const { TEMPLATE } = require('./students.import');
const service = require('./students.service');
const { listQuery, studentBody, removeBody } = require('./students.schemas');

// Students. Mounted at /api/students.
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.get('/', requireRole('admin', 'teacher'), async (req, res) => res.json(await service.listStudents(req.user, parse(listQuery, req.query))));

router.get('/import/template', requireRole('admin'), (_req, res) => {
  res.type('text/csv').attachment('haajari-students-template.csv').send(TEMPLATE);
});

// POST with ?dryRun=true to preview and validate; without it to save.
router.post('/import', requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Choose a CSV file to upload.');
  const result = await service.importFromCsv(req.user, req.file.buffer.toString('utf8'), req.query.dryRun === 'true');
  res.status(result.ok ? 200 : 422).json(result);
});

router.get('/:id', async (req, res) => res.json(await service.getStudent(req.user, req.params.id)));
router.post('/', requireRole('admin'), async (req, res) => res.status(201).json(await service.createStudent(req.user, parse(studentBody, req.body))));
router.patch('/:id', requireRole('admin'), async (req, res) => res.json(await service.updateStudent(req.user, req.params.id, parse(studentBody.partial(), req.body))));
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const { reason } = parse(removeBody, req.body || {});
  res.json(await service.removeStudent(req.user, req.params.id, reason));
});

module.exports = router;
