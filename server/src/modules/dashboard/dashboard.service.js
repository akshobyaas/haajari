const { ClassRoom, Student, User, PRE_PRIMARY } = require('../../models');

/** How complete the school's setup is: shown as the headmaster's "set up" checklist. */
async function setupSummary(schoolId) {
  const [classes, students, teachers, parents, noSats, noParent] = await Promise.all([
    ClassRoom.find({ schoolId, active: true }).select('grade classTeacherId'),
    Student.countDocuments({ schoolId, active: true }),
    User.countDocuments({ schoolId, role: 'teacher', active: true }),
    User.countDocuments({ schoolId, role: 'parent', active: true }),
    Student.countDocuments({ schoolId, active: true, satsId: { $exists: false } }),
    Student.countDocuments({ schoolId, active: true, parentIds: { $size: 0 } }),
  ]);
  return {
    classes: classes.length,
    prePrimaryClasses: classes.filter((c) => PRE_PRIMARY.includes(c.grade)).length,
    classesWithoutTeacher: classes.filter((c) => !c.classTeacherId).length,
    students, teachers, parents,
    studentsWithoutSats: noSats,
    studentsWithoutParent: noParent,
  };
}

module.exports = { setupSummary };
