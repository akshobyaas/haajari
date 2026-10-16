import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download, Printer, Phone } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { download } from '../lib/download';
import { classLabel } from '../lib/format';
import { fmtMonth } from '../lib/dates';
import { localToday } from '../offline/roster';
import { useToast } from '../components/Toast';
import { Button, Card, Input, Notice, PageTitle, Select, Skeleton } from '../components/ui';

export default function Reports() {
  const { t } = useTranslation();
  const admin = useAuth((s) => s.user.role === 'admin');
  const [tab, setTab] = useState('register');
  const tabs = ['register', 'shortage', ...(admin ? ['sats'] : [])];
  return (
    <div>
      <div className="print:hidden">
        <PageTitle title={t('reports.title')} />
        <div role="tablist" className="mb-5 inline-flex rounded-xl bg-line/50 p-1">
          {tabs.map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`min-h-10 rounded-lg px-4 font-semibold ${tab === k ? 'bg-card text-board shadow-sm' : 'text-muted'}`}>
              {t(`reports.${k}`)}
            </button>
          ))}
        </div>
      </div>
      {tab === 'register' && <Register />}
      {tab === 'shortage' && <Shortage />}
      {tab === 'sats' && <Sats />}
    </div>
  );
}

function useDownload() {
  const toast = useToast((s) => s.show);
  const [busy, setBusy] = useState(null);
  const run = async (key, ...args) => {
    setBusy(key);
    try { await download(...args); } catch (e) { toast(errorMessage(e)); } finally { setBusy(null); }
  };
  return [busy, run];
}

const CELL = { P: '', A: 'bg-absent/15 font-bold text-absent', L: 'text-[#8a5a00] font-semibold', LV: 'text-leave font-semibold' };
const SHORT = { P: 'P', A: 'A', L: 'L', LV: 'Lv' };

