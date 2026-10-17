const { z, objectId, isoDate } = require('../../shared/validate');
const { STATUSES } = require('../../models');

// One mark as the phone sends it; clientId makes a replayed offline batch harmless.
const mark = z.object({
  studentId: objectId,
  status: z.enum(STATUSES),
  clientId: z.string().min(8).max(64),
  markedAt: z.iso.datetime(),
});

const bulkSave = z.object({
  classId: objectId,
  date: isoDate,
  period: z.number().int().min(0).max(10).default(0),
  marks: z.array(mark).min(1).max(200),
  editReason: z.string().trim().min(3, 'Write a short reason, at least 3 letters').max(200).optional(),
});

const historyRange = z.object({ from: isoDate.optional(), to: isoDate.optional() });
const auditQuery = z.object({ studentId: objectId, date: isoDate });

module.exports = { bulkSave, historyRange, auditQuery };
