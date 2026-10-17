/**
 * The 9 a.m. rush: 50 classes of 40 children save at the same moment, then every phone
 * retries at once (as offline queues do after a network blip). Checks there is exactly
 * one record per child and reports response times.
 *
 * Runs the real API over HTTP against a throwaway database (dropped at the end):
 *   node scripts/loadtest.js
 *   MONGO_URI=mongodb+srv://... node scripts/loadtest.js   (e.g. your Atlas cluster)
 */
process.env.NODE_ENV ||= 'test'; // quiet request log
const mongoose = require('mongoose');
const env = require('../src/config/env');
const { createApp } = require('../src/app');
const { School, User, ClassRoom, Student, Attendance } = require('../src/models');
const { todayIn, addDays, closedReason } = require('../src/shared/dates');

const CLASSES = Number(process.env.CLASSES || 50);
const PER_CLASS = Number(process.env.PER_CLASS || 40);
const pct = (arr, p) => Math.round([...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))]);

(async () => {
  const uri = (process.env.MONGO_URI || env.mongoUri).replace(/\/[^/?]*(\?|$)/, `/haajari-loadtest-${Date.now()}$1`);
  await mongoose.connect(uri);
  const school = await School.create({ name: 'Load test school', academicYear: '2026-27', holidays: [], markingWindow: { start: '00:00', end: '23:59' } });
  let date = todayIn(school.timezone);
  while (closedReason(school, date)) date = addDays(date, -1); // Sunday: use the last school day
  const admin = new User({ schoolId: school._id, role: 'admin', name: 'Load admin', email: 'load@test.in' });
  await admin.setPassword('load-test-123');
  await admin.save();
  const classes = await ClassRoom.insertMany(Array.from({ length: CLASSES }, (_, i) => ({ schoolId: school._id, grade: '5', section: `X${i + 1}`, mode: 'daily' })));
  const kids = await Student.insertMany(classes.flatMap((c, i) => Array.from({ length: PER_CLASS }, (_, r) => ({ schoolId: school._id, admissionNo: `L${i}-${r}`, name: `Child ${i}-${r}`, classId: c._id, rollNo: r + 1 }))));

  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, body, token) => {
    const t0 = performance.now();
    const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json(), ms: performance.now() - t0 };
  };
  const { json: { token } } = await call('/auth/login', { email: 'load@test.in', password: 'load-test-123' });
  const batches = classes.map((c) => ({
    classId: String(c._id), date, period: 0,
    marks: kids.filter((k) => String(k.classId) === String(c._id)).map((k, n) => ({ studentId: String(k._id), status: n % 12 ? 'P' : 'A', clientId: `lt-${k._id}`, markedAt: new Date().toISOString() })),
  }));

  console.log(`${CLASSES} classes save at the same moment (${CLASSES * PER_CLASS} marks)`);
  let t = performance.now();
  const first = await Promise.all(batches.map((b) => call('/attendance/bulk', b, token)));
  console.log(`  finished in ${((performance.now() - t) / 1000).toFixed(1)} s; per class p50 ${pct(first.map((r) => r.ms), 50)} ms, p95 ${pct(first.map((r) => r.ms), 95)} ms; failed ${first.filter((r) => r.status !== 200).length}`);

  console.log('Every phone retries the same batch at once');
  t = performance.now();
  const again = await Promise.all(batches.map((b) => call('/attendance/bulk', b, token)));
  console.log(`  finished in ${((performance.now() - t) / 1000).toFixed(1)} s; failed ${again.filter((r) => r.status !== 200).length}; recognised as duplicates ${again.reduce((a, r) => a + (r.json.summary?.duplicate || 0), 0)}`);

  const stored = await Attendance.countDocuments({ schoolId: school._id, date });
  const unique = (await Attendance.distinct('studentId', { schoolId: school._id, date })).length;
  const ok = stored === CLASSES * PER_CLASS && unique === stored;
  console.log(`Stored ${stored} records for ${CLASSES * PER_CLASS} children, ${unique} distinct: ${ok ? 'exactly one each' : 'MISMATCH'}`);

  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(ok ? 0 : 1);
})().catch(async (e) => { console.error(e); try { await mongoose.connection.dropDatabase(); } catch { /* ignore */ } process.exit(1); });
