import { api } from './client';
import { keys } from './keys';

export const notificationsApi = {
  list: () => api.get('/me/notifications').then((r) => r.data),
  markRead: () => api.post('/me/notifications/read', {}).then((r) => r.data),
  pushKey: () => api.get('/public/push/key').then((r) => r.data.publicKey),
  savePushSubscription: (subscription) => api.post('/me/push', subscription).then((r) => r.data),
};

export const notificationsQuery = () => ({ queryKey: keys.notifications, queryFn: notificationsApi.list });
