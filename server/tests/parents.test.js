const crypto = require('crypto');
const { api, start, stop, auth, loginPin, DEMO } = require('./helpers');
const { ClassRoom, Attendance, School, Student, User, Notification, PickupLog } = require('../src/models');
const { todayIn, addDays, closedReason, nowTimeIn } = require('../src/utils/dates');
const { runAbsenceAlerts, runLatePickupAlerts } = require('../src/workers/alerts');
const { setSender } = require('../src/services/push');

let teacher, parent, parentUser, fourA, riya, pushes;
const today = todayIn('Asia/Kolkata');
const cid = () => crypto.randomUUID();
const mark = (token, classId, list, at = new Date()) => api().post('/api/attendance/bulk').set(auth(token)).send({
  classId: String(classId), date: today,
  marks: list.map(([s, status]) => ({ studentId: String(s._id), status, clientId: cid(), markedAt: at.toISOString() })),
});
const minutesFromNow = (m) => new Date(Date.now() + m * 60 * 1000);

beforeAll(async () => {
  await start();
  await School.updateOne({}, { $set: { holidays: [], 'markingWindow.end': '23:59' } });
  teacher = await loginPin(DEMO.teacherPhone);
  parent = await loginPin(DEMO.parentPhone);
  parentUser = await User.findOne({ phone: DEMO.parentPhone });
  fourA = await ClassRoom.findOne({ grade: '4' });
  riya = await Student.findOne({ name: 'Riya S' });
  pushes = [];
  setSender(async (sub, payload) => { pushes.push({ endpoint: sub.endpoint, ...JSON.parse(payload) }); });
  await api().post('/api/me/push').set(auth(parent)).send({ endpoint: 'https://push.example/riya-mum', keys: { p256dh: 'k', auth: 'a' } });
});
afterAll(stop);

const isOpen = () => !closedReason({ holidays: [] }, today);

(isOpen() ? describe : describe.skip)('absence alerts (Phase 3 gate)', () => {
  test('parent is alerted after the short delay, never before, and only once', async () => {
    await mark(teacher, fourA._id, [[riya, 'A']]);
    expect(await runAbsenceAlerts({ now: minutesFromNow(1) })).toBe(0); // inside the 2-minute grace
    const t0 = Date.now();
    expect(await runAbsenceAlerts({ now: minutesFromNow(3) })).toBe(1);
    expect(await runAbsenceAlerts({ now: minutesFromNow(4) })).toBe(0); // no repeat
    const note = await Notification.findOne({ userId: parentUser._id, type: 'absent' });
    expect(note.payload.title).toMatch(/Riya S/);
    const push = pushes.find((p) => p.title.includes('Riya S'));
    expect(push.replyToken).toBeTruthy();
    expect(push.actions.map((a) => a.action)).toEqual(['sick', 'family']);
    // Alerted 3 minutes after the mark: inside the 5-minute target.
    expect(note.sentAt.getTime() - t0).toBeLessThan(5 * 60 * 1000);
  });

  test('one tap on the notification records the reason; the teacher sees it', async () => {
    const push = pushes.find((p) => p.title.includes('Riya S'));
    const r = await api().post('/api/public/absence-reply').send({ token: push.replyToken, reason: 'sick' });
    expect(r.status).toBe(200);
    const roster = await api().get(`/api/classes/${fourA._id}/roster`).set(auth(teacher));
    const m = roster.body.marks.find((x) => x.studentId === String(riya._id));
    expect(m).toMatchObject({ status: 'A', reason: 'sick', reasonBy: 'parent' });
    const teacherUser = await User.findOne({ phone: DEMO.teacherPhone });
    expect(await Notification.countDocuments({ userId: teacherUser._id, type: 'absence_reason' })).toBe(1);
  });

  test('a forged or wrong-purpose token is refused', async () => {
    expect((await api().post('/api/public/absence-reply').send({ token: 'nope', reason: 'sick' })).status).toBe(401);
    expect((await api().post('/api/public/absence-reply').send({ token: parent, reason: 'sick' })).status).toBe(401);
  });

  test('correcting an alerted absence tells the parent the child is in school', async () => {
    await School.updateOne({}, { $set: { 'markingWindow.end': '23:59' } });
    await mark(teacher, fourA._id, [[riya, 'P']], minutesFromNow(5));
    expect(await Notification.countDocuments({ userId: parentUser._id, type: 'absent_cleared' })).toBe(1);
  });

  test('parent can reply in the app too, and sees the inbox', async () => {
    const other = (await Student.find({ classId: fourA._id }).sort({ rollNo: 1 }))[9];
    await mark(teacher, fourA._id, [[other, 'A']]);
    const rec = await Attendance.findOne({ studentId: other._id, date: today });
    // Riya's parent cannot answer for someone else's child.
    expect((await api().post(`/api/me/absences/${rec._id}/reason`).set(auth(parent)).send({ reason: 'family' })).status).toBe(403);
    const inbox = await api().get('/api/me/notifications').set(auth(parent));
    expect(inbox.body.unread).toBeGreaterThanOrEqual(2);
    await api().post('/api/me/notifications/read').set(auth(parent)).send({});
    expect((await api().get('/api/me/notifications').set(auth(parent))).body.unread).toBe(0);
  });
});

