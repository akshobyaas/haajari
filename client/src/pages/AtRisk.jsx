import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Phone, MessageCircle, RefreshCw, PhoneCall, Home, Send } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { classLabel, firstName } from '../lib/format';
import { fmtDay, fmtStamp } from '../lib/dates';
import { useToast } from '../components/Toast';
import { Button, Card, Notice, PageTitle, Skeleton } from '../components/ui';
import Avatar from '../components/Avatar';

// Children absent several days in a row or below the threshold, and what has been done about it.
export default function AtRisk() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const admin = useAuth((s) => s.user.role === 'admin');
  const q = useQuery({ queryKey: ['risk'], queryFn: () => api.get('/risk').then((r) => r.data) });
  const refresh = useMutation({
    mutationFn: () => api.post('/risk/refresh'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk'] }),
    onError: (e) => toast(errorMessage(e)),
  });
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title={t('risk.title')} action={admin && <Button variant="quiet" loading={refresh.isPending} onClick={() => refresh.mutate()}><RefreshCw className="size-4" /> {t('risk.refresh')}</Button>} />
      {q.data && <p className="mb-4 text-muted">{t('risk.rules', q.data.rules)}{q.data.evaluatedOn && ` ${t('risk.checked', { date: fmtDay(q.data.evaluatedOn) })}`}</p>}
      {q.isError && <Notice tone="error">{t('errors.network')}</Notice>}
      {q.isLoading && <Skeleton className="h-48" />}
      {q.data?.flags.length === 0 && <Notice tone="ok">{t('risk.none')}</Notice>}
      <div className="space-y-3">
        {q.data?.flags.map((f) => <RiskCard key={f._id} flag={f} />)}
      </div>
    </div>
  );
}

function RiskCard({ flag }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const [type, setType] = useState(null);
  const [note, setNote] = useState('');
  const s = flag.studentId;
  const parent = s?.parentIds?.[0];
  const save = useMutation({
    mutationFn: () => api.post(`/risk/${flag._id}/follow-up`, { type, note: note || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['risk'] }); setType(null); setNote(''); },
    onError: (e) => toast(errorMessage(e)),
  });
  const wa = parent && `https://wa.me/91${parent.phone}?text=${encodeURIComponent(t('risk.waText', { name: firstName(s.name) }))}`;
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start gap-3">
        <Avatar name={s?.name || '?'} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{s?.name} <span className="font-normal text-muted">· {classLabel(flag.classId)} · {t('teacher.roll', { n: s?.rollNo })}</span></p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {flag.reasons.includes('streak') && <Chip>{t('risk.streak', { count: flag.streak })}</Chip>}
            {flag.reasons.includes('low_month') && <Chip>{t('risk.low_month', { pct: flag.monthPct })}</Chip>}
            {flag.reasons.includes('low_year') && <Chip>{t('risk.low_year', { pct: flag.yearPct })}</Chip>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {flag.lastPresent ? t('risk.lastPresent', { date: fmtDay(flag.lastPresent, { weekday: 'short', day: 'numeric', month: 'short' }) }) : t('risk.never')} · {t('risk.since', { date: fmtDay(flag.since) })}
          </p>
        </div>
      </div>
      {parent && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="mr-auto text-[15px]">{parent.name}</span>
          <a href={`tel:${parent.phone}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 font-semibold text-board-text"><Phone className="size-4" /> {t('risk.call')}</a>
          <a href={wa} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 font-semibold text-board-text"><MessageCircle className="size-4" /> {t('risk.whatsapp')}</a>
        </div>
      )}
      <div className="rounded-xl bg-paper p-3">
        <p className="mb-1 text-sm font-semibold text-muted">{t('risk.log')}</p>
        {flag.followUps.length === 0 && <p className="text-[15px] text-muted">{t('risk.noFollowUp')}</p>}
        <ul className="space-y-1">
          {flag.followUps.map((u) => (
            <li key={u._id} className="text-[15px]"><b>{t(`risk.type_${u.type}`)}</b>{u.note && `: ${u.note}`} <span className="text-sm text-muted">· {t('risk.byOn', { name: u.by?.name, date: fmtStamp(u.at) })}</span></li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          {[['call', PhoneCall, 'called'], ['visit', Home, 'visited'], ['message', Send, 'messaged']].map(([k, Icon, label]) => (
            <button key={k} onClick={() => setType(type === k ? null : k)} aria-pressed={type === k}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-[15px] font-semibold ${type === k ? 'border-board bg-board text-chalk' : 'border-line bg-card text-ink'}`}>
              <Icon className="size-4" /> {t(`risk.${label}`)}
            </button>
          ))}
        </div>
        {type && (
          <div className="mt-2 flex gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('risk.noteHint')} aria-label={t('risk.noteHint')}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-card px-3 outline-none focus:border-board" />
            <Button className="min-h-11" loading={save.isPending} onClick={() => save.mutate()}>{t('risk.save')}</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

const Chip = ({ children }) => <span className="rounded-full bg-absent/10 px-2.5 py-0.5 text-sm font-semibold text-absent">{children}</span>;
