const { Router } = require('express');
const { Student } = require('../models');
const { requireRole } = require('../middleware/auth');

const router = Router();

// Parent: only their own children (privacy requirement).
router.get('/children', requireRole('parent'), async (req, res) => {
  const children = await Student.find({ parentIds: req.user._id, active: true })
    .select('name admissionNo rollNo photoUrl classId pickupGuardians')
    .populate({ path: 'classId', select: 'grade section mode classTeacherId', populate: { path: 'classTeacherId', select: 'name phone' } });
  res.json({ children });
});

module.exports = router;
