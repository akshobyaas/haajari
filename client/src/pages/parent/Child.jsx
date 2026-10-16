import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, QrCode, Pencil } from 'lucide-react';
import { api } from '../../lib/api';
import { classLabel, firstName, prettyPhone } from '../../lib/format';
import { fmtDay, fmtMonth, shiftMonth, reasonText } from '../../lib/dates';
import { Card, Skeleton, Notice, Button } from '../../components/ui';
import Avatar from '../../components/Avatar';
import MonthCalendar from '../../components/parent/MonthCalendar';
import ReasonButtons from '../../components/parent/ReasonButtons';
import LeaveSheet from '../../components/parent/LeaveSheet';
import GuardiansSheet from '../../components/parent/GuardiansSheet';
import PassSheet from '../../components/parent/PassSheet';

export default function Child() {
  const { id } = useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [month, setMonth] = useState(null);
  const [sheet, setSheet] = useState(null); // 'leave' | 'guardians' | 'pass'
  const children = useQuery({ queryKey: ['children'], queryFn: () => api.get('/me/children').then((r) => r.data.children) });
  const child = children.data?.find((c) => c._id === id);
  const q = useQuery({
    queryKey: ['child-month', id, month],
    queryFn: () => api.get(`/me/children/${id}/attendance`, { params: month ? { month } : {} }).then((r) => r.data),
  });
  const d = q.data;
  const shown = month || d?.month;
  const absences = d?.days.filter((x) => x.status === 'A') || [];
  const prePrimary = child?.classId?.mode === 'checkin';

  const withdraw = async (leaveId) => {
    await api.delete(`/leave/${leaveId}`);
    qc.invalidateQueries({ queryKey: ['child-month'] });
  };

  return (
    <div className="mx-auto max-w-xl">
      <Link to="/p" className="mb-3 inline-flex items-center gap-1 text-muted hover:text-board"><ArrowLeft className="size-4" /> {t('common.back')}</Link>
      {child && (
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={child.name} size={56} />
          <div>
            <h1 className="text-[28px] leading-tight font-bold">{child.name}</h1>
            <p className="text-muted">{classLabel(child.classId)}</p>
          </div>
        </div>
      )}
      {q.isError && <Notice tone="error">{t('errors.network')}</Notice>}

      {/* Percentages */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        {d ? [['thisMonth', d.monthStats], ['thisYear', d.yearStats]].map(([k, s]) => (
          <Card key={k} className="p-4">
            <p className="text-muted">{t(`parent.${k}`)}</p>
            <p className={`text-[36px] leading-tight font-bold ${s.pct !== null && s.pct < d.threshold ? 'text-absent' : 'text-board'}`}>{s.pct ?? '—'}{s.pct !== null && '%'}</p>
            <p className="text-sm text-muted">{t('parent.days', { count: s.days })}</p>
          </Card>
        )) : [0, 1].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
      {d && d.yearStats.pct !== null && d.yearStats.pct < d.threshold && (
        <Notice tone="warn" className="mb-4">{t('parent.below', { n: d.threshold, name: firstName(child?.name || '') })}</Notice>
      )}

      {/* Calendar */}
      <Card className="mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => setMonth(shiftMonth(shown, -1))} aria-label="Previous month" className="rounded-full p-2 hover:bg-paper"><ChevronLeft /></button>
          <span className="text-lg font-semibold">{shown && fmtMonth(shown)}</span>
          <button onClick={() => setMonth(shiftMonth(shown, 1))} disabled={!d || shown >= d.today.slice(0, 7)} aria-label="Next month" className="rounded-full p-2 hover:bg-paper disabled:opacity-30"><ChevronRight /></button>
        </div>
        {d ? <MonthCalendar month={d.month} days={d.days} holidays={d.holidays} today={d.today} /> : <Skeleton className="h-64" />}
      </Card>

      {/* Absent days and reasons */}
      <Card className="mb-4 p-4">
        <h2 className="mb-2 text-lg font-semibold">{t('parent.absences')}</h2>
        {d && absences.length === 0 && <p className="text-muted">{t('parent.noAbsences')}</p>}
        <ul className="space-y-3">
          {absences.map((a) => (
            <li key={a._id} className="rounded-xl bg-paper p-3">
              <p className="font-semibold">{fmtDay(a.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              {a.reason ? <p className="text-muted">{reasonText(t, a.reason)}</p>
                : a.date === d.today ? <div className="mt-2"><ReasonButtons attendanceId={a._id} name={firstName(child?.name || '')} /></div>
                : <p className="text-muted">{t('parent.noReason')}</p>}
            </li>
          ))}
        </ul>
      </Card>

      {/* Leave */}
      <Card className="mb-4 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('parent.leaveTitle')}</h2>
          <Button className="min-h-10 px-3" onClick={() => setSheet('leave')}><Plus className="size-4" /> {t('parent.applyLeave')}</Button>
        </div>
        {d?.leaves.length === 0 && <p className="text-muted">{t('parent.noLeave')}</p>}
        <ul className="divide-y divide-line/70">
          {d?.leaves.map((l) => (
            <li key={l._id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{fmtDay(l.from)}{l.to !== l.from && ` – ${fmtDay(l.to)}`}</p>
                <p className="truncate text-muted">{l.reason}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${{ pending: 'bg-late/15 text-[#8a5a00]', approved: 'bg-present/12 text-present', rejected: 'bg-absent/10 text-absent' }[l.status]}`}>
                {t(`parent.leave_${l.status}`)}
              </span>
              {l.status === 'pending' && <button onClick={() => withdraw(l._id)} className="text-sm font-semibold text-muted underline">{t('parent.withdraw')}</button>}
            </li>
          ))}
        </ul>
      </Card>

      {/* Pickup (pre-primary) */}
      {prePrimary && child && (
        <Card className="mb-4 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t('parent.pickupTitle', { name: firstName(child.name) })}</h2>
            <button onClick={() => setSheet('guardians')} className="inline-flex items-center gap-1 font-semibold text-board"><Pencil className="size-4" /> {t('parent.manage')}</button>
          </div>
          <ul className="mb-4 space-y-2">
            {child.pickupGuardians.map((g) => (
              <li key={g._id} className="flex items-center gap-3">
                {g.photoUrl ? <img src={g.photoUrl} alt="" className="size-11 rounded-xl object-cover" /> : <Avatar name={g.name} size={44} />}
                <span><span className="block font-semibold">{g.name}</span><span className="text-sm text-muted">{g.relation}{g.phone ? ` · ${prettyPhone(g.phone)}` : ''}</span></span>
              </li>
            ))}
          </ul>
          <Button className="w-full" onClick={() => setSheet('pass')}><QrCode className="size-5" /> {t('parent.pickupPass')}</Button>
        </Card>
      )}

      {child && (
        <>
          <LeaveSheet open={sheet === 'leave'} onClose={() => setSheet(null)} student={child} />
          <GuardiansSheet open={sheet === 'guardians'} onClose={() => setSheet(null)} student={child} />
          <PassSheet open={sheet === 'pass'} onClose={() => setSheet(null)} student={child} />
        </>
      )}
    </div>
  );
}
