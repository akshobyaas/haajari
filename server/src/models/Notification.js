const { Schema, model } = require('mongoose');

const notificationSchema = new Schema({
  schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true }, // 'absent', 'picked_up', 'leave_decision', 'at_risk'
  payload: Schema.Types.Mixed,
  channel: { type: String, enum: ['push', 'sms', 'whatsapp', 'inapp'], default: 'inapp' },
  sentAt: { type: Date, default: Date.now },
  readAt: Date,
});

module.exports = model('Notification', notificationSchema);
