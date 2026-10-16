const { Schema, model } = require('mongoose');

const notificationSchema = new Schema({
  schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true }, // absent, absent_cleared, picked_up, late_pickup, leave_request, leave_decision, absence_reason
  payload: Schema.Types.Mixed,
  channels: [{ type: String, enum: ['push', 'sms', 'whatsapp', 'inapp'] }],
  sentAt: { type: Date, default: Date.now },
  readAt: Date,
});

notificationSchema.index({ userId: 1, sentAt: -1 });

module.exports = model('Notification', notificationSchema);
