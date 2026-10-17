const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const { z, parse, objectId } = require('../../shared/validate');
const service = require('./reports.service');
const { registerWorkbook, tableWorkbook, send, sendCsv, gradeName } = require('./excel.service');

// Registers, shortage lists and the SATS export, as JSON for the screen or as files. Mounted at /api/reports.
const router = Router();
router.use(requireRole('admin', 'teacher'));

const month = z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM');

router.get('/register', async (req, res) => {
  const q = parse(z.object({ classId: objectId, month, format: z.enum(['json', 'xlsx']).default('json') }), req.query);
  const { cls, register } = await service.registerFor(req.user, q.classId, q.month);
  if (q.format === 'xlsx') return send(res, await registerWorkbook(register), `register-${cls.grade}${cls.section}-${q.month}.xlsx`);
  res.json(register);
});

router.get('/shortage', async (req, res) => {
  const q = parse(z.object({ threshold: z.coerce.number().min(1).max(100).optional(), format: z.enum(['json', 'xlsx']).default('json') }), req.query);
  const { threshold, from, to, rows } = await service.shortage(req.user, q.threshold);
  const parentOf = (r) => r.student.parentIds[0];
  if (q.format === 'xlsx') {
    const wb = await tableWorkbook('Shortage', [
      { header: 'Class', key: 'cls', width: 10 }, { header: 'Roll', key: 'roll', width: 6 }, { header: 'Name', key: 'name', width: 24 },
      { header: 'Days', key: 'days', width: 8 }, { header: 'Present', key: 'present', width: 9 }, { header: '%', key: 'pct', width: 7 },
      { header: 'Parent', key: 'parent', width: 18 }, { header: 'Phone', key: 'phone', width: 13 },
    ], rows.map((r) => ({
      cls: `${gradeName(r.cls.grade)} ${r.cls.section}`, roll: r.student.rollNo, name: r.student.name, days: r.days, present: r.present, pct: r.pct,
      parent: parentOf(r)?.name, phone: parentOf(r)?.phone,
    })));
    return send(res, wb, `shortage-below-${threshold}-${to}.xlsx`);
  }
  res.json({
    threshold, from, to,
    students: rows.map((r) => ({
      _id: r.student._id, name: r.student.name, rollNo: r.student.rollNo, class: { _id: r.cls._id, grade: r.cls.grade, section: r.cls.section },
      days: r.days, present: r.present, absent: r.absent, leave: r.leave, pct: r.pct,
      parent: parentOf(r) ? { name: parentOf(r).name, phone: parentOf(r).phone } : null,
    })),
  });
});

const SATS_COLUMNS = [
  { header: 'SATS ID', key: 'sats', width: 12 }, { header: 'Student name', key: 'name', width: 24 }, { header: 'Admission no', key: 'adm', width: 13 },
  { header: 'Class', key: 'grade', width: 7 }, { header: 'Section', key: 'section', width: 8 }, { header: 'Working days', key: 'working', width: 13 },
  { header: 'Days present', key: 'present', width: 13 }, { header: 'Attendance %', key: 'pct', width: 13 },
];

router.get('/sats', requireRole('admin'), async (req, res) => {
  const q = parse(z.object({ month, format: z.enum(['xlsx', 'csv']).default('xlsx') }), req.query);
  const rows = await service.satsMonth(req.user, q.month);
  if (q.format === 'csv') return sendCsv(res, SATS_COLUMNS, rows, `sats-attendance-${q.month}.csv`);
  return send(res, await tableWorkbook(`SATS ${q.month}`, SATS_COLUMNS, rows), `sats-attendance-${q.month}.xlsx`);
});

module.exports = router;
