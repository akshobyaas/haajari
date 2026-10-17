const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { api, start, stop, auth, loginAdmin, loginPin, DEMO } = require('./helpers');
const { ClassRoom, Attendance, School, Student, RiskFlag, User, PickupLog } = require('../src/models');
const { todayIn, closedReason } = require('../src/shared/dates');
const { evaluateRisk } = require('../src/modules/risk/risk.service');

const today = todayIn('Asia/Kolkata');
const month = today.slice(0, 7);
let admin, teacher, fourA, kids;
const cid = () => crypto.randomUUID();
const mark = (token, classId, list) => api().post('/api/attendance/bulk').set(auth(token)).send({
  classId: String(classId), date: today, marks: list.map(([s, status]) => ({ studentId: String(s._id), status, clientId: cid(), markedAt: new Date().toISOString() })),
});
const binary = (res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); };

beforeAll(async () => {
  await start();
  await School.updateOne({}, { $set: { holidays: [], 'markingWindow.end': '23:59' } });
  admin = await loginAdmin();
  teacher = await loginPin(DEMO.teacherPhone);
  fourA = await ClassRoom.findOne({ grade: '4' });
  kids = await Student.find({ classId: fourA._id }).sort({ rollNo: 1 });
});
afterAll(stop);

describe('monthly register (Phase 4 gate)', () => {
  test('every total matches a count straight from the attendance records', async () => {
    const r = await api().get('/api/reports/register').query({ classId: String(fourA._id), month }).set(auth(teacher));
    expect(r.status).toBe(200);
    const reg = r.body;
    const school = await School.findOne();
    // The "hand count": raw records, counted independently of the report code.
    const raw = await Attendance.find({ classId: fourA._id, period: 0, date: { $regex: `^${month}` } });
    const open = raw.filter((m) => !closedReason(school, m.date));
    const presentRaw = open.filter((m) => ['P', 'L'].includes(m.status)).length;
    const absentRaw = open.filter((m) => m.status === 'A').length;
    const leaveRaw = open.filter((m) => m.status === 'LV').length;
    const workingRaw = new Set(open.map((m) => m.date)).size;

    expect(reg.totals.workingDays).toBe(workingRaw);
    expect(reg.totals.presentDays).toBe(presentRaw);
    expect(reg.totals.absentDays).toBe(absentRaw);
    expect(reg.totals.leaveDays).toBe(leaveRaw);
    // Row totals and column totals agree with each other (the cross-check a teacher does on paper).
    expect(reg.rows.reduce((a, x) => a + x.present, 0)).toBe(reg.daily.reduce((a, d) => a + d.present, 0));
    expect(reg.rows).toHaveLength(kids.length);
    // Spot-check individual cells.
    for (const m of open.slice(0, 25)) {
      const row = reg.rows.find((x) => x._id === String(m.studentId));
      expect(row.marks[m.date]).toBe(m.status);
    }
    // Per-child percentage is present / working days.
    const someone = reg.rows[5];
    expect(someone.pct).toBeCloseTo(Math.round((someone.present / someone.workingDays) * 1000) / 10, 5);
  });

  test('the Excel register carries the same totals', (done) => {
    api().get('/api/reports/register').query({ classId: String(fourA._id), month, format: 'xlsx' }).set(auth(teacher))
      .buffer().parse(binary)
      .end(async (err, res) => {
        expect(res.status).toBe(200);
        const json = (await api().get('/api/reports/register').query({ classId: String(fourA._id), month }).set(auth(teacher))).body;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(res.body);
        const ws = wb.worksheets[0];
        const totalRow = ws.getRow(5 + json.rows.length);
        const n = json.days.length;
        expect(totalRow.getCell(3 + n).value).toBe(json.totals.presentDays);
        expect(totalRow.getCell(3 + n + 3).value).toBe(json.totals.workingDays);
        expect(ws.getRow(5).getCell(2).value).toBe(json.rows[0].name);
        done();
      });
  });

  test('a teacher cannot open another class register', async () => {
    const seven = await ClassRoom.findOne({ grade: '7' });
    expect((await api().get('/api/reports/register').query({ classId: String(seven._id), month }).set(auth(teacher))).status).toBe(403);
  });
});

