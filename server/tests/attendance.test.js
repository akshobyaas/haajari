const crypto = require('crypto');
const { api, start, stop, auth, loginAdmin, loginPin, DEMO } = require('./helpers');
const { ClassRoom, Attendance, AuditLog, School, Student, User } = require('../src/models');
const { todayIn, closedReason, addDays } = require('../src/shared/dates');

let teacher, admin, fourA, students, today, school;
const cid = () => crypto.randomUUID();
const marksFor = (list, status = (i) => (i < 2 ? 'A' : 'P'), at = new Date()) =>
  list.map((s, i) => ({ studentId: String(s._id), status: status(i), clientId: cid(), markedAt: at.toISOString() }));
const bulk = (token, body) => api().post('/api/attendance/bulk').set(auth(token)).send(body);
const setWindowEnd = (end) => School.updateOne({}, { $set: { 'markingWindow.end': end } });

beforeAll(async () => {
  await start();
  teacher = await loginPin(DEMO.teacherPhone);
  admin = await loginAdmin();
  fourA = await ClassRoom.findOne({ grade: '4' });
  students = await Student.find({ classId: fourA._id }).sort({ rollNo: 1 });
  school = await School.findOne();
  today = todayIn(school.timezone);
  // If the tests run on a Sunday or holiday, open today so the suite still exercises "today".
  if (closedReason(school, today)) await School.updateOne({}, { $set: { holidays: [] } });
});
afterAll(stop);

const openToday = () => closedReason({ holidays: [] }, today) === null;

test('roster returns students and no marks for a fresh day', async () => {
  const r = await api().get(`/api/classes/${fourA._id}/roster`).set(auth(teacher));
  expect(r.status).toBe(200);
  expect(r.body.students).toHaveLength(students.length);
  expect(r.body.date).toBe(today);
  expect(r.body.school.markingWindow.end).toBeTruthy();
});

(openToday() ? test : test.skip)('saving a class creates one record per student; replaying the same batch adds nothing', async () => {
  await setWindowEnd('23:59');
  const marks = marksFor(students);
  const first = await bulk(teacher, { classId: String(fourA._id), date: today, marks });
  expect(first.status).toBe(200);
  expect(first.body.summary.created).toBe(students.length);

  const again = await bulk(teacher, { classId: String(fourA._id), date: today, marks });
  expect(again.status).toBe(200);
  expect(again.body.summary.duplicate).toBe(students.length);
  expect(await Attendance.countDocuments({ classId: fourA._id, date: today })).toBe(students.length);

  const cls = await api().get('/api/classes').set(auth(teacher));
  expect(cls.body.classes[0].today).toMatchObject({ A: 2, P: students.length - 2, marked: students.length });
});

(openToday() ? test : test.skip)('an older offline mark does not overwrite a newer one', async () => {
  const s = students[5];
  const newer = new Date();
  await bulk(teacher, { classId: String(fourA._id), date: today, marks: [{ studentId: String(s._id), status: 'L', clientId: cid(), markedAt: newer.toISOString() }] });
  const old = new Date(newer.getTime() - 60 * 60 * 1000);
  const r = await bulk(teacher, { classId: String(fourA._id), date: today, marks: [{ studentId: String(s._id), status: 'A', clientId: cid(), markedAt: old.toISOString() }] });
  expect(r.body.results[0]).toMatchObject({ result: 'stale', current: 'L' });
  expect((await Attendance.findOne({ studentId: s._id, date: today })).status).toBe('L');
});

(openToday() ? test : test.skip)('changing a saved mark after the marking time needs a reason, and is audited', async () => {
  await setWindowEnd('00:00');
  const s = students[0]; // marked A earlier
  const change = [{ studentId: String(s._id), status: 'P', clientId: cid(), markedAt: new Date().toISOString() }];
  const noReason = await bulk(teacher, { classId: String(fourA._id), date: today, marks: change });
  expect(noReason.status).toBe(422);
  expect(noReason.body.error.code).toBe('needs_reason');
  expect((await Attendance.findOne({ studentId: s._id, date: today })).status).toBe('A');

  const withReason = await bulk(teacher, { classId: String(fourA._id), date: today, marks: change, editReason: 'Came at 10:30 with parent' });
  expect(withReason.body.summary.updated).toBe(1);
  const log = await AuditLog.findOne({ entity: 'attendance', from: 'A', to: 'P' });
  expect(log.reason).toBe('Came at 10:30 with parent');

  const audit = await api().get('/api/attendance/audit').query({ studentId: String(s._id), date: today }).set(auth(teacher));
  expect(audit.body.logs[0].changedBy.name).toMatch(/Rekha/);
  await setWindowEnd('23:59');
});

