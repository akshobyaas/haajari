const { User } = require('../models');
const { verify } = require('../utils/token');
const { unauthorized, forbidden } = require('../utils/errors');

// Attaches req.user (a full User document) when a valid Bearer token is sent.
async function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(unauthorized());
  let payload;
  try {
    payload = verify(token);
  } catch {
    return next(unauthorized('Your session has ended. Log in again.'));
  }
  if (payload.purpose) return next(unauthorized());
  const user = await User.findById(payload.sub).select('+pinHash');
  if (!user || !user.active) return next(unauthorized('This account is no longer active.'));
  req.user = user;
  next();
}

const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(forbidden());

module.exports = { requireAuth, requireRole };
