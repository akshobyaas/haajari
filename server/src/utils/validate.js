const { z } = require('zod');

// Parse req.body (or another object) with a zod schema; throws ZodError handled by errorHandler.
const parse = (schema, data) => schema.parse(data);

const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number');
const pin = z.string().regex(/^\d{4}$/, 'PIN must be 4 digits');
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

module.exports = { z, parse, phone, pin, objectId, isoDate };
