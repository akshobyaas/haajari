const { User } = require('../models');

/**
 * Creates the approver (superadmin) account from SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD,
 * or brings its password in line with the setting. Lets a live deployment get an approver without
 * reseeding, and changing SUPERADMIN_PASSWORD (then restarting) changes the password.
 */
async function ensureApprover({ email, password, name = 'Block Education Office' } = {}) {
  if (!email || !password) return null;
  const existing = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (existing) {
    if (existing.role !== 'superadmin') {
      console.warn(`SUPERADMIN_EMAIL ${email} belongs to a school account; approver not created.`);
      return null;
    }
    if (!(await existing.checkPassword(password))) {
      await existing.setPassword(password);
      await existing.save();
      console.log(`Approver password updated: ${email}`);
    }
    return existing;
  }
  const user = new User({ role: 'superadmin', name, email, language: 'en' });
  await user.setPassword(password);
  await user.save();
  console.log(`Approver account created: ${email}`);
  return user;
}

module.exports = { ensureApprover };
