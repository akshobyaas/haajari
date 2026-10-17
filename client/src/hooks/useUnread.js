import { useQuery } from '@tanstack/react-query';
import { live } from '../stores/dataSaver';
import { notificationsQuery } from '../api/notifications';

// Alerts inbox and unread count; shared by the navigation badge and the Alerts page.
export const useUnread = () => useQuery({
  ...notificationsQuery(),
  refetchInterval: () => live(30_000),
});
