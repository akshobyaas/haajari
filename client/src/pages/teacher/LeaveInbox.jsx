import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Phone } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { classLabel, prettyPhone } from '../../lib/format';
import { fmtDay } from '../../lib/dates';
import { useToast } from '../../components/Toast';
import { Button, Card, Notice, PageTitle, Skeleton } from '../../components/ui';
import Avatar from '../../components/Avatar';

export default function LeaveInbox() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const q = useQuery({ queryKey: ['leave'], queryFn: () => api.get('/leave').then((r) => r.data.leaves) });
  const decide = useMutation({
    mutationFn: ({ id, decision }) => api.patch(`/leave/${id}`, { decision }),
    onSuccess: (_r, v) => { qc.invalidateQueries({ queryKey: ['leave'] }); qc.invalidateQueries({ queryKey: ['roster'] }); toast(t(v.decision === 'approved' ? 'leaveInbox.approved' : 'leaveInbox.rejected')); },
    onError: (e) => toast(errorMessage(e)),
  });
  const pending = q.data?.filter((l) => l.status === 'pending') || [];
  const decided = q.data?.filter((l) => l.status !== 'pending') || [];
  const range = (l) => `${fmtDay(l.from, { weekday: 'short', day: 'numeric', month: 'short' })}${l.to !== l.from ? ` – ${fmtDay(l.to, { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}`;

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title={t('leaveInbox.title')} />
      {q.isError && <Notice tone="error">{t('errors.network')}</Notice>}
      {q.isLoading && <Skeleton className="h-40" />}
      {q.data && pending.length === 0 && <Notice tone="ok" className="mb-6">{t('leaveInbox.noPending')}</Notice>}
      <div className="mb-8 space-y-3">
        {pending.map((l) => (
          <Card key={l._id} className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={l.studentId.name} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{l.studentId.name} · {classLabel(l.studentId.classId)}</p>
                <p className="text-lg font-semibold text-board">{range(l)}</p>
              </div>
            </div>
            <p className="mb-2 rounded-xl bg-paper px-3 py-2">{l.reason}</p>
            <p className="mb-3 flex items-center justify-between text-[15px] text-muted">
              {t('leaveInbox.askedBy', { name: l.requestedBy?.name })}
              {l.requestedBy?.phone && <a href={`tel:${l.requestedBy.phone}`} className="inline-flex items-center gap-1 font-semibold text-board"><Phone className="size-4" /> {prettyPhone(l.requestedBy.phone)}</a>}
            </p>
            <div className="flex gap-3">
              <Button variant="quiet" className="flex-1" disabled={decide.isPending} onClick={() => decide.mutate({ id: l._id, decision: 'rejected' })}>{t('leaveInbox.reject')}</Button>
              <Button className="flex-1" loading={decide.isPending && decide.variables?.id === l._id && decide.variables?.decision === 'approved'} onClick={() => decide.mutate({ id: l._id, decision: 'approved' })}>{t('leaveInbox.approve')}</Button>
            </div>
          </Card>
        ))}
      </div>
      {decided.length > 0 && (
        <>
          <h2 className="mb-2 text-lg font-semibold">{t('leaveInbox.decided')}</h2>
          <Card className="divide-y divide-line/70">
            {decided.map((l) => (
              <div key={l._id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{l.studentId.name}</span><span className="text-sm text-muted">{range(l)}</span></span>
                <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${l.status === 'approved' ? 'bg-present/12 text-present' : 'bg-absent/10 text-absent'}`}>{t(`parent.leave_${l.status}`)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
