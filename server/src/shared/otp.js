// Minimal OTP store. Used only for first-time setup and PIN reset, because
// SMS OTP delivery is unreliable in many schools (research issue #12).
// In-memory is fine for a single server; swap for Redis if you scale out.
const crypto = require('crypto');

const store = new Map(); // phone -> { code, expires, attempts }
const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function issue(phone) {
  const code = String(crypto.randomInt(100000, 1000000));
  store.set(phone, { code, expires: Date.now() + TTL_MS, attempts: 0 });
  return code;
}

function check(phone, code) {
  const entry = store.get(phone);
  if (!entry || entry.expires < Date.now()) return 'expired';
  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    store.delete(phone);
    return 'locked';
  }
  if (entry.code !== code) return 'wrong';
  store.delete(phone);
  return 'ok';
}

module.exports = { issue, check };
