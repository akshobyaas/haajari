const REASON_CODES = ['sick', 'family', 'travel', 'other'];

module.exports = {
  REASON_CODES,
  School: require('./School'),
  User: require('./User'),
  ClassRoom: require('./ClassRoom'),
  Student: require('./Student'),
  Attendance: require('./Attendance'),
  AuditLog: require('./AuditLog'),
  LeaveRequest: require('./LeaveRequest'),
  PickupLog: require('./PickupLog'),
  Notification: require('./Notification'),
  PushSubscription: require('./PushSubscription'),
  ...require('./constants'),
};