describe('leave requests', () => {
  let leaveId, from, to;
  beforeAll(() => {
    from = addDays(today, 1);
    while (closedReason({ holidays: [] }, from)) from = addDays(from, 1);
    to = addDays(from, 2);
  });

  test('parent applies; class teacher is notified', async () => {
    const r = await api().post('/api/leave').set(auth(parent)).send({ studentId: String(riya._id), from, to, reason: 'Family wedding in Hassan' });
    expect(r.status).toBe(201);
    leaveId = r.body.leave._id;
    const list = await api().get('/api/leave?status=pending').set(auth(teacher));
    expect(list.body.leaves.map((l) => l._id)).toContain(leaveId);
  });

  test('a teacher of another class cannot decide it', async () => {
    const other = await loginPin('9000000001');
    expect((await api().patch(`/api/leave/${leaveId}`).set(auth(other)).send({ decision: 'approved' })).status).toBe(403);
  });

  test('approval marks each school day as leave, without counting as a taken register', async () => {
    const r = await api().patch(`/api/leave/${leaveId}`).set(auth(teacher)).send({ decision: 'approved' });
    expect(r.status).toBe(200);
    expect(r.body.daysMarked).toBeGreaterThanOrEqual(2);
    const rec = await Attendance.findOne({ studentId: riya._id, date: from });
    expect(rec).toMatchObject({ status: 'LV', source: 'leave', reasonBy: 'leave' });
    expect(await Notification.countDocuments({ userId: parentUser._id, type: 'leave_decision' })).toBe(1);
    expect((await api().patch(`/api/leave/${leaveId}`).set(auth(teacher)).send({ decision: 'rejected' })).status).toBe(400);
  });

  test('parent month view shows days and percentages', async () => {
    const r = await api().get(`/api/me/children/${riya._id}/attendance`).set(auth(parent));
    expect(r.status).toBe(200);
    expect(r.body.yearStats.days).toBeGreaterThan(3);
    expect(r.body.leaves[0].status).toBe('approved');
  });
});

describe('leave in a period-wise class', () => {
  test('approved leave marks every period, so no subject teacher starts the child as present', async () => {
    const { applyLeave } = require('../src/services/leave');
    const ten = await ClassRoom.findOne({ grade: '10' });
    const child = await Student.findOne({ classId: ten._id });
    let day = addDays(today, 1);
    while (closedReason({ holidays: [] }, day)) day = addDays(day, 1);
    await Attendance.deleteMany({ studentId: child._id, date: day });
    const hm = await User.findOne({ role: 'admin' });
    const n = await applyLeave({ schoolId: ten.schoolId, studentId: child._id, from: day, to: day, reason: 'Fever' }, hm);
    expect(n).toBe(ten.periodsPerDay);
    const recs = await Attendance.find({ studentId: child._id, date: day }).sort({ period: 1 });
    expect(recs.map((r) => r.period)).toEqual(Array.from({ length: ten.periodsPerDay }, (_, i) => i + 1));
    expect(recs.every((r) => r.status === 'LV' && r.source === 'leave')).toBe(true);
  });
});

