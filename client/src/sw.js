/* Haajari service worker: offline app shell + notifications with one-tap replies. */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

const REPLIES = ['sick', 'family', 'travel', 'other'];

self.addEventListener('push', (event) => {
  let msg = {};
  try { msg = event.data.json(); } catch { msg = { title: 'Haajari', body: event.data?.text() }; }
  event.waitUntil(
    self.registration.showNotification(msg.title || 'Haajari', {
      body: msg.body,
      tag: msg.tag,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { url: msg.url || '/', replyToken: msg.replyToken },
      actions: msg.replyToken ? msg.actions || [] : [],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  const { url, replyToken } = event.notification.data || {};
  event.notification.close();
  // "Sick" / "Family" pressed on the notification: answer the teacher without opening the app.
  if (REPLIES.includes(event.action) && replyToken) {
    event.waitUntil(
      fetch('/api/public/absence-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: replyToken, reason: event.action }),
      }).then((r) =>
        self.registration.showNotification(r.ok ? 'ಧನ್ಯವಾದ · Thank you' : 'Could not send', {
          body: r.ok ? 'ಶಿಕ್ಷಕರಿಗೆ ತಿಳಿಸಲಾಗಿದೆ · The teacher has been told.' : 'Open Haajari to reply.',
          icon: '/pwa-192.png',
          tag: 'reply-ack',
          data: { url },
        })
      )
    );
    return;
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) { open.navigate(url); return open.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
