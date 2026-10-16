const { Schema, model } = require('mongoose');

// A browser that agreed to receive notifications for this user (Web Push).
const pushSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: { p256dh: String, auth: String },
    userAgent: String,
  },
  { timestamps: true }
);

module.exports = model('PushSubscription', pushSchema);
