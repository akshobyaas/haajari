const { z, objectId, phone } = require('../../shared/validate');

const listQuery = z.object({ role: z.enum(['admin', 'teacher', 'parent']).optional() });
const userBody = z.object({
  name: z.string().trim().min(2),
  role: z.enum(['admin', 'teacher']),
  phone: phone.optional(),
  email: z.email().optional(),
  password: z.string().min(8, 'Password needs at least 8 characters').optional(),
  language: z.enum(['kn', 'en', 'hi']).optional(),
  subjects: z.array(z.object({ classId: objectId, subject: z.string().min(1) })).optional(),
});

module.exports = { listQuery, userBody };
