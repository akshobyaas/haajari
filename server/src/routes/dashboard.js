const { Router } = require('express');
const { ClassRoom, Student, User, PRE_PRIMARY } = require('../models');

const router = Router();

// Phase 1 summary: setup completeness. Live attendance numbers arrive in Phase 4.
router.get('/summary', async (req, res) => {
  const schoolId = req.user.schoolId;
  const [classes, students, teachers, parents, noSats, noParent] = await Promise.all([
    ClassRoom.find({ schoolId, active: true }).select('grade classTeacherId'),
    Student.countDocuments({ schoolId, active: true }),
    User.countDocuments({ schoolId, role: 'teacher', active: true }),
    User.countDocuments({ schoolId, role: 'parent', active: true }),
    Student.countDocuments({ schoolId, active: true, satsId: { $exists: false } }),
    Student.countDocuments({ schoolId, active: true, parentIds: { $size: 0 } }),
  ]);
  res.json({
    classes: classes.length,
    prePrimaryClasses: classes.filter((c) => PRE_PRIMARY.includes(c.grade)).length,
    classesWithoutTeacher: classes.filter((c) => !c.classTeacherId).length,
    students,
    teachers,
    parents,
    studentsWithoutSats: noSats,
    studentsWithoutParent: noParent,
  });
});

module.exports = router;
