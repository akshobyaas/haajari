module.exports = {
  School: require('./School'),
  User: require('./User'),
  ClassRoom: require('./ClassRoom'),
  Student: require('./Student'),
  Attendance: require('./Attendance'),
  AuditLog: require('./AuditLog'),
  LeaveRequest: require('./LeaveRequest'),
  PickupLog: require('./PickupLog'),
  Notification: require('./Notification'),
  ...require('./constants'),
};
