const { Router } = require('express');
const multer = require('multer');
const { Student, User, AuditLog } = require('../models');
const { z, parse, objectId, phone, isoDate } = require('../utils/validate');
const { requireRole } = require('../middleware/auth');
const { teacherClassIds, assertClassAccess, assertStudentAccess } = require('../middleware/access');
const { importStudents, TEMPLATE } = require('../utils/studentImport');
const { badRequest, forbidden } = require('../utils/errors');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// List students. Admin: any class; teacher: assigned classes only.
router.get('/', requireRole('admin', 'teacher'), async (req, res) => {
  const q = parse(
    z.object({ classId: objectId.optional(), search: z.string().trim().max(60).optional() }),
    req.query
  );
  const filter = { schoolId: req.user.schoolId, active: true };
  if (q.classId) {
    await assertClassAccess(req.user, q.classId);
    filter.classId = q.classId;
  } else if (req.user.role === 'teacher') {
    filter.classId = { $in: await teacherClassIds(req.user) };
  }
  if (q.search) {
    const rx = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { admissionNo: rx }, { satsId: rx }];
  }
  const students = await Student.find(filter)
    .sort({ rollNo: 1, name: 1 })
    .limit(q.classId ? 500 : 100)
    .populate('parentIds', 'name phone')
    .populate('classId', 'grade section');
  res.json({ students });
});

router.get('/import/template', requireRole('admin'), (_req, res) => {
  res.type('text/csv').attachment('haajari-students-template.csv').send(TEMPLATE);
});

// POST with ?dryRun=true to preview and validate; without it to save.
router.post('/import', requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Choose a CSV file to upload.');
  const dryRun = req.query.dryRun === 'true';
  const result = await importStudents({ csvText: req.file.buffer.toString('utf8'), schoolId: req.user.schoolId, dryRun });
  if (!dryRun && result.ok) {
    await AuditLog.create({
      schoolId: req.user.schoolId, entity: 'student', entityId: req.user._id, action: 'import',
      changedBy: req.user._id, to: { created: result.created, updated: result.updated },
    });
  }
  res.status(result.ok ? 200 : 422).json(result);
});

router.get('/:id', async (req, res) => {
  const student = await assertStudentAccess(req.user, req.params.id);
  await student.populate([{ path: 'parentIds', select: 'name phone' }, { path: 'classId', select: 'grade section' }]);
  res.json({ student });
});

const guardian = z.object({ name: z.string().min(1), relation: z.string().min(1), phone: phone.optional(), photoUrl: z.string().optional() });
const studentBody = z.object({
  admissionNo: z.string().trim().min(1),
  name: z.string().trim().min(1),
  classId: objectId,
  rollNo: z.number().int().positive().optional(),
  gender: z.enum(['M', 'F', 'O']).optional(),
  dob: isoDate.optional(),
  satsId: z.string().regex(/^\d{9}$/, 'SATS ID must be 9 digits').optional().or(z.literal('')),
  parent: z.object({ name: z.string().min(1), phone, relation: z.string().default('Parent') }).optional(),
  pickupGuardians: z.array(guardian).optional(),
});

async function linkParent(schoolId, parent) {
  if (!parent) return [];
  let user = await User.findOne({ phone: parent.phone });
  if (user && user.role !== 'parent') throw badRequest('This phone number belongs to a staff account.');
  if (!user) user = await User.create({ schoolId, role: 'parent', name: parent.name, phone: parent.phone });
  return [user._id];
}

router.post('/', requireRole('admin'), async (req, res) => {
  const body = parse(studentBody, req.body);
  await assertClassAccess(req.user, body.classId);
  const parentIds = await linkParent(req.user.schoolId, body.parent);
  const pickupGuardians = body.pickupGuardians || (body.parent ? [{ ...body.parent }] : []);
  const student = await Student.create({
    ...body, satsId: body.satsId || undefined, parentIds, pickupGuardians, schoolId: req.user.schoolId,
  });
  res.status(201).json({ student });
});

router.patch('/:id', requireRole('admin'), async (req, res) => {
  const body = parse(studentBody.partial(), req.body);
  const student = await assertStudentAccess(req.user, req.params.id);
  if (body.classId) await assertClassAccess(req.user, body.classId);
  const before = student.toObject();
  if (body.parent) {
    const [pid] = await linkParent(req.user.schoolId, body.parent);
    if (!student.parentIds.some((p) => String(p) === String(pid))) student.parentIds.push(pid);
  }
  const { parent, ...rest } = body;
  if (rest.satsId === '') rest.satsId = undefined;
  Object.assign(student, rest);
  await student.save();
  if (body.classId && String(before.classId) !== String(body.classId)) {
    await AuditLog.create({
      schoolId: req.user.schoolId, entity: 'student', entityId: student._id, action: 'move_class',
      changedBy: req.user._id, from: before.classId, to: body.classId,
    });
  }
  res.json({ student });
});

// Soft delete (left school / transfer). History is kept.
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().trim().min(2, 'Give a reason, e.g. Transfer certificate issued') }), req.body || {});
  const student = await assertStudentAccess(req.user, req.params.id);
  if (!student.active) throw forbidden('Already removed.');
  student.active = false;
  await student.save();
  await AuditLog.create({
    schoolId: req.user.schoolId, entity: 'student', entityId: student._id, action: 'deactivate',
    changedBy: req.user._id, reason,
  });
  res.json({ ok: true });
});

module.exports = router;
