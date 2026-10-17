const { z, isoDate } = require('../../shared/validate');

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

// What the headmaster may change in School settings.
const schoolSettings = z.object({
  name: z.string().min(2).optional(),
  udiseCode: z.string().optional(),
  district: z.string().optional(),
  block: z.string().optional(),
  academicYear: z.string().regex(/^\d{4}-\d{2}$/, 'Use 2026-27 format').optional(),
  markingWindow: z.object({ start: time, end: time }).optional(),
  alertThreshold: z.number().min(0).max(100).optional(),
  consecutiveAbsenceAlert: z.number().int().min(1).max(30).optional(),
  holidays: z.array(z.object({ date: isoDate, name: z.string() })).optional(),
  defaultLanguage: z.enum(['kn', 'en', 'hi']).optional(),
});

module.exports = { schoolSettings };
