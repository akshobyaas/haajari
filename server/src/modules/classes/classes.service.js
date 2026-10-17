const { ClassRoom, Student, User, School, Attendance, GRADES, defaultModeFor } = require('../../models');
const { todaySummary } = require('../attendance/attendance.service');
const { todayIn, closedReason, editNeedsReason } = require('../../shared/dates');
const { teacherClassIds, assertClassAccess } = require('../../middleware/access');
const { badRequest, forbidden } = require('../../shared/errors');

const gradeOrder = (g) => GRADES.indexOf(g);

// Adds how many children each class has, and sorts Pre-KG -> Class 10, then by section.
async function withCounts(classes) {
  const counts = await Student.aggregate([
    { $match: { classId: { $in: classes.map((c) => c._id) }, active: true } },
    { $group: { _id: '$classId', n: { $sum: 1 } } },
  ]);
  const byId = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  return classes
    .map((c) => ({ ...c.toObject(), studentCount: byId[String(c._id)] || 0 }))
    .sort((a, b) => gradeOrder(a.grade) - gradeOrder(b.grade) || a.section.localeCompare(b.section));
}

// Classes the user may see (a teacher: the ones they teach), with today's register state.
async function listClasses(user) {
  const filter = { schoolId: user.schoolId, active: true };
  if (user.role === 'teacher') filter._id = { $in: await teacherClassIds(user) };
  else if (user.role !== 'admin') throw forbidden();
  const [classes, school] = await Promise.all([
    ClassRoom.find(filter).populate('classTeacherId', 'name phone'),
    School.findById(user.schoolId),
  ]);
  const today = todayIn(school.timezone);
  const marked = await todaySummary(classes, today);
  const list = (await withCounts(classes)).map((c) => ({ ...c, today: marked[String(c._id)] || null }));
  return { date: today, closed: closedReason(school, today), classes: list };
}

// Everything the marking screen needs, in one request (also cached on the phone for offline use).
async function roster(user, classId, date) {
  const cls = await assertClassAccess(user, classId);
  const school = await School.findById(user.schoolId);
  const day = date || todayIn(school.timezone);
  const [students, marks] = await Promise.all([
    Student.find({ classId: cls._id, active: true }).select('name rollNo gender photoUrl admissionNo').sort({ rollNo: 1, name: 1 }),
    Attendance.find({ classId: cls._id, date: day }).select('studentId period status markedAt reason reasonBy source alertedAt').populate('markedBy', 'name'),
  ]);
  return {
    class: { _id: cls._id, grade: cls.grade, section: cls.section, mode: cls.mode, periodsPerDay: cls.periodsPerDay, classTeacherId: cls.classTeacherId },
    date: day,
    today: todayIn(school.timezone),
    closed: closedReason(school, day),
    editNeedsReason: editNeedsReason(school, day),
    school: { markingWindow: school.markingWindow, timezone: school.timezone, teacherBackdateDays: school.teacherBackdateDays, holidays: school.holidays },
    students,
    marks,
  };
}

async function getClass(user, classId) {
  const cls = await assertClassAccess(user, classId);
  await cls.populate('classTeacherId', 'name phone');
  return { class: (await withCounts([cls]))[0] };
}

async function assertTeacherOfSchool(schoolId, teacherId) {
  if (!teacherId) return;
  const t = await User.findOne({ _id: teacherId, schoolId, role: 'teacher', active: true });
  if (!t) throw badRequest('Pick a teacher from this school.');
}

async function createClass(user, body) {
  await assertTeacherOfSchool(user.schoolId, body.classTeacherId);
  const cls = await ClassRoom.create({ ...body, mode: body.mode || defaultModeFor(body.grade), schoolId: user.schoolId });
  return { class: cls };
}

async function updateClass(user, classId, body) {
  await assertTeacherOfSchool(user.schoolId, body.classTeacherId);
  const cls = await assertClassAccess(user, classId);
  Object.assign(cls, body);
  await cls.save();
  return { class: cls };
}

// Soft delete: attendance history stays intact.
async function removeClass(user, classId) {
  const cls = await assertClassAccess(user, classId);
  const n = await Student.countDocuments({ classId: cls._id, active: true });
  if (n > 0) throw badRequest(`Move or remove the ${n} students in this class first.`);
  cls.active = false;
  await cls.save();
  return { ok: true };
}

module.exports = { listClasses, roster, getClass, createClass, updateClass, removeClass };
