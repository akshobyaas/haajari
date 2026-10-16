// Shared enums used by models, routes and the seed script.
const GRADES = ['PREKG', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const PRE_PRIMARY = ['PREKG', 'LKG', 'UKG'];
const ROLES = ['admin', 'teacher', 'parent'];
const STATUSES = ['P', 'A', 'L', 'LV']; // present, absent, late, leave
const LANGUAGES = ['kn', 'en', 'hi'];
const MODES = ['checkin', 'daily', 'period'];

// Default marking mode for each age band (plan: Requirements > age bands).
function defaultModeFor(grade) {
  if (PRE_PRIMARY.includes(grade)) return 'checkin';
  return 'daily';
}

module.exports = { GRADES, PRE_PRIMARY, ROLES, STATUSES, LANGUAGES, MODES, defaultModeFor };
