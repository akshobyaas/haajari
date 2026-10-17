import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Printer } from 'lucide-react';
import { classLabel } from '../lib/format';
import { fmtTime } from '../lib/dates';
import { Card, Skeleton, Notice } from '../components/ui';
import { live } from '../stores/dataSaver';
import { todayQuery } from '../api/dashboard';

// Emergency headcount: everyone marked present who has not gone home, class by class. Printable.
export default function InSchool() {
  const { t } = useTranslation();
  const q = useQuery({ ...todayQuery(), refetchInterval: () => live(15_000) });
  const d = q.data;
  return (
    <div className="print-area">
      <Link to="/a" className="mb-2 inline-flex items-center gap-1 text-muted hover:text-board-text print:hidden"><ArrowLeft className="size-4" /> {t('common.back')}</Link>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">{t('drill.title')}</h1>
          <p className="max-w-xl text-muted">{t('drill.intro')}</p>
        </div>
        <button onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-card px-4 font-semibold text-board-text print:hidden"><Printer className="size-4" /> {t('drill.print')}</button>
      </div>
      {q.isError && <Notice tone="error">{t('errors.network')}</Notice>}
      {!d && <Skeleton className="h-64" />}
      {d && (
        <>
          <p className="mb-4 text-[44px] leading-none font-bold text-board-text tabular-nums">{t('drill.total', { count: d.totals.inSchool })} <span className="text-base font-normal text-muted">· {fmtTime(q.dataUpdatedAt)}</span></p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
            {d.classes.map((c) => (
              <Card key={c._id} className="break-inside-avoid p-4">
                <p className="mb-1 flex items-baseline justify-between"><b className="text-lg">{classLabel(c)}</b> <span className="font-semibold tabular-nums">{c.marked ? t('drill.byClass', { count: c.inSchool.length }) : t('dash.notTaken')}</span></p>
                <ol className="columns-2 text-[15px] leading-relaxed">
                  {c.inSchool.map((s) => <li key={s._id} className="truncate"><span className="inline-block w-6 text-right text-muted tabular-nums">{s.rollNo}</span> {s.name}</li>)}
                </ol>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
