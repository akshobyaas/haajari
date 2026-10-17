/**
 * Every cache key in one place. A screen reads with useQuery(xxxQuery()) and, after a change,
 * refreshes with qc.invalidateQueries({ queryKey: keys.xxx }). Keys are arrays, so a prefix
 * (e.g. keys.roster) refreshes every class roster at once.
 */
export const keys = {
  school: ['school'],
  // One key per shape of data: two screens sharing a key must expect the same data.
  classes: ['classes'], // prefix: refreshes both below
  classList: ['classes', 'list'], // array of classes (admin screens, reports)
  classOverview: ['classes', 'overview'], // { date, closed, classes } (teacher home, cached offline)
  roster: ['roster'],
  rosterFor: (classId, date = '') => ['roster', classId, date],
  history: (classId) => ['history', classId],
  audit: (studentId, date) => ['audit', studentId, date],
  students: ['students'],
  studentsFor: (classId, search) => ['students', classId || 'all', search],
  teachers: ['users', 'teacher'],
  users: ['users'],
  summary: ['summary'],
  today: ['dash-today'],
  trend: ['dash-trend'],
  risk: ['risk'],
  leave: ['leave'], // prefix
  leaveFor: (status = 'all') => ['leave', status],
  pickup: (classId) => ['pickup', classId],
  register: (classId, month) => ['register', classId, month],
  shortage: (threshold) => ['shortage', threshold],
  children: ['children'],
  childMonth: ['child-month'],
  childMonthFor: (id, month) => ['child-month', id, month],
  notifications: ['notifications'],
  schools: ['platform-schools'],
};
