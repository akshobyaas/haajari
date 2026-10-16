import { api } from './api';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushState = () => (pushSupported() ? Notification.permission : 'unsupported'); // default | granted | denied | unsupported

const b64ToBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** Ask for permission and register this phone for alerts. Returns the new permission state. */
export async function enablePush() {
  if (!pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;
  const reg = await navigator.serviceWorker.ready;
  const { data } = await api.get('/public/push/key');
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(data.publicKey) }));
  await api.post('/me/push', sub.toJSON());
  return 'granted';
}

/** Keep the server's copy fresh when an already-allowed phone opens the app. */
export async function refreshPush() {
  if (pushState() !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await api.post('/me/push', sub.toJSON());
  } catch { /* offline; next open will retry */ }
}
