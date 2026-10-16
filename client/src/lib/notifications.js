import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { live } from './dataSaver';

// Alerts inbox and unread count; shared by the navigation badge and the Alerts page.
export const useUnread = () => useQuery({
  queryKey: ['notifications'],
  queryFn: () => api.get('/me/notifications').then((r) => r.data),
  refetchInterval: () => live(30_000),
});
