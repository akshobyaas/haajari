const { api, start, stop, auth, loginAdmin, loginPin, DEMO } = require('./helpers');
const { ClassRoom, Student, User } = require('../src/models');

let admin, teacher, parent, fourA, sevenA;
beforeAll(async () => {
  await start();
  admin = await loginAdmin();
  teacher = await loginPin(DEMO.teacherPhone);
  parent = await loginPin(DEMO.parentPhone);
  fourA = await ClassRoom.findOne({ grade: '4' });
  sevenA = await ClassRoom.findOne({ grade: '7' });
});
afterAll(stop);

test('seed creates PREKG to 10 with students', async () => {
  const r = await api().get('/api/classes').set(auth(admin));
  expect(r.status).toBe(200);
  expect(r.body.classes.map((c) => c.grade)).toEqual(['PREKG', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  expect(r.body.classes.every((c) => c.studentCount > 0)).toBe(true);
  expect(r.body.classes[0].mode).toBe('checkin');
  expect(r.body.classes[6].mode).toBe('daily');
});

test('teacher sees only their own class', async () => {
  const r = await api().get('/api/classes').set(auth(teacher));
  expect(r.body.classes.map((c) => c.grade)).toEqual(['4']);
  const other = await api().get(`/api/students?classId=${sevenA._id}`).set(auth(teacher));
  expect(other.status).toBe(403);
  const own = await api().get(`/api/students?classId=${fourA._id}`).set(auth(teacher));
  expect(own.status).toBe(200);
  expect(own.body.students.length).toBeGreaterThan(20);
});

test('subject teacher sees the classes they teach in', async () => {
  const t = await loginPin('9000000010'); // Smt. Leela Hegde, class teacher of 7, subject teacher elsewhere
  const r = await api().get('/api/classes').set(auth(t));
  expect(r.body.classes.length).toBeGreaterThan(1);
});

test('parent sees only their own child and cannot list students', async () => {
  const kids = await api().get('/api/me/children').set(auth(parent));
  expect(kids.status).toBe(200);
  expect(kids.body.children.map((c) => c.name)).toContain('Riya S');
  const list = await api().get('/api/students').set(auth(parent));
  expect(list.status).toBe(403);
  const me = await User.findOne({ phone: DEMO.parentPhone });
  const otherChild = await Student.findOne({ parentIds: { $ne: me._id } });
  const peek = await api().get(`/api/students/${otherChild._id}`).set(auth(parent));
  expect(peek.status).toBe(403);
});

test('only admin can create classes, users and see the dashboard', async () => {
  const body = { grade: '5', section: 'B' };
  expect((await api().post('/api/classes').set(auth(teacher)).send(body)).status).toBe(403);
  const ok = await api().post('/api/classes').set(auth(admin)).send(body);
  expect(ok.status).toBe(201);
  expect(ok.body.class.mode).toBe('daily');
  expect((await api().get('/api/users').set(auth(teacher))).status).toBe(403);
  expect((await api().get('/api/dashboard/summary').set(auth(parent))).status).toBe(403);
  const dash = await api().get('/api/dashboard/summary').set(auth(admin));
  expect(dash.body.students).toBeGreaterThan(300);
  expect(dash.body.studentsWithoutSats).toBeGreaterThan(0);
});

test('duplicate class gives a readable 409', async () => {
  const r = await api().post('/api/classes').set(auth(admin)).send({ grade: '4', section: 'A' });
  expect(r.status).toBe(409);
});

test('no token means 401 everywhere', async () => {
  expect((await api().get('/api/classes')).status).toBe(401);
  expect((await api().get('/api/school')).status).toBe(401);
});
