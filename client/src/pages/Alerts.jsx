import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { api } from '../lib/api';
import { fmtStamp } from '../lib/dates';
import { Card, PageTitle, Skeleton, Notice } from '../components/ui';
import AlertsPrompt from '../components/parent/AlertsPrompt';

export const useUnread = () => useQuery({
  queryKey: ['notifications'],
  queryFn: () => api.get('/me/notifications').then((r) => r.data),
  refetchInterval: 30_000,
});

export default function Alerts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useUnread();
  // Opening the list counts as reading it.
  useEffect(() => {
    if (q.data?.unread) api.post('/me/notifications/read', {}).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
  }, [q.data?.unread, qc]);
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title={t('alerts.title')} />
      <AlertsPrompt />
      {q.isError && <Notice tone="error">{t('errors.network')}</Notice>}
      {q.isLoading && <Skeleton className="h-40" />}
      {q.data?.notifications.length === 0 && <p className="text-muted">{t('alerts.empty')}</p>}
      <Card className="divide-y divide-line/70">
        {q.data?.notifications.map((n) => (
          <button key={n._id} onClick={() => n.payload.url && navigate(n.payload.url)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-paper/60">
            <Bell className={`mt-1 size-5 shrink-0 ${n.readAt ? 'text-muted' : 'text-board'}`} />
            <span className="min-w-0 flex-1">
              <span className={`block ${n.readAt ? '' : 'font-semibold'}`}>{n.payload.title}</span>
              <span className="block text-[15px] text-muted">{n.payload.body}</span>
            </span>
            <span className="shrink-0 text-sm text-muted">{fmtStamp(n.sentAt)}</span>
          </button>
        ))}
      </Card>
    </div>
  );
}
