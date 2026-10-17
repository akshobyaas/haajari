const { z, phone } = require('../utils/validate');

// What a headmaster sends to put a school on Haajari (also used when the approver adds one directly).
const schoolRequestSchema = z.object({
  school: z.object({
    name: z.string().trim().min(3, 'Enter the school name').max(120),
    udiseCode: z.string().trim().regex(/^\d{11}$/, 'UDISE code is 11 digits'),
    district: z.string().trim().min(2, 'Enter the district').max(60),
    block: z.string().trim().min(2, 'Enter the block').max(60),
  }),
  hm: z.object({
    name: z.string().trim().min(2, 'Enter the headmaster\'s name').max(80),
    email: z.email('Enter a valid email'),
    phone,
    password: z.string().min(8, 'Password needs at least 8 characters').max(72),
  }),
  note: z.string().trim().max(300).optional(),
});

module.exports = { schoolRequestSchema };
