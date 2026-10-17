const { School, User, ClassRoom, Student } = require('../../models');
const { HttpError } = require('../../shared/errors');
const { todaySummary } = require('../attendance/attendance.service');
const { todayIn, closedReason } = require('../../shared/dates');
const { academicYearOf } = require('../../shared/attendanceRules');

const conflict = (code, message, details) => new HttpError(409, code, message, details);

// The same school (UDISE code) or the same headmaster login cannot be registered twice.
async function assertFree({ school, hm }) {
  // A headmaster whose earlier request was turned down may apply again with the same email and number.
  const rejected = await School.find({ status: 'rejected' }).distinct('_id');
  const [sameSchool, sameEmail, samePhone] = await Promise.all([
    School.findOne({ udiseCode: school.udiseCode, status: { $ne: 'rejected' } }).select('status').lean(),
    User.exists({ email: hm.email.toLowerCase(), schoolId: { $nin: rejected } }),
    User.exists({ phone: hm.phone, schoolId: { $nin: rejected } }),
  ]);
  if (sameSchool) {
    throw conflict('udise_taken', sameSchool.status === 'pending'
      ? 'A request for this UDISE code is already waiting for approval.'
      : 'A school with this UDISE code is already on Haajari.', { field: 'udiseCode' });
  }
  if (sameEmail) throw conflict('hm_taken', 'This email is already used by another account.', { field: 'email' });
  if (samePhone) throw conflict('hm_taken', 'This mobile number is already used by another account.', { field: 'phone' });
  // Clear the old, turned-down account so the new one can take its email and number.
  await User.deleteMany({ schoolId: { $in: rejected }, $or: [{ email: hm.email.toLowerCase() }, { phone: hm.phone }] });
}

/**
 * Creates a school and its headmaster account. status 'pending' for a request from the public
 * form (nobody can log in yet), 'active' when the approver adds the school directly.
 */
async function createSchool({ school, hm, note, status, decidedBy }) {
  await assertFree({ school, hm });
  const doc = await School.create({
    name: school.name,
    udiseCode: school.udiseCode,
    district: school.district,
    block: school.block,
    academicYear: academicYearOf(),
    status,
    request: { hmName: hm.name, hmEmail: hm.email.toLowerCase(), hmPhone: hm.phone, note, requestedAt: new Date() },
    ...(status === 'active' ? { decidedBy: decidedBy?._id, decidedAt: new Date() } : {}),
  });
  try {
    const head = new User({ schoolId: doc._id, role: 'admin', name: hm.name, email: hm.email, phone: hm.phone, language: 'kn' });
    await head.setPassword(hm.password);
    await head.save();
  } catch (err) {
    await School.deleteOne({ _id: doc._id }); // keep it all-or-nothing
    throw err;
  }
  return doc;
}

async function decide(id, { decision, reason }, by) {
  const school = await School.findById(id);
  if (!school) throw new HttpError(404, 'not_found', 'School not found.');
  if (school.status !== 'pending') throw new HttpError(400, 'bad_request', 'This request has already been decided.');
  school.decidedBy = by._id;
  school.decidedAt = new Date();
  if (decision === 'approved') {
    school.status = 'active';
  } else {
    school.status = 'rejected';
    school.rejectReason = reason;
    // The headmaster's account stays, so logging in tells them why; applying again replaces it.
  }
  await school.save();
  return school;
}

// Every school with its headmaster, size and today's register, for the approver's console.
async function listSchools() {
  const schools = await School.find().sort({ createdAt: -1 }).lean();
  const ids = schools.map((s) => s._id);
  const [classes, studentCounts, heads] = await Promise.all([
    ClassRoom.find({ schoolId: { $in: ids } }).select('schoolId mode').lean(),
    Student.aggregate([{ $match: { schoolId: { $in: ids }, active: { $ne: false } } }, { $group: { _id: '$schoolId', n: { $sum: 1 } } }]),
    User.find({ schoolId: { $in: ids }, role: 'admin' }).select('schoolId name email phone').lean(),
  ]);
  const studentsOf = new Map(studentCounts.map((r) => [String(r._id), r.n]));
  const out = [];
  for (const s of schools) {
    const cls = classes.filter((c) => String(c.schoolId) === String(s._id));
    const head = heads.find((h) => String(h.schoolId) === String(s._id));
    const row = {
      id: s._id, name: s.name, udiseCode: s.udiseCode, district: s.district, block: s.block, status: s.status || 'active',
      request: s.request, rejectReason: s.rejectReason, createdAt: s.createdAt, decidedAt: s.decidedAt,
      head: head ? { name: head.name, email: head.email, phone: head.phone } : null,
      classes: cls.length, students: studentsOf.get(String(s._id)) || 0,
    };
    if (row.status === 'active') {
      const date = todayIn(s.timezone || 'Asia/Kolkata');
      const closed = closedReason(s, date);
      const sum = closed ? {} : await todaySummary(cls, date);
      const vals = Object.values(sum);
      const marked = vals.reduce((a, v) => a + v.marked, 0);
      const present = vals.reduce((a, v) => a + v.P + v.L, 0);
      row.today = { date, closed: closed || null, registersTaken: vals.length, present, marked };
    }
    out.push(row);
  }
  return out;
}

module.exports = { createSchool, decide, listSchools };