// The monthly register, laid out like the paper one. Prints on one landscape page per class.
function Register() {
  const { t } = useTranslation();
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes').then((r) => r.data.classes) });
  const [classId, setClassId] = useState('');
  const [month, setMonth] = useState(localToday().slice(0, 7));
  const cid = classId || classes.data?.[0]?._id;
  const q = useQuery({
    queryKey: ['register', cid, month],
    queryFn: () => api.get('/reports/register', { params: { classId: cid, month } }).then((r) => r.data),
    enabled: Boolean(cid),
  });
  const [busy, run] = useDownload();
  const reg = q.data;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <Select name="class" label={t('reports.class')} value={cid || ''} onChange={(e) => setClassId(e.target.value)} className="w-48">
          {classes.data?.map((c) => <option key={c._id} value={c._id}>{classLabel(c)}</option>)}
        </Select>
        <Input name="month" type="month" label={t('reports.month')} value={month} max={localToday().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-48" />
        <Button variant="quiet" loading={busy === 'x'} disabled={!reg} onClick={() => run('x', '/reports/register', { classId: cid, month, format: 'xlsx' }, 'register.xlsx')}>
          <Download className="size-4" /> {t('reports.excel')}
        </Button>
        <Button variant="quiet" disabled={!reg} onClick={() => window.print()}><Printer className="size-4" /> {t('reports.print')}</Button>
      </div>
      {q.isError && <Notice tone="error">{errorMessage(q.error)}</Notice>}
      {q.isLoading && <Skeleton className="h-96" />}
      {reg && (
        <div className="print-area">
          <div className="mb-3">
            <p className="text-xl font-bold">{reg.school.name} · {classLabel(reg.class)} · {fmtMonth(reg.month)}</p>
            <p className="text-muted">
              {t('reports.workingDays')}: <b>{reg.totals.workingDays}</b> · {reg.totals.pct !== null && <>{reg.totals.pct}% · </>}
              {reg.totals.averageDaily !== null && t('reports.averageDaily', { n: reg.totals.averageDaily })} · {t('reports.legend')}
            </p>
          </div>
          {reg.totals.workingDays === 0 ? <Notice tone="info">{t('reports.noWorking')}</Notice> : (
            <Card className="overflow-x-auto print:overflow-visible print:border-0">
              <table className="w-full border-collapse text-[13px] tabular-nums print:text-[9px]">
                <thead>
                  <tr className="bg-board text-chalk">
                    <th className="sticky left-0 z-10 bg-board px-2 py-1.5 text-right">#</th>
                    <th className="sticky left-8 z-10 min-w-36 bg-board px-2 text-left">{t('admin.name')}</th>
                    {reg.days.map((d) => <th key={d.date} className={`w-6 px-0 text-center font-semibold ${d.closed ? 'opacity-50' : ''}`}>{d.day}</th>)}
                    <th className="px-2">{t('reports.present')}</th><th className="px-2">{t('reports.absent')}</th><th className="px-2">{t('reports.leave')}</th><th className="px-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {reg.rows.map((r) => (
                    <tr key={r._id} className="border-b border-line/60 odd:bg-paper/50">
                      <td className="sticky left-0 bg-inherit px-2 py-1 text-right text-muted">{r.rollNo}</td>
                      <td className="sticky left-8 truncate bg-inherit px-2 font-semibold">{r.name}</td>
                      {reg.days.map((d) => {
                        const s = r.marks[d.date];
                        return <td key={d.date} className={`text-center ${d.closed ? 'bg-line/40 text-muted' : CELL[s] || ''}`}>{d.closed ? 'H' : s ? SHORT[s] : ''}</td>;
                      })}
                      <td className="px-2 text-center font-semibold">{r.present}</td>
                      <td className="px-2 text-center">{r.A}</td>
                      <td className="px-2 text-center">{r.LV}</td>
                      <td className={`px-2 text-center ${r.pct !== null && r.pct < 75 ? 'font-bold text-absent' : ''}`}>{r.pct ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-ink font-bold">
                    <td className="sticky left-0 bg-card" />
                    <td className="sticky left-8 bg-card px-2 py-1.5">{t('reports.total')}</td>
                    {reg.daily.map((d, i) => <td key={d.date} className="text-center">{reg.days[i].closed || !d.marked ? '' : d.present}</td>)}
                    <td className="px-2 text-center">{reg.totals.presentDays}</td>
                    <td className="px-2 text-center">{reg.totals.absentDays}</td>
                    <td className="px-2 text-center">{reg.totals.leaveDays}</td>
                    <td className="px-2 text-center">{reg.totals.pct}</td>
                  </tr>
                </tfoot>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Shortage() {
  const { t } = useTranslation();
  const [threshold, setThreshold] = useState(75);
  const q = useQuery({ queryKey: ['shortage', threshold], queryFn: () => api.get('/reports/shortage', { params: { threshold } }).then((r) => r.data) });
  const [busy, run] = useDownload();
  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input name="threshold" type="number" min={1} max={100} label={`${t('reports.threshold')} (%)`} value={threshold} onChange={(e) => setThreshold(Number(e.target.value) || 75)} className="w-32" />
        <Button variant="quiet" loading={busy === 'x'} onClick={() => run('x', '/reports/shortage', { threshold, format: 'xlsx' }, 'shortage.xlsx')}><Download className="size-4" /> {t('reports.excel')}</Button>
      </div>
      {q.isLoading && <Skeleton className="h-64" />}
      {q.data && (
        <>
          <p className="mb-3 font-semibold">{q.data.students.length ? t('reports.shortageCount', { count: q.data.students.length, n: q.data.threshold }) : t('reports.shortageNone', { n: q.data.threshold })}</p>
          <Card className="divide-y divide-line/70">
            {q.data.students.map((s) => (
              <div key={s._id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-16 text-sm text-muted">{classLabel(s.class)}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
                <span className="w-20 text-right text-sm text-muted tabular-nums">{s.present}/{s.days}</span>
                <span className="w-14 text-right font-bold text-absent tabular-nums">{s.pct}%</span>
                {s.parent?.phone ? <a href={`tel:${s.parent.phone}`} aria-label={`${t('common.call')} ${s.parent.name}`} className="rounded-lg p-2 text-board hover:bg-board/8"><Phone className="size-4" /></a> : <span className="w-8" />}
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function Sats() {
  const { t } = useTranslation();
  const [month, setMonth] = useState(localToday().slice(0, 7));
  const [busy, run] = useDownload();
  return (
    <Card className="max-w-2xl p-5">
      <p className="mb-2">{t('reports.satsIntro')}</p>
      <p className="mb-4 text-sm text-muted">{t('reports.satsNote')}</p>
      <div className="flex flex-wrap items-end gap-3">
        <Input name="month" type="month" label={t('reports.month')} value={month} max={localToday().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-48" />
        <Button loading={busy === 'x'} onClick={() => run('x', '/reports/sats', { month, format: 'xlsx' }, 'sats.xlsx')}><Download className="size-4" /> {t('reports.excel')}</Button>
        <Button variant="quiet" loading={busy === 'c'} onClick={() => run('c', '/reports/sats', { month, format: 'csv' }, 'sats.csv')}><Download className="size-4" /> {t('reports.csv')}</Button>
      </div>
    </Card>
  );
}
