const { Student, User, AuditLog } = require('../../models');
const { teacherClassIds, assertClassAccess, assertStudentAccess } = require('../../middleware/access');
const { importStudents } = require('./students.import');
const { badRequest, forbidden } = require('../../shared/errors');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Admin: any class; teacher: their classes only. Search matches name, admission no. or SATS ID.
async function listStudents(user, { classId, search }) {
  const filter = { schoolId: user.schoolId, active: true };
  if (classId) {
    await assertClassAccess(user, classId);
    filter.classId = classId;
  } else if (user.role === 'teacher') {
    filter.classId = { $in: await teacherClassIds(user) };
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { admissionNo: rx }, { satsId: rx }];
  }
  const students = await Student.find(filter)
    .sort({ rollNo: 1, name: 1 })
    .limit(classId ? 500 : 100)
    .populate('parentIds', 'name phone')
    .populate('classId', 'grade section');
  return { students };
}

// Spreadsheet import. dryRun checks every row and saves nothing; otherwise all rows or none.
async function importFromCsv(admin, csvText, dryRun) {
  const result = await importStudents({ csvText, schoolId: admin.schoolId, dryRun });
  if (!dryRun && result.ok) {
    await AuditLog.create({
      schoolId: admin.schoolId, entity: 'student', entityId: admin._id, action: 'import',
      changedBy: admin._id, to: { created: result.created, updated: result.updated },
    });
  }
  return result;
}

async function getStudent(user, id) {
  const student = await assertStudentAccess(user, id);
  await student.populate([{ path: 'parentIds', select: 'name phone' }, { path: 'classId', select: 'grade section' }]);
  return { student };
}

// Finds or creates the parent account for a phone number.
async function linkParent(schoolId, parent) {
  if (!parent) return [];
  let user = await User.findOne({ phone: parent.phone });
  if (user && user.role !== 'parent') throw badRequest('This phone number belongs to a staff account.');
  if (!user) user = await User.create({ schoolId, role: 'parent', name: parent.name, phone: parent.phone });
  return [user._id];
}

async function createStudent(admin, body) {
  await assertClassAccess(admin, body.classId);
  const parentIds = await linkParent(admin.schoolId, body.parent);
  const pickupGuardians = body.pickupGuardians || (body.parent ? [{ ...body.parent }] : []);
  const student = await Student.create({ ...body, satsId: body.satsId || undefined, parentIds, pickupGuardians, schoolId: admin.schoolId });
  return { student };
}

// Moving a child to another class is written to the audit log.
async function updateStudent(admin, id, body) {
  const student = await assertStudentAccess(admin, id);
  if (body.classId) await assertClassAccess(admin, body.classId);
  const before = student.toObject();
  if (body.parent) {
    const [pid] = await linkParent(admin.schoolId, body.parent);
    if (!student.parentIds.some((p) => String(p) === String(pid))) student.parentIds.push(pid);
  }
  const { parent: _parent, ...rest } = body; // the parent was linked above; the rest updates the student
  if (rest.satsId === '') rest.satsId = undefined;
  Object.assign(student, rest);
  await student.save();
  if (body.classId && String(before.classId) !== String(body.classId)) {
    await AuditLog.create({
      schoolId: admin.schoolId, entity: 'student', entityId: student._id, action: 'move_class',
      changedBy: admin._id, from: before.classId, to: body.classId,
    });
  }
  return { student };
}

// Soft delete (left school / transfer). History is kept.
async function removeStudent(admin, id, reason) {
  const student = await assertStudentAccess(admin, id);
  if (!student.active) throw forbidden('Already removed.');
  student.active = false;
  await student.save();
  await AuditLog.create({ schoolId: admin.schoolId, entity: 'student', entityId: student._id, action: 'deactivate', changedBy: admin._id, reason });
  return { ok: true };
}

module.exports = { listStudents, importFromCsv, getStudent, createStudent, updateStudent, removeStudent };
