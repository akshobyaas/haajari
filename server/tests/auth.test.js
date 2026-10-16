const { api, start, stop, auth, DEMO } = require('./helpers');
const { User } = require('../src/models');

beforeAll(start);
afterAll(stop);

describe('staff login', () => {
  test('admin logs in with email and password', async () => {
    const r = await api().post('/api/auth/login').send({ email: DEMO.adminEmail, password: DEMO.adminPassword });
    expect(r.status).toBe(200);
    expect(r.body.user.role).toBe('admin');
    expect(r.body.token).toBeTruthy();
  });
  test('wrong password is refused with a clear message', async () => {
    const r = await api().post('/api/auth/login').send({ email: DEMO.adminEmail, password: 'nope-nope' });
    expect(r.status).toBe(401);
    expect(r.body.error.message).toMatch(/wrong/i);
  });
});

describe('PIN login', () => {
  test('teacher logs in with phone + PIN', async () => {
    const r = await api().post('/api/auth/pin-login').send({ phone: DEMO.teacherPhone, pin: DEMO.pin });
    expect(r.status).toBe(200);
    expect(r.body.user.role).toBe('teacher');
  });
  test('parent logs in with phone + PIN', async () => {
    const r = await api().post('/api/auth/pin-login').send({ phone: DEMO.parentPhone, pin: DEMO.pin });
    expect(r.status).toBe(200);
    expect(r.body.user.role).toBe('parent');
  });
  test('unregistered number gets told to contact the school', async () => {
    const r = await api().post('/api/auth/pin-login').send({ phone: '9999999999', pin: '1234' });
    expect(r.status).toBe(401);
    expect(r.body.error.message).toMatch(/school office/);
  });
  test('invalid phone format fails validation', async () => {
    const r = await api().post('/api/auth/pin-login').send({ phone: '12345', pin: '1234' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('validation');
  });
});

describe('first-time setup with OTP', () => {
  test('parent without a PIN verifies OTP, sets PIN, then logs in', async () => {
    const parent = await User.findOne({ role: 'parent', pinHash: { $exists: false } });
    const before = await api().post('/api/auth/pin-login').send({ phone: parent.phone, pin: '2580' });
    expect(before.status).toBe(400);
    expect(before.body.error.details.needsSetup).toBe(true);

    const req1 = await api().post('/api/auth/otp/request').send({ phone: parent.phone });
    expect(req1.body.devCode).toMatch(/^\d{6}$/);

    const wrong = await api().post('/api/auth/otp/verify').send({ phone: parent.phone, code: '000000' });
    expect(wrong.status).toBe(400);

    const ver = await api().post('/api/auth/otp/verify').send({ phone: parent.phone, code: req1.body.devCode });
    expect(ver.status).toBe(200);

    const set = await api().post('/api/auth/pin/setup').send({ setupToken: ver.body.setupToken, pin: '2580' });
    expect(set.status).toBe(200);
    expect(set.body.user.hasPin).toBe(true);

    const login = await api().post('/api/auth/pin-login').send({ phone: parent.phone, pin: '2580' });
    expect(login.status).toBe(200);
  });

  test('a setup token cannot be used as a login token', async () => {
    const parent = await User.findOne({ role: 'parent', pinHash: { $exists: false } });
    const req1 = await api().post('/api/auth/otp/request').send({ phone: parent.phone });
    const ver = await api().post('/api/auth/otp/verify').send({ phone: parent.phone, code: req1.body.devCode });
    const r = await api().get('/api/auth/me').set(auth(ver.body.setupToken));
    expect(r.status).toBe(401);
  });
});
