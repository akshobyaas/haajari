const { HttpError } = require('./errors');

// Accounts of a school that is still waiting for approval (or was turned down) cannot log in.
async function assertSchoolOpen(user, School) {
  if (user.role === 'superadmin') return;
  const school = await School.findById(user.schoolId).select('status rejectReason').lean();
  if (!school) throw new HttpError(401, 'unauthorized', 'This school is no longer on Haajari.');
  if (school.status === 'pending') {
    throw new HttpError(403, 'school_pending', 'Your school is waiting for approval. You can log in once it is approved.');
  }
  if (school.status === 'rejected') {
    throw new HttpError(403, 'school_rejected', 'Your school\'s request was not approved.', { reason: school.rejectReason });
  }
}

// Workers and reports only look at schools that are in use.
const ACTIVE = { status: { $nin: ['pending', 'rejected'] } };

module.exports = { assertSchoolOpen, ACTIVE };
