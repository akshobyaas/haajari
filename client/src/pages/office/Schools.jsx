import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Building2, Check, Mail, Phone, Plus, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { fmtDay } from '../../lib/dates';
import { live } from '../../lib/dataSaver';
import { Button, Card, Notice, PageTitle, Skeleton } from '../../components/ui';
import Sheet from '../../components/Sheet';
import SchoolForm from '../../components/SchoolForm';
import { useToast } from '../../components/Toast';

// The block office's console: approve schools that asked to join, add schools directly,
// and see whether every school has taken today's register.
export default function Schools() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const list = useQuery({
    queryKey: ['platform-schools'],
    queryFn: () => api.get('/platform/schools').then((r) => r.data.schools),
    refetchInterval: () => live(60_000),
  });
  const [tab, setTab] = useState(null);
  const [adding, setAdding] = useState(false);
  const [rejecting, setRejecting] = useState(null);

  const schools = list.data || [];
  const pending = schools.filter((s) => s.status === 'pending');
  const active = schools.filter((s) => s.status === 'active').sort((a, b) => a.name.localeCompare(b.name));
  const rejected = schools.filter((s) => s.status === 'rejected');
  const current = tab || (pending.length ? 'requests' : 'schools');

  const decide = useMutation({
    mutationFn: ({ id, decision, reason }) => api.post(`/platform/schools/${id}/decision`, { decision, reason }),
    onSuccess: (r, v) => {
      qc.invalidateQueries({ queryKey: ['platform-schools'] });
      setRejecting(null);
      toast(v.decision === 'approved' ? t('office.approved', { name: r.data.school.name }) : t('office.rejected'));
    },
    onError: (e) => toast(errorMessage(e)),
  });

  return (
    <div>
      <PageTitle
        title={t('office.title')}
        sub={list.data ? `${t('office.totals', { active: active.length, pending: pending.length })} · ${t('office.sub')}` : t('office.sub')}
        action={<Button onClick={() => setAdding(true)}><Plus className="size-5" aria-hidden /> {t('office.add')}</Button>}
      />

      <div role="tablist" className="mb-4 inline-flex rounded-xl bg-line/50 p-1">
        {[['requests', t('office.tabRequests'), pending.length], ['schools', t('office.tabSchools'), active.length]].map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={current === k} onClick={() => setTab(k)}
            className={`flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold transition ${current === k ? 'bg-card text-board-text shadow-sm' : 'text-muted'}`}>
            {label}
            <span className={`rounded-full px-2 text-sm ${k === 'requests' && n ? 'bg-accent text-on-brand' : 'bg-line/70'}`}>{n}</span>
          </button>
        ))}
      </div>

      {list.isLoading && <div className="grid gap-3 lg:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}
      {list.isError && <Notice tone="error">{errorMessage(list.error)}</Notice>}

      {current === 'requests' && list.data && (
        pending.length === 0
          ? <Card className="p-8 text-center text-muted">{t('office.noRequests')}</Card>
          : (
            <div className="grid gap-3 lg:grid-cols-2">
              {pending.map((s) => (
                <Card key={s.id} className="p-5">
                  <SchoolHead s={s} />
                  <dl className="mt-3 space-y-1 text-[15px]">
                    <div><dt className="inline text-muted">{t('office.head')}: </dt><dd className="inline font-semibold">{s.request?.hmName}</dd></div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
                      <a href={`mailto:${s.request?.hmEmail}`} className="inline-flex items-center gap-1 hover:text-board-text"><Mail className="size-4" aria-hidden />{s.request?.hmEmail}</a>
                      <a href={`tel:${s.request?.hmPhone}`} className="inline-flex items-center gap-1 hover:text-board-text"><Phone className="size-4" aria-hidden />{s.request?.hmPhone}</a>
                    </div>
                    {s.request?.note && <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-ink">“{s.request.note}”</p>}
                    <p className="text-sm text-muted">{t('office.requested', { date: fmtDay(String(s.request?.requestedAt || s.createdAt).slice(0, 10), { day: 'numeric', month: 'long' }) })}</p>
                  </dl>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button variant="quiet" onClick={() => setRejecting(s)}><X className="size-5" aria-hidden /> {t('office.reject')}</Button>
                    <Button loading={decide.isPending && decide.variables?.id === s.id && decide.variables?.decision === 'approved'}
                      onClick={() => decide.mutate({ id: s.id, decision: 'approved' })}>
                      <Check className="size-5" aria-hidden /> {t('office.approve')}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )
      )}

      {current === 'schools' && list.data && (
        <div className="grid gap-3 lg:grid-cols-2">
          {active.map((s) => <ActiveSchool key={s.id} s={s} />)}
          {rejected.map((s) => (
            <Card key={s.id} className="p-5 opacity-75">
              <SchoolHead s={s} />
              {s.rejectReason && <p className="mt-2 text-[15px] text-muted">{t('office.reason', { reason: s.rejectReason })}</p>}
            </Card>
          ))}
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title={t('office.addTitle')}>
        <h2 className="text-xl font-bold">{t('office.addTitle')}</h2>
        <p className="mb-5 text-muted">{t('office.addSub')}</p>
        <SchoolForm
          submitLabel={t('office.add')}
          onSubmit={async (body) => {
            const r = await api.post('/platform/schools', body);
            qc.invalidateQueries({ queryKey: ['platform-schools'] });
            setAdding(false);
            setTab('schools');
            toast(t('office.added', { name: r.data.school.name }));
          }}
        />
      </Sheet>

      <RejectSheet key={rejecting?.id || 'none'} school={rejecting} onClose={() => setRejecting(null)} busy={decide.isPending}
        onConfirm={(reason) => decide.mutate({ id: rejecting.id, decision: 'rejected', reason })} />
    </div>
  );
}

function SchoolHead({ s }) {
  const { t } = useTranslation();
  const chip = { pending: 'bg-accent text-on-brand', active: 'bg-present/12 text-present', rejected: 'bg-line text-muted' }[s.status];
  const label = { pending: t('office.statusPending'), active: t('office.statusActive'), rejected: t('office.statusRejected') }[s.status];
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-board/10 text-board-text"><Building2 className="size-6" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="text-lg leading-tight font-bold">{s.name}</p>
        <p className="text-sm text-muted">UDISE {s.udiseCode} · {[s.block, s.district].filter(Boolean).join(', ')}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold ${chip}`}>{label}</span>
    </div>
  );
}

function ActiveSchool({ s }) {
  const { t } = useTranslation();
  const d = s.today;
  const pct = d?.marked ? Math.round((d.present / d.marked) * 100) : null;
  const share = s.classes ? Math.round(((d?.registersTaken || 0) / s.classes) * 100) : 0;
  return (
    <Card className="p-5">
      <SchoolHead s={s} />
      <p className="mt-3 text-[15px]">
        {s.head && <><span className="font-semibold">{s.head.name}</span><span className="text-muted"> · </span></>}
        <span className="text-muted">{t('office.size', { classes: s.classes, students: s.students })}</span>
      </p>
      {!s.classes ? (
        <Notice tone="warn" className="mt-3">{t('office.notSetUp')}</Notice>
      ) : d?.closed ? (
        <p className="mt-3 text-[15px] text-muted">{t('office.todayClosed', { reason: d.closed })}</p>
      ) : (
        <div className="mt-3">
          <p className="text-[15px] font-semibold">
            {d?.registersTaken ? t('office.today', { taken: d.registersTaken, classes: s.classes, pct }) : t('office.todayNone')}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line/60" aria-hidden>
            <div className="h-full rounded-full bg-board transition-all" style={{ width: `${share}%` }} />
          </div>
        </div>
      )}
    </Card>
  );
}

function RejectSheet({ school, onClose, onConfirm, busy }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  return (
    <Sheet open={Boolean(school)} onClose={onClose} title={t('office.reject')}>
      <h2 className="text-xl font-bold">{t('office.reject')}</h2>
      <p className="mb-4 text-muted">{school?.name}</p>
      <label htmlFor="reason" className="block">
        <span className="mb-1 block text-[15px] font-semibold">{t('office.rejectReason')}</span>
        <textarea id="reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-xl border border-line bg-card px-4 py-3 text-ink outline-none focus:border-board focus:ring-4 focus:ring-board/10" />
      </label>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="quiet" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="danger" loading={busy} onClick={() => onConfirm(reason.trim() || undefined)}>{t('office.confirmReject')}</Button>
      </div>
    </Sheet>
  );
}
