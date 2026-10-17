const { Notification, PushSubscription } = require('../../models');

// In-app inbox: the latest 50 messages and how many are unread.
async function inbox(user) {
  const [notifications, unread] = await Promise.all([
    Notification.find({ userId: user._id }).sort({ sentAt: -1 }).limit(50),
    Notification.countDocuments({ userId: user._id, readAt: null }),
  ]);
  return { notifications, unread };
}

async function markRead(user, ids) {
  await Notification.updateMany({ userId: user._id, readAt: null, ...(ids ? { _id: { $in: ids } } : {}) }, { $set: { readAt: new Date() } });
  return { ok: true };
}

// A phone that turned on alerts (Web Push subscription).
async function subscribe(user, { endpoint, keys }, userAgent) {
  await PushSubscription.findOneAndUpdate({ endpoint }, { userId: user._id, keys, userAgent }, { upsert: true });
  return { ok: true };
}

async function unsubscribe(user, endpoint) {
  await PushSubscription.deleteOne({ endpoint, userId: user._id });
  return { ok: true };
}

module.exports = { inbox, markRead, subscribe, unsubscribe };
