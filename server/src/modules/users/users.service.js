const { User, ClassRoom } = require('../../models');
const { notFound, badRequest } = require('../../shared/errors');

// Staff and parents of the headmaster's school, with the classes each teacher leads.
async function listUsers(admin, role) {
  const filter = { schoolId: admin.schoolId, active: true, ...(role ? { role } : {}) };
  const [users, led] = await Promise.all([
    User.find(filter).select('+pinHash').sort({ name: 1 }).limit(1000),
    ClassRoom.find({ schoolId: admin.schoolId, active: true, classTeacherId: { $ne: null } }).select('grade section classTeacherId'),
  ]);
  const ledBy = {};
  led.forEach((c) => (ledBy[String(c.classTeacherId)] ||= []).push(`${c.grade}-${c.section}`));
  return { users: users.map((u) => ({ ...u.toPublic(), classTeacherOf: ledBy[String(u._id)] || [] })) };
}

async function findInSchool(admin, id, select) {
  const user = await User.findOne({ _id: id, schoolId: admin.schoolId }).select(select || '');
  if (!user) throw notFound('User');
  return user;
}

async function createUser(admin, { password, ...rest }) {
  if (!rest.phone && !rest.email) throw badRequest('Add a mobile number or an email.');
  const user = new User({ ...rest, schoolId: admin.schoolId });
  if (password) await user.setPassword(password);
  await user.save();
  return { user: user.toPublic() };
}

async function updateUser(admin, id, { password, ...rest }) {
  const user = await findInSchool(admin, id);
  Object.assign(user, rest);
  if (password) await user.setPassword(password);
  await user.save();
  return { user: user.toPublic() };
}

// Clears the PIN; the person sets a new one with an OTP next time.
async function resetPin(admin, id) {
  const user = await findInSchool(admin, id, '+pinHash');
  user.pinHash = undefined;
  await user.save();
  return { ok: true };
}

// Deactivates the account (history stays) and frees any class it led.
async function removeUser(admin, id) {
  if (String(id) === String(admin._id)) throw badRequest('You cannot remove your own account.');
  const user = await findInSchool(admin, id);
  user.active = false;
  await user.save();
  await ClassRoom.updateMany({ classTeacherId: user._id }, { $unset: { classTeacherId: 1 } });
  return { ok: true };
}

module.exports = { listUsers, createUser, updateUser, resetPin, removeUser };