(closedReason({ holidays: [] }, today) ? describe.skip : describe)('live dashboard', () => {
  test('headcount, class %, meals and who is in school now', async () => {
    // Roll 6 stays absent: the at-risk test below relies on the streak continuing today.
    await mark(teacher, fourA._id, kids.map((k, i) => [k, i < 3 || k.rollNo === 6 ? 'A' : 'P']));
    const lkg = await ClassRoom.findOne({ grade: 'LKG' });
    const lkgKids = await Student.find({ classId: lkg._id }).sort({ rollNo: 1 }).limit(4);
    const lkgTeacher = await loginPin('9000000002');
    await mark(lkgTeacher, lkg._id, lkgKids.map((k) => [k, 'P']));
    await PickupLog.create({ schoolId: lkg.schoolId, studentId: lkgKids[0]._id, date: today, checkOutAt: new Date(), collectedBy: { name: 'X', relation: 'Mother' } });

    const r = await api().get('/api/dashboard/today').set(auth(admin));
    expect(r.status).toBe(200);
    const row = r.body.classes.find((c) => c.grade === '4');
    expect(row).toMatchObject({ marked: true, A: 4, present: kids.length - 4 });
    expect(row.pct).toBeCloseTo(((kids.length - 4) / kids.length) * 100, 0);
    const lkgRow = r.body.classes.find((c) => c.grade === 'LKG');
    expect(lkgRow.inSchool).toHaveLength(3); // one already picked up
    expect(lkgRow.goneHome).toBe(1);
    expect(r.body.totals.marked).toBe(2);
    expect(r.body.totals.meals).toBe(kids.length - 4 + 4); // Class 4 and LKG both get meals
    expect(r.body.classes.find((c) => c.grade === '10').meal).toBe(false);
    expect((await api().get('/api/dashboard/today').set(auth(teacher))).status).toBe(403);
  });

  test('trend lists past school days with a percentage', async () => {
    const r = await api().get('/api/dashboard/trend?days=10').set(auth(admin));
    expect(r.body.days.length).toBeGreaterThanOrEqual(5);
    expect(r.body.days.every((d) => d.pct > 0 && d.pct <= 100)).toBe(true);
  });
});

describe('at-risk children', () => {
  let flag;
  test('a child absent several days in a row is flagged, and the class teacher is told', async () => {
    const school = await School.findOne();
    await evaluateRisk(school, today);
    const roll6 = kids.find((k) => k.rollNo === 6);
    flag = await RiskFlag.findOne({ studentId: roll6._id, active: true });
    expect(flag).toBeTruthy();
    expect(flag.reasons).toContain('streak');
    expect(flag.streak).toBeGreaterThanOrEqual(3);
    const t = await User.findOne({ phone: DEMO.teacherPhone });
    const { Notification } = require('../src/models');
    expect(await Notification.countDocuments({ userId: t._id, type: 'at_risk' })).toBeGreaterThanOrEqual(1);
  });

  test('teacher sees only their class; follow-ups are recorded; others cannot add them', async () => {
    const r = await api().get('/api/risk').set(auth(teacher));
    expect(r.body.flags.length).toBeGreaterThanOrEqual(1);
    expect(r.body.flags.every((f) => f.classId._id === String(fourA._id))).toBe(true);
    const f = await api().post(`/api/risk/${flag._id}/follow-up`).set(auth(teacher)).send({ type: 'visit', note: 'Visited home; fever, back Monday' });
    expect(f.status).toBe(200);
    expect(f.body.flag.followUps[0].by.name).toMatch(/Rekha/);
    const other = await loginPin('9000000001');
    expect((await api().post(`/api/risk/${flag._id}/follow-up`).set(auth(other)).send({ type: 'call' })).status).toBe(403);
    const all = await api().get('/api/risk').set(auth(admin));
    expect(all.body.flags.length).toBeGreaterThanOrEqual(r.body.flags.length);
  });

  test('the flag clears when the child is back and attendance recovers', async () => {
    const roll6 = kids.find((k) => k.rollNo === 6);
    await Attendance.deleteMany({ studentId: roll6._id, status: 'A' });
    await evaluateRisk(await School.findOne(), today);
    expect(await RiskFlag.countDocuments({ studentId: roll6._id, active: true })).toBe(0);
  });
});

describe('shortage list and SATS export', () => {
  test('shortage list holds only children below the threshold', async () => {
    const r = await api().get('/api/reports/shortage').query({ threshold: 90 }).set(auth(admin));
    expect(r.status).toBe(200);
    expect(r.body.students.every((s) => s.pct < 90)).toBe(true);
  });
  test('SATS CSV has one row per child with SATS ID and days present', async () => {
    const r = await api().get('/api/reports/sats').query({ month, format: 'csv' }).set(auth(admin));
    expect(r.status).toBe(200);
    const lines = r.text.trim().split('\n');
    expect(lines[0]).toBe('SATS ID,Student name,Admission no,Class,Section,Working days,Days present,Attendance %');
    expect(lines.length - 1).toBe(await Student.countDocuments({ active: true }));
    expect((await api().get('/api/reports/sats').query({ month }).set(auth(teacher))).status).toBe(403);
  });
});
