const { Router } = require('express');
const { Student, Attendance, PickupLog, School, LeaveRequest, Notification, PushSubscription, ClassRoom, User, REASON_CODES } = require('../models');
const { requireRole } = require('../middleware/auth');
const { assertStudentAccess } = require('../middleware/access');
const { z, parse, objectId, phone } = require('../utils/validate');
const { todayIn, addDays } = require('../utils/dates');
const { signPass } = require('../utils/pass');
const { badRequest, notFound, forbidden } = require('../utils/errors');
const { notify } = require('../services/notify');

const router = Router();

const dayPeriod = (cls) => (cls?.mode === 'period' ? 1 : 0);
// Indian academic year starts in June.
const academicYearStart = (iso) => (Number(iso.slice(5, 7)) >= 6 ? `${iso.slice(0, 4)}-06-01` : `${Number(iso.slice(0, 4)) - 1}-06-01`);
const tally = (rows) => {
  const t = { P: 0, A: 0, L: 0, LV: 0 };
  rows.forEach((r) => { t[r.status] += 1; });
  const total = t.P + t.A + t.L + t.LV;
  return { ...t, days: total, pct: total ? Math.round(((t.P + t.L) / total) * 1000) / 10 : null };
};

// Parent home: each child with today's status and pickup.
router.get('/children', requireRole('parent'), async (req, res) => {
  const school = await School.findById(req.user.schoolId);
  const today = todayIn(school.timezone);
  const children = await Student.find({ parentIds: req.user._id, active: true })
    .select('name admissionNo rollNo photoUrl classId pickupGuardians')
    .populate({ path: 'classId', select: 'grade section mode classTeacherId', populate: { path: 'classTeacherId', select: 'name phone' } });
  const out = [];
  for (const c of children) {
    const [mark, pickup] = await Promise.all([
      Attendance.findOne({ studentId: c._id, date: today, period: dayPeriod(c.classId) }).select('status reason reasonBy markedAt alertedAt source'),
      PickupLog.findOne({ studentId: c._id, date: today }).select('checkOutAt collectedBy'),
    ]);
    out.push({ ...c.toObject(), today: { date: today, mark, pickup } });
  }
  res.json({ date: today, children: out });
});

// One child's month: day-by-day calendar plus month and year percentages.
router.get('/children/:id/attendance', requireRole('parent'), async (req, res) => {
  const student = await assertStudentAccess(req.user, req.params.id);
  const cls = await ClassRoom.findById(student.classId);
  const school = await School.findById(req.user.schoolId);
  const today = todayIn(school.timezone);
  const q = parse(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }), req.query);
  const month = q.month || today.slice(0, 7);
  const period = dayPeriod(cls);
  const [monthRows, yearRows, leaves] = await Promise.all([
    Attendance.find({ studentId: student._id, period, date: { $gte: `${month}-01`, $lte: `${month}-31` } }).select('date status reason reasonBy alertedAt').sort({ date: 1 }),
    Attendance.find({ studentId: student._id, period, date: { $gte: academicYearStart(today), $lte: today } }).select('status'),
    LeaveRequest.find({ studentId: student._id }).sort({ from: -1 }).limit(20).populate('decidedBy', 'name'),
  ]);
  res.json({
    today,
    month,
    holidays: school.holidays.filter((h) => h.date.startsWith(month)),
    days: monthRows,
    monthStats: tally(monthRows),
    yearStats: tally(yearRows),
    threshold: school.alertThreshold,
    leaves,
  });
});

// Parent answers "why absent?" from inside the app.
router.post('/absences/:attendanceId/reason', requireRole('parent'), async (req, res) => {
  const body = parse(z.object({ reason: z.enum(REASON_CODES), note: z.string().trim().max(200).optional() }), req.body);
  const rec = await Attendance.findById(req.params.attendanceId);
  if (!rec) throw notFound('Absence');
  await assertStudentAccess(req.user, rec.studentId);
  res.json(await recordParentReason(rec, req.user, body.reason, body.note));
});

