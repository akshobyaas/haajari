const { ClassRoom, Student } = require('../models');
const { forbidden, notFound } = require('../utils/errors');

// Class ids a teacher may see: classes they lead plus classes they teach a subject in.
async function teacherClassIds(user) {
  const led = await ClassRoom.find({ classTeacherId: user._id, active: true }).distinct('_id');
  const subjectIds = (user.subjects || []).map((s) => String(s.classId));
  return [...new Set([...led.map(String), ...subjectIds])];
}

async function assertClassAccess(user, classId) {
  const cls = await ClassRoom.findOne({ _id: classId, schoolId: user.schoolId });
  if (!cls) throw notFound('Class');
  if (user.role === 'admin') return cls;
  if (user.role === 'teacher' && (await teacherClassIds(user)).includes(String(cls._id))) return cls;
  throw forbidden('This class is not assigned to you.');
}

async function assertStudentAccess(user, studentId) {
  const student = await Student.findOne({ _id: studentId, schoolId: user.schoolId });
  if (!student) throw notFound('Student');
  if (user.role === 'admin') return student;
  if (user.role === 'parent') {
    if (student.parentIds.some((p) => String(p) === String(user._id))) return student;
    throw forbidden();
  }
  await assertClassAccess(user, student.classId);
  return student;
}

module.exports = { teacherClassIds, assertClassAccess, assertStudentAccess };
