const { z, objectId, isoDate } = require('../../shared/validate');
const { GRADES, MODES } = require('../../models');

const classBody = z.object({
  grade: z.enum(GRADES),
  section: z.string().trim().min(1).max(3),
  medium: z.enum(['kannada', 'english', 'urdu']).optional(),
  classTeacherId: objectId.nullable().optional(),
  mode: z.enum(MODES).optional(),
  periodsPerDay: z.number().int().min(0).max(10).optional(),
});
const rosterQuery = z.object({ date: isoDate.optional() });

module.exports = { classBody, rosterQuery };
