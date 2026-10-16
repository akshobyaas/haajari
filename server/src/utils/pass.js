const crypto = require('crypto');
const env = require('../config/env');

/**
 * Compact pickup pass for the QR code: student id, guardian id, expiry, and a 10-byte HMAC.
 * 38 bytes -> 51 characters, so the QR stays small and easy for a cheap phone camera to read
 * (a JWT here made a dense code that low-end cameras miss).
 * Layout: sid(12) | gid(12) | exp seconds(4) | mac(10)
 */
const PREFIX = 'HJ1:';
const mac = (buf) => crypto.createHmac('sha256', env.jwtSecret).update('pickup-pass').update(buf).digest().subarray(0, 10);

function signPass({ studentId, guardianId, expiresAt }) {
  const body = Buffer.alloc(28);
  Buffer.from(String(studentId), 'hex').copy(body, 0);
  Buffer.from(String(guardianId), 'hex').copy(body, 12);
  body.writeUInt32BE(Math.floor(expiresAt / 1000), 24);
  return PREFIX + Buffer.concat([body, mac(body)]).toString('base64url');
}

/** Returns { sid, gid } or throws with a reason a teacher can act on. */
function verifyPass(text) {
  if (!String(text).startsWith(PREFIX)) throw new Error('not_a_pass');
  const raw = Buffer.from(String(text).slice(PREFIX.length), 'base64url');
  if (raw.length !== 38) throw new Error('not_a_pass');
  const body = raw.subarray(0, 28);
  if (!crypto.timingSafeEqual(raw.subarray(28), mac(body))) throw new Error('forged');
  if (body.readUInt32BE(24) * 1000 < Date.now()) throw new Error('expired');
  return { sid: body.subarray(0, 12).toString('hex'), gid: body.subarray(12, 24).toString('hex') };
}

module.exports = { signPass, verifyPass, PREFIX };
