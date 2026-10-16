import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { loadRoster } from '../../offline/roster';
import { classLabel } from '../../lib/format';
import { STATUS_STYLE } from '../../lib/status';
import { Card, Skeleton, Notice } from '../../components/ui';

// Last 30 days for one class; tap a day to open it on the marking screen.
export default function ClassHistory() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const roster = useQuery({ queryKey: ['roster', id, ''], queryFn: () => loadRoster(id) });
  const days = useQuery({ queryKey: ['history', id], queryFn: () => api.get(`/attendance/class/${id}/history`).then((r) => r.data.days) });
  const fmt = new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const backdate = roster.data?.school.teacherBackdateDays ?? 7;
  const today = roster.data?.today;

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={`/t/class/${id}/mark`} className="mb-2 inline-flex items-center gap-1 text-muted hover:text-board"><ArrowLeft className="size-4" /> {t('common.back')}</Link>
      <h1 className="mb-1 text-[28px] font-bold">{roster.data ? classLabel(roster.data.class) : ' '}</h1>
      <p className="mb-4 text-muted">{t('mark.history')}</p>
      {days.isError && <Notice tone="error">{t('errors.network')}</Notice>}
      <Card className="divide-y divide-line/70">
        {days.isLoading && [0, 1, 2, 3].map((i) => <div key={i} className="p-3"><Skeleton className="h-10" /></div>)}
        {days.data?.map((d) => {
          const total = d.P + d.A + d.L + d.LV;
          const pct = Math.round(((d.P + d.L) / total) * 100);
          const editable = today && (Date.parse(today) - Date.parse(d.date)) / 864e5 <= backdate;
          const Row = editable ? Link : 'div';
          return (
            <Row key={d.date} to={editable ? `/t/class/${id}/mark?date=${d.date}` : undefined} className={`flex items-center gap-4 px-4 py-3 ${editable ? 'hover:bg-paper/60' : ''}`}>
              <span className="w-36 shrink-0 font-semibold whitespace-nowrap">{fmt.format(new Date(`${d.date}T00:00:00Z`))}</span>
              <span className="flex h-3 flex-1 overflow-hidden rounded-full bg-line/50" aria-hidden>
                {['P', 'L', 'LV', 'A'].map((k) => d[k] > 0 && <span key={k} className={STATUS_STYLE[k].dot} style={{ width: `${(d[k] / total) * 100}%` }} />)}
              </span>
              <span className="w-24 shrink-0 text-right text-[15px]">
                <b className="tabular-nums">{pct}%</b> <span className="text-muted">· {d.A} {t('status.A')}</span>
              </span>
              {editable ? <ChevronRight className="size-4 text-muted" /> : <span className="w-4" />}
            </Row>
          );
        })}
      </Card>
    </div>
  );
}