test('teachers cannot mark other classes, future dates, or too far back', async () => {
  const sevenA = await ClassRoom.findOne({ grade: '7' });
  const seven = await Student.find({ classId: sevenA._id }).limit(2);
  expect((await bulk(teacher, { classId: String(sevenA._id), date: today, marks: marksFor(seven) })).status).toBe(403);
  const future = await bulk(teacher, { classId: String(fourA._id), date: addDays(today, 1), marks: marksFor(students.slice(0, 1)) });
  expect(future.status).toBe(400);
  expect(future.body.error.message).toMatch(/future/);
  let old = addDays(today, -20);
  while (closedReason(school, old)) old = addDays(old, -1);
  expect((await bulk(teacher, { classId: String(fourA._id), date: old, marks: marksFor(students.slice(0, 1)) })).status).toBe(400);
  expect((await bulk(admin, { classId: String(fourA._id), date: old, marks: marksFor(students.slice(0, 1)) })).status).toBe(200);
});

test('Sundays and holidays are closed', async () => {
  let sunday = today;
  while (new Date(`${sunday}T00:00:00Z`).getUTCDay() !== 0) sunday = addDays(sunday, -1);
  const r = await bulk(admin, { classId: String(fourA._id), date: sunday, marks: marksFor(students.slice(0, 1)) });
  expect(r.status).toBe(400);
  expect(r.body.error.message).toMatch(/Sunday/);
});

test('a student from another class is refused', async () => {
  const other = await Student.findOne({ classId: { $ne: fourA._id } });
  const r = await bulk(teacher, { classId: String(fourA._id), date: today, marks: marksFor([other]) });
  expect(r.status).toBe(400);
});

test('subject teacher can mark a period but not the daily register', async () => {
  const subj = await User.findOne({ role: 'teacher', 'subjects.0': { $exists: true } });
  const token = await loginPin(subj.phone);
  const clsId = subj.subjects[0].classId;
  const cls = await ClassRoom.findById(clsId);
  if (closedReason(school, today)) return;
  const kids = await Student.find({ classId: clsId }).limit(3);
  expect((await bulk(token, { classId: String(clsId), date: today, period: 0, marks: marksFor(kids) })).status).toBe(403);
  const r = await bulk(token, { classId: String(clsId), date: today, period: 3, marks: marksFor(kids) });
  expect(r.status).toBe(200);
  expect(cls).toBeTruthy();
});

test('class history lists past days with counts', async () => {
  const r = await api().get(`/api/attendance/class/${fourA._id}/history`).set(auth(teacher));
  expect(r.status).toBe(200);
  expect(r.body.days.length).toBeGreaterThanOrEqual(5);
  const d = r.body.days.find((x) => x.date !== today);
  expect(d.P + d.A + d.L + d.LV).toBe(students.length);
});

test('a class of 40 saves in one request', async () => {
  const big = await ClassRoom.create({ schoolId: school._id, grade: '5', section: 'Z', mode: 'daily', classTeacherId: fourA.classTeacherId });
  const kids = await Student.insertMany(Array.from({ length: 40 }, (_, i) => ({ schoolId: school._id, admissionNo: `BIG${i}`, name: `Kid ${i}`, classId: big._id, rollNo: i + 1 })));
  const t0 = Date.now();
  const r = await bulk(teacher, { classId: String(big._id), date: today, marks: marksFor(kids) });
  expect(r.status).toBe(200);
  expect(r.body.summary.created).toBe(40);
  expect(Date.now() - t0).toBeLessThan(3000);
});
