import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, Soup, Siren, ChevronRight, AlertCircle, CheckCircle2, Send, HeartHandshake, Settings as SettingsIcon, LayoutGrid, Users, GraduationCap } from 'lucide-react';
import { api } from '../../lib/api';
import { classLabel, gradeShort, firstName } from '../../lib/format';
import { fmtDay, fmtTime } from '../../lib/dates';
import { useToast } from '../../components/Toast';
import { Card, Skeleton, Notice } from '../../components/ui';
import ClassBars from '../../components/charts/ClassBars';
import TrendLine from '../../components/charts/TrendLine';
import { live } from '../../lib/dataSaver';

export default function Dashboard() {
  const { t } = useTranslation();
  const toast = useToast((s) => s.show);
  const school = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school').then((r) => r.data.school) });
  const today = useQuery({ queryKey: ['dash-today'], queryFn: () => api.get('/dashboard/today').then((r) => r.data), refetchInterval: () => live(30_000) });
  const trend = useQuery({ queryKey: ['dash-trend'], queryFn: () => api.get('/dashboard/trend').then((r) => r.data.days) });
  const risk = useQuery({ queryKey: ['risk'], queryFn: () => api.get('/risk').then((r) => r.data) });
  const summary = useQuery({ queryKey: ['summary'], queryFn: () => api.get('/dashboard/summary').then((r) => r.data) });
  const d = today.data;
  const threshold = school.data?.alertThreshold ?? 75;
  const unmarked = d?.classes.filter((c) => !c.marked) || [];
  const avg = trend.data?.length ? Math.round(trend.data.reduce((a, x) => a + x.pct, 0) / trend.data.length) : null;

  const sendToCook = async () => {
    const meal = d.classes.filter((c) => c.meal && c.marked);
    const text = `${t('dash.mealMsg', { date: fmtDay(d.date, { day: 'numeric', month: 'long' }), total: d.totals.meals })}\n${meal.map((c) => `${gradeShort(c.grade)} ${c.section}: ${c.present}`).join('\n')}`;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* cancelled */ } }
    try { await navigator.clipboard.writeText(text); toast(t('dash.copied')); } catch { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); }
  };

  const checks = summary.data ? [
    { n: summary.data.classesWithoutTeacher, label: t('admin.checkTeacher', { count: summary.data.classesWithoutTeacher }), to: '/a/classes' },
    { n: summary.data.studentsWithoutSats, label: t('admin.checkSats', { count: summary.data.studentsWithoutSats }), to: '/a/students' },
    { n: summary.data.studentsWithoutParent, label: t('admin.checkParent', { count: summary.data.studentsWithoutParent }), to: '/a/students' },
  ].filter((c) => c.n > 0) : [];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[28px] leading-tight font-bold">{school.data?.name || ' '}</h1>
          <p className="text-muted">{d && `${fmtDay(d.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${t('dash.updated', { time: fmtTime(today.dataUpdatedAt) })}`}</p>
        </div>
      </div>
      {today.isError && <Notice tone="error" className="mb-4">{t('errors.network')}</Notice>}
      {summary.data && d && d.classes.length === 0 && <GettingStarted summary={summary.data} />}
      {d && d.classes.length === 0 ? null : (<>
      {d?.closed && <Notice tone="info" className="mb-4">{t('dash.closed', { reason: d.closed })}</Notice>}

      {/* Headline: who is here right now, and how many registers are in */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="chalkboard flex flex-col justify-between gap-6 border-0 p-6">
          {d ? (
            <>
              <div>
                <p className="text-[72px] leading-none font-bold tabular-nums">{d.totals.inSchool}</p>
                <p className="mt-1 text-xl">{t('dash.inSchool')}</p>
                <p className="text-chalk/75">{d.totals.marked ? t('dash.ofStudents', { total: d.totals.students, pct: d.totals.pct }) : t('dash.noneMarked')}</p>
              </div>
              <Link to="/a/in-school" className="inline-flex min-h-12 items-center justify-between gap-2 self-start rounded-xl bg-accent px-4 font-semibold text-on-brand">
                <Siren className="size-5" /> {t('dash.drillBtn')} <ChevronRight className="size-4" />
              </Link>
            </>
          ) : <Skeleton className="h-40 bg-black/10" />}
        </Card>
        <Card className="p-5">
          {d ? (
            <>
              <p className="mb-1 text-lg font-semibold">{t('dash.registers', { marked: d.totals.marked, total: d.totals.classes })}</p>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-line/60">
                <div className="h-full rounded-full bg-board" style={{ width: `${(d.totals.marked / d.totals.classes) * 100}%` }} />
              </div>
              {unmarked.length === 0 ? (
                <p className="flex items-center gap-2 font-semibold text-present"><CheckCircle2 className="size-5" /> {t('dash.allTaken')}</p>
              ) : (
                <ul className="max-h-56 divide-y divide-line/70 overflow-y-auto">
                  {unmarked.map((c) => (
                    <li key={c._id} className="flex items-center gap-3 py-2">
                      <span className="w-20 font-semibold">{classLabel(c)}</span>
                      <span className="min-w-0 flex-1 truncate text-muted">{c.teacher ? firstName(c.teacher.name) : '—'}</span>
                      {c.teacher?.phone && (
                        <a href={`tel:${c.teacher.phone}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[15px] font-semibold text-board-text hover:bg-board/8">
                          <Phone className="size-4" /> {t('dash.callTeacher')}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : <Skeleton className="h-40" />}
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        {/* Mid-day meal */}
        <Card className="p-5">
          <p className="mb-2 flex items-center gap-2 text-lg font-semibold"><Soup className="size-5 text-late" /> {t('dash.meals')}</p>
          {d ? (
            <>
              <p className="text-[48px] leading-none font-bold tabular-nums">{d.totals.meals}</p>
              <p className="mb-3 text-muted">{t('dash.plates')}</p>
              <p className="mb-3 text-sm text-muted">{d.totals.mealClassesUnmarked ? t('dash.mealNote', { count: d.totals.mealClassesUnmarked }) : t('dash.mealNote_zero')}</p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {d.classes.filter((c) => c.meal).map((c) => (
                  <span key={c._id} className={`rounded-lg px-2 py-0.5 text-sm tabular-nums ${c.marked ? 'bg-paper' : 'border border-dashed border-line text-muted'}`}>
                    {gradeShort(c.grade)} {c.section}: <b>{c.marked ? c.present : '—'}</b>
                  </span>
                ))}
              </div>
              <button onClick={sendToCook} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 font-semibold text-board-text hover:border-board">
                <Send className="size-4" /> {t('dash.copyCook')}
              </button>
            </>
          ) : <Skeleton className="h-40" />}
        </Card>
        {/* Class-wise today */}
        <Card className="p-5">
          <p className="mb-3 text-lg font-semibold">{t('dash.classesToday')}</p>
          {d ? <ClassBars classes={d.classes} threshold={threshold} /> : <Skeleton className="h-64" />}
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-5">
          <p className="text-lg font-semibold">{t('dash.trend')}</p>
          {avg !== null && <p className="mb-2 text-muted">{t('dash.trendAvg', { pct: avg })}</p>}
          {trend.data ? <TrendLine days={trend.data} threshold={threshold} /> : <Skeleton className="h-40" />}
        </Card>
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-2 text-lg font-semibold"><HeartHandshake className="size-5 text-absent" /> {t('dash.followUp')}</p>
            <Link to="/a/at-risk" className="font-semibold text-board-text">{t('dash.seeAll')}</Link>
          </div>
          {risk.data && (
            <>
              <p className="mb-2 text-muted">{risk.data.flags.length ? t('dash.followUpCount', { count: risk.data.flags.length }) : t('risk.none')}</p>
              <ul className="divide-y divide-line/70">
                {risk.data.flags.slice(0, 5).map((f) => (
                  <li key={f._id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="block truncate font-semibold">{f.studentId?.name}</span>
                      <span className="block text-sm text-muted">{classLabel(f.classId)}</span>
                    </span>
                    <span className="shrink-0 text-right text-sm font-semibold whitespace-nowrap text-absent">
                      {f.reasons.includes('streak') ? t('risk.streak', { count: f.streak }) : t('risk.low_month', { pct: f.monthPct ?? f.yearPct })}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {checks.length > 0 && (
        <Card className="divide-y divide-line/70">
          <p className="px-4 pt-3 pb-2 font-semibold">{t('dash.setup')}</p>
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-3 px-4 py-3">
              <AlertCircle className="size-5 shrink-0 text-late" />
              <span className="flex-1">{c.label}</span>
              <Link to={c.to} className="rounded-lg px-3 py-1.5 font-semibold text-board-text hover:bg-board/8">{t('admin.fix')}</Link>
            </div>
          ))}
        </Card>
      )}
      </>)}
    </div>
  );
}

// A school that was just approved has nothing in it yet: show the four steps to get going.
function GettingStarted({ summary }) {
  const { t } = useTranslation();
  const steps = [
    { to: '/a/settings', icon: SettingsIcon, label: t('start.s1'), done: false },
    { to: '/a/classes', icon: LayoutGrid, label: t('start.s2'), done: summary.classes > 0 },
    { to: '/a/teachers', icon: Users, label: t('start.s3'), done: summary.teachers > 0 },
    { to: '/a/students', icon: GraduationCap, label: t('start.s4'), done: summary.students > 0 },
  ];
  return (
    <Card className="chalkboard mb-4 border-0 p-6">
      <h2 className="text-2xl font-bold">{t('start.title')}</h2>
      <p className="mt-1 text-chalk/80">{t('start.sub')}</p>
      <ol className="mt-5 grid gap-2 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.to}>
            <Link to={s.to} className="flex min-h-14 items-center gap-3 rounded-xl bg-card px-4 py-3 font-semibold text-ink shadow-lift hover:brightness-95">
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${s.done ? 'bg-present text-white' : 'bg-accent text-on-brand'}`}>
                {s.done ? <CheckCircle2 className="size-5" aria-hidden /> : i + 1}
              </span>
              <s.icon className="size-5 shrink-0 text-board-text" aria-hidden />
              <span className="flex-1">{s.label}</span>
              <ChevronRight className="size-5 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