describe('pre-primary pickup', () => {
  let lkg, child, lkgTeacher, childParent, guardian;
  beforeAll(async () => {
    lkg = await ClassRoom.findOne({ grade: 'LKG' });
    child = await Student.findOne({ classId: lkg._id, rollNo: 1 });
    lkgTeacher = await loginPin('9000000002');
    const pUser = await User.findById(child.parentIds[0]);
    if (!pUser.pinHash) { await pUser.setPin('1234'); await pUser.save(); }
    childParent = await loginPin(pUser.phone);
    guardian = child.pickupGuardians.find((g) => g.relation === 'Grandparent');
  });

  (isOpen() ? test : test.skip)('QR pass: check in, hand over to the named guardian, parent told; no double hand-over', async () => {
    const pass = await api().get(`/api/me/children/${child._id}/pickup-pass`).query({ guardianId: String(guardian._id) }).set(auth(childParent));
    expect(pass.body.qr).toMatch(/^HJ1:[A-Za-z0-9_-]{51}$/);
    const early = await api().post('/api/pickup/checkout').set(auth(lkgTeacher)).send({ passToken: pass.body.qr });
    expect(early.status).toBe(400); // not checked in yet
    await mark(lkgTeacher, lkg._id, [[child, 'P']]);
    const r = await api().post('/api/pickup/checkout').set(auth(lkgTeacher)).send({ passToken: pass.body.qr });
    expect(r.status).toBe(200);
    expect(r.body.pickup).toMatchObject({ method: 'qr', collectedBy: { relation: 'Grandparent' } });
    const pUserId = child.parentIds[0];
    expect(await Notification.countDocuments({ userId: pUserId, type: 'picked_up' })).toBe(1);
    expect((await api().post('/api/pickup/checkout').set(auth(lkgTeacher)).send({ passToken: pass.body.qr })).status).toBe(409);
    const board = await api().get(`/api/pickup/class/${lkg._id}/today`).set(auth(lkgTeacher));
    expect(board.body.students.find((s) => s._id === String(child._id)).pickup.checkOutAt).toBeTruthy();
  });

  test('a pass cannot be used by a teacher of another class, and strangers are refused', async () => {
    const pass = await api().get(`/api/me/children/${child._id}/pickup-pass`).query({ guardianId: String(guardian._id) }).set(auth(childParent));
    expect((await api().post('/api/pickup/checkout').set(auth(teacher)).send({ passToken: pass.body.qr })).status).toBe(403);
    expect((await api().post('/api/pickup/checkout').set(auth(lkgTeacher)).send({ studentId: String(child._id), guardianId: String(riya._id) })).status).toBe(403);
    expect((await api().post('/api/pickup/checkout').set(auth(lkgTeacher)).send({ passToken: pass.body.qr.slice(0, -3) + 'AAA' })).status).toBe(400);
  });

  (isOpen() ? test : test.skip)('late pickup alerts the class teacher and office once', async () => {
    const kid2 = await Student.findOne({ classId: lkg._id, rollNo: 2 });
    await mark(lkgTeacher, lkg._id, [[kid2, 'P']]);
    const school = await School.findOne();
    const [h, m] = nowTimeIn(school.timezone).split(':').map(Number);
    const earlier = Math.max(0, h * 60 + m - 45);
    await School.updateOne({}, { $set: { pickupTime: `${String(Math.floor(earlier / 60)).padStart(2, '0')}:${String(earlier % 60).padStart(2, '0')}` } });
    if (h * 60 + m < 45) return; // just after midnight: nothing can be late yet
    const n = await runLatePickupAlerts();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await runLatePickupAlerts()).toBe(0);
    const t = await User.findOne({ phone: '9000000002' });
    expect(await Notification.countDocuments({ userId: t._id, type: 'late_pickup' })).toBeGreaterThanOrEqual(1);
    expect(await PickupLog.countDocuments({ studentId: kid2._id, lateAlertedAt: { $ne: null } })).toBe(1);
  });

  test('parents edit the pickup list; photos must be small images', async () => {
    const bad = await api().put(`/api/me/children/${child._id}/guardians`).set(auth(childParent)).send({ guardians: [{ name: 'Uncle', relation: 'Uncle', photoUrl: 'javascript:alert(1)' }] });
    expect(bad.status).toBe(400);
    const ok = await api().put(`/api/me/children/${child._id}/guardians`).set(auth(childParent))
      .send({ guardians: [...child.pickupGuardians.map((g) => ({ _id: String(g._id), name: g.name, relation: g.relation })), { name: 'Manju', relation: 'Uncle', photoUrl: 'data:image/jpeg;base64,AAAA' }] });
    expect(ok.status).toBe(200);
    expect(ok.body.guardians).toHaveLength(child.pickupGuardians.length + 1);
    expect((await api().put(`/api/me/children/${riya._id}/guardians`).set(auth(childParent)).send({ guardians: [{ name: 'X Y', relation: 'Uncle' }] })).status).toBe(403);
  });
});
