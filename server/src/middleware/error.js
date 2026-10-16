const { ZodError } = require('zod');
const mongoose = require('mongoose');
const { HttpError } = require('../utils/errors');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) {
    const fields = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return res.status(400).json({ error: { code: 'validation', message: fields[0]?.message || 'Check the form.', fields } });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    return res.status(409).json({ error: { code: 'duplicate', message: `This ${field} is already in use.`, field } });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const fields = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return res.status(400).json({ error: { code: 'validation', message: fields[0]?.message, fields } });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: { code: 'bad_id', message: `Invalid ${err.path}.` } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'bad_json', message: 'Request body is not valid JSON.' } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'server', message: 'Something went wrong on the server. Try again.' } });
}

module.exports = { errorHandler };
