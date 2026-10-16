const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const { PushSubscription } = require('../models');

/**
 * Web Push (the same standard Firebase Cloud Messaging uses for browsers), with no third-party account.
 * Keys come from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, or are generated once and kept in server/.vapid.json.
 */
let keys = null;
function vapidKeys() {
  if (keys) return keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const file = path.join(__dirname, '../../.vapid.json');
    try {
      keys = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      keys = webpush.generateVAPIDKeys();
      try { fs.writeFileSync(file, JSON.stringify(keys, null, 2)); } catch { /* read-only disk: keys last until restart */ }
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@haajari.local', keys.publicKey, keys.privateKey);
  return keys;
}

let sender = (sub, payload) => webpush.sendNotification(sub, payload, { TTL: 24 * 3600 });
// Tests swap the sender to record pushes instead of calling a real push service.
const setSender = (fn) => { sender = fn; };

async function sendPush(userId, message) {
  vapidKeys();
  const subs = await PushSubscription.find({ userId });
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await sender({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(message));
      sent += 1;
    } catch (e) {
      // 404/410: the browser unsubscribed or the app was removed.
      if (e.statusCode === 404 || e.statusCode === 410) await s.deleteOne();
    }
  }));
  return sent;
}

module.exports = { vapidKeys, sendPush, setSender };
