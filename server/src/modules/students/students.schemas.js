const { z, objectId, phone, isoDate } = require('../../shared/validate');

const listQuery = z.object({ classId: objectId.optional(), search: z.string().trim().max(60).optional() });
const guardian = z.object({ name: z.string().min(1), relation: z.string().min(1), phone: phone.optional(), photoUrl: z.string().optional() });
const studentBody = z.object({
  admissionNo: z.string().trim().min(1),
  name: z.string().trim().min(1),
  classId: objectId,
  rollNo: z.number().int().positive().optional(),
  gender: z.enum(['M', 'F', 'O']).optional(),
  dob: isoDate.optional(),
  satsId: z.string().regex(/^\d{9}$/, 'SATS ID must be 9 digits').optional().or(z.literal('')),
  parent: z.object({ name: z.string().min(1), phone, relation: z.string().default('Parent') }).optional(),
  pickupGuardians: z.array(guardian).optional(),
});
const removeBody = z.object({ reason: z.string().trim().min(2, 'Give a reason, e.g. Transfer certificate issued') });

module.exports = { listQuery, studentBody, removeBody };
