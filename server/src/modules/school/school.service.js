const { School } = require('../../models');
const { notFound } = require('../../shared/errors');

// The signed-in user's school. Every school-scoped module goes through here.
async function getSchool(schoolId) {
  const school = await School.findById(schoolId);
  if (!school) throw notFound('School');
  return school;
}

async function updateSchool(schoolId, changes) {
  const school = await School.findByIdAndUpdate(schoolId, changes, { new: true, runValidators: true });
  if (!school) throw notFound('School');
  return school;
}

module.exports = { getSchool, updateSchool };
