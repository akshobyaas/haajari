const { z, objectId, phone } = require('../../shared/validate');
const { REASON_CODES } = require('../../models');

const monthQuery = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });
const absenceReason = z.object({ reason: z.enum(REASON_CODES), note: z.string().trim().max(200).optional() });

// Who may collect a pre-primary child. Photos are optional and stored only with the parent's consent.
const guardian = z.object({
  _id: objectId.optional(),
  name: z.string().trim().min(2).max(60),
  relation: z.string().trim().min(2).max(30),
  phone: phone.optional().or(z.literal('')),
  photoUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/, 'Photo must be an image').max(200_000, 'Photo is too large').optional().or(z.literal('')),
});
const guardians = z.object({ guardians: z.array(guardian).min(1, 'Keep at least one person who can collect the child').max(6) });
const passQuery = z.object({ guardianId: objectId });

module.exports = { monthQuery, absenceReason, guardians, passQuery };