async function recordParentReason(rec, parent, code, note) {
  if (rec.status !== 'A') throw badRequest('This day is no longer marked absent.');
  rec.reason = note ? `${code}: ${note}` : code;
  rec.reasonBy = 'parent';
  rec.reasonAt = new Date();
  await rec.save();
  const [student, cls] = await Promise.all([Student.findById(rec.studentId), ClassRoom.findById(rec.classId)]);
  const teacher = cls?.classTeacherId && (await User.findById(cls.classTeacherId));
  if (teacher) await notify(teacher, 'absence_reason', { studentName: student.name, code, note, key: String(rec._id) }, { url: `/t/class/${cls._id}/mark?date=${rec.date}` });
  return { ok: true, attendance: { _id: rec._id, reason: rec.reason, reasonBy: rec.reasonBy } };
}

// Who may collect a pre-primary child. Photos are optional and stored only with the parent's consent.
const guardianBody = z.object({
  _id: objectId.optional(),
  name: z.string().trim().min(2).max(60),
  relation: z.string().trim().min(2).max(30),
  phone: phone.optional().or(z.literal('')),
  photoUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/, 'Photo must be an image').max(200_000, 'Photo is too large').optional().or(z.literal('')),
});
router.put('/children/:id/guardians', requireRole('parent'), async (req, res) => {
  const { guardians } = parse(z.object({ guardians: z.array(guardianBody).min(1, 'Keep at least one person who can collect the child').max(6) }), req.body);
  const student = await assertStudentAccess(req.user, req.params.id);
  student.pickupGuardians = guardians.map((g) => ({ ...g, phone: g.phone || undefined, photoUrl: g.photoUrl || undefined }));
  await student.save();
  res.json({ guardians: student.pickupGuardians });
});

// QR pickup pass for today, naming the person who will collect the child.
router.get('/children/:id/pickup-pass', requireRole('parent'), async (req, res) => {
  const { guardianId } = parse(z.object({ guardianId: objectId }), req.query);
  const student = await assertStudentAccess(req.user, req.params.id);
  const guardian = student.pickupGuardians.id(guardianId);
  if (!guardian) throw forbidden('Add this person to the pickup list first.');
  const school = await School.findById(req.user.schoolId);
  // Valid until midnight, school time (IST is UTC+5:30 with no daylight saving).
  const tomorrow = addDays(todayIn(school.timezone), 1);
  const expiresAt = Date.parse(`${tomorrow}T00:00:00+05:30`);
  res.json({ qr: signPass({ studentId: student._id, guardianId, expiresAt }), expiresAt, guardian: { _id: guardian._id, name: guardian.name, relation: guardian.relation } });
});

// Notification inbox, for every role.
router.get('/notifications', async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ userId: req.user._id }).sort({ sentAt: -1 }).limit(50),
    Notification.countDocuments({ userId: req.user._id, readAt: null }),
  ]);
  res.json({ notifications: items, unread });
});
router.post('/notifications/read', async (req, res) => {
  const { ids } = parse(z.object({ ids: z.array(objectId).optional() }), req.body || {});
  await Notification.updateMany({ userId: req.user._id, readAt: null, ...(ids ? { _id: { $in: ids } } : {}) }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
});

// Phone notifications (Web Push).
router.post('/push', async (req, res) => {
  const body = parse(z.object({ endpoint: z.url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }), req.body);
  await PushSubscription.findOneAndUpdate({ endpoint: body.endpoint }, { userId: req.user._id, keys: body.keys, userAgent: req.get('user-agent') }, { upsert: true });
  res.json({ ok: true });
});
router.delete('/push', async (req, res) => {
  const { endpoint } = parse(z.object({ endpoint: z.string() }), req.body || {});
  await PushSubscription.deleteOne({ endpoint, userId: req.user._id });
  res.json({ ok: true });
});

module.exports = router;
module.exports.recordParentReason = recordParentReason;
