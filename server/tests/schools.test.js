const { api, start, stop, auth, loginAdmin, DEMO } = require('./helpers');
const { School, User } = require('../src/models');

const login = (email, password = 'Haajari@2026') => api().post('/api/auth/login').send({ email, password });

const request = (over = {}) => ({
  school: { name: 'GLPS Hinkal', udiseCode: '29261200777', district: 'Mysuru', block: 'Mysuru North', ...over.school },
  hm: { name: 'Sri. Manjunath K', email: 'hm@glps-hinkal.in', phone: '9300000077', password: 'Hinkal@2026', ...over.hm },
  note: 'Five classes',
});

let approver;
beforeAll(async () => {
  await start();
  approver = (await login(DEMO.approverEmail)).body.token;
});
afterAll(stop);

describe('registering a school', () => {
  let schoolId;

  test('a headmaster asks to join; the school waits as pending', async () => {
    const r = await api().post('/api/public/school-requests').send(request());
    expect(r.status).toBe(201);
    expect(r.body.school.status).toBe('pending');
    schoolId = r.body.school.id;
  });

  test('the headmaster cannot log in before approval, with a clear reason', async () => {
    const r = await login('hm@glps-hinkal.in', 'Hinkal@2026');
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('school_pending');
  });

  test('the same UDISE code, email or phone cannot be registered twice', async () => {
    const again = await api().post('/api/public/school-requests').send(request({ hm: { email: 'other@x.in', phone: '9300000078' } }));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('udise_taken');
    const email = await api().post('/api/public/school-requests').send(request({ school: { udiseCode: '29261200778' }, hm: { email: DEMO.adminEmail, phone: '9300000079' } }));
    expect(email.status).toBe(409);
    expect(email.body.error.details.field).toBe('email');
  });

  test('bad details are refused field by field', async () => {
    const r = await api().post('/api/public/school-requests').send(request({ school: { udiseCode: '123' } }));
    expect(r.status).toBe(400);
    expect(r.body.error.fields[0].field).toBe('school.udiseCode');
  });

  test('only the approver sees and decides requests', async () => {
    const hm = await loginAdmin();
    expect((await api().get('/api/platform/schools').set(auth(hm))).status).toBe(403);
    const list = await api().get('/api/platform/schools').set(auth(approver));
    expect(list.status).toBe(200);
    const mine = list.body.schools.find((s) => s.id === schoolId);
    expect(mine).toMatchObject({ status: 'pending', head: { email: 'hm@glps-hinkal.in' } });
    const kps = list.body.schools.find((s) => s.udiseCode === '29261200101');
    expect(kps.status).toBe('active');
    expect(kps.classes).toBe(13);
    expect(kps.today).toBeDefined();
  });

  test('after approval the headmaster logs in to an empty school of their own', async () => {
    const d = await api().post(`/api/platform/schools/${schoolId}/decision`).set(auth(approver)).send({ decision: 'approved' });
    expect(d.status).toBe(200);
    const r = await login('hm@glps-hinkal.in', 'Hinkal@2026');
    expect(r.status).toBe(200);
    expect(r.body.user.role).toBe('admin');
    const classes = await api().get('/api/classes').set(auth(r.body.token));
    expect(classes.status).toBe(200);
    expect(classes.body.classes).toHaveLength(0); // sees nothing of the demo school
    expect((await api().post(`/api/platform/schools/${schoolId}/decision`).set(auth(approver)).send({ decision: 'rejected' })).status).toBe(400);
  });
});

describe('turning a request down', () => {
  test('the headmaster is told, and can apply again with the same email', async () => {
    const pending = await School.findOne({ udiseCode: '29261200245' }); // seeded request
    const d = await api().post(`/api/platform/schools/${pending._id}/decision`).set(auth(approver)).send({ decision: 'rejected', reason: 'UDISE code does not match the school name' });
    expect(d.status).toBe(200);
    const told = await login('hm@ghps-kuvempunagar.in');
    expect(told.status).toBe(403);
    expect(told.body.error).toMatchObject({ code: 'school_rejected', details: { reason: 'UDISE code does not match the school name' } });
    const again = await api().post('/api/public/school-requests').send(request({
      school: { udiseCode: '29261200245', name: 'GHPS Kuvempunagar' },
      hm: { email: 'hm@ghps-kuvempunagar.in', phone: '9300000001' },
    }));
    expect(again.status).toBe(201);
    expect(await User.countDocuments({ email: 'hm@ghps-kuvempunagar.in' })).toBe(1);
  });
});

describe('adding a school directly', () => {
  test('the approver adds a school that is active at once', async () => {
    const r = await api().post('/api/platform/schools').set(auth(approver)).send(request({
      school: { udiseCode: '29261200999', name: 'GHS Bogadi' },
      hm: { email: 'hm@ghs-bogadi.in', phone: '9300000099' },
    }));
    expect(r.status).toBe(201);
    expect(r.body.school.status).toBe('active');
    expect((await login('hm@ghs-bogadi.in', 'Hinkal@2026')).status).toBe(200);
  });

  test('a headmaster cannot add schools', async () => {
    const hm = await loginAdmin();
    expect((await api().post('/api/platform/schools').set(auth(hm)).send(request())).status).toBe(403);
  });
});

describe('approver account from settings', () => {
  test('is created once, and its password follows the setting', async () => {
    const { ensureApprover } = require('../src/utils/approver');
    await ensureApprover({ email: 'beo@mysuru.in', password: 'First@2026' });
    expect((await login('beo@mysuru.in', 'First@2026')).status).toBe(200);
    await ensureApprover({ email: 'beo@mysuru.in', password: 'Second@2026' });
    expect((await login('beo@mysuru.in', 'First@2026')).status).toBe(401);
    expect((await login('beo@mysuru.in', 'Second@2026')).status).toBe(200);
    expect(await User.countDocuments({ email: 'beo@mysuru.in' })).toBe(1);
    expect(await ensureApprover({ email: DEMO.adminEmail, password: 'x' })).toBeNull(); // never takes over a school account
  });
});
