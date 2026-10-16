import { useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ChevronLeft, ChevronRight, CloudOff, History, RotateCcw, CheckCircle2, CloudUpload } from 'lucide-react';
import { db } from '../../offline/db';
import { loadRoster, loadClasses, editNeedsReason, localToday } from '../../offline/roster';
import { saveMarks, retryBatch, discardBatch } from '../../offline/sync';
import { api } from '../../lib/api';
import { classLabel } from '../../lib/format';
import { reasonText } from '../../lib/dates';
import { nextStatus, STATUS_STYLE } from '../../lib/status';
import StudentTile from '../../components/StudentTile';
import Confetti from '../../components/Confetti';
import Sheet from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { Button, Notice, Skeleton } from '../../components/ui';

const dayShift = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isClosed = (school, iso) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0 || (school.holidays || []).some((h) => h.date === iso);

export default function MarkAttendance() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();

  const date = params.get('date') || '';
  const roster = useQuery({ queryKey: ['roster', id, date], queryFn: () => loadRoster(id, date || undefined), retry: false });
  const r = roster.data;
  const theDate = r?.date || date;
  const period = Number(params.get('period') ?? (r?.class.mode === 'period' ? 1 : 0));

  const localRows = useLiveQuery(
    () => (theDate ? db.marks.where('[classId+date+period]').equals([id, theDate, period]).toArray() : []),
    [id, theDate, period],
    []
  );

  const [draft, setDraft] = useState({});
  const [draftKey, setDraftKey] = useState('');
  const key = `${id}|${theDate}|${period}`;
  if (key !== draftKey) { setDraftKey(key); setDraft({}); }

  const [reasonOpen, setReasonOpen] = useState(false);
  const [auditFor, setAuditFor] = useState(null);
  const [done, setDone] = useState(null);

  // What is saved, per student: phone row wins over the server copy (it is newer or equal).
  const { saved, syncOf, noteOf, leaveOnly } = useMemo(() => {
    const savedMap = {};
    const sync = {};
    const notes = {};
    const fromLeave = {};
    (r?.marks || []).filter((m) => m.period === period).forEach((m) => {
      savedMap[m.studentId] = m.status;
      sync[m.studentId] = 'server';
      if (m.reasonBy === 'parent') notes[m.studentId] = reasonText(t, m.reason);
      if (m.source === 'leave') fromLeave[m.studentId] = true;
    });
    localRows.forEach((m) => { savedMap[m.studentId] = m.status; sync[m.studentId] = m.synced ? 'server' : 'phone'; });
    localRows.forEach((m) => { delete fromLeave[m.studentId]; });
    return { saved: savedMap, syncOf: sync, noteOf: notes, leaveOnly: fromLeave };
  }, [r, localRows, period, t]);

  const students = r?.students || [];
  // Approved leave fills some days in advance; the register still counts as not taken.
  const firstSave = students.length > 0 && students.every((s) => saved[s._id] === undefined || leaveOnly[s._id]);
  const statusOf = (sid) => draft[sid] ?? saved[sid] ?? 'P';
  const changed = students.filter((s) => draft[s._id] !== undefined && draft[s._id] !== (saved[s._id] ?? 'P'));
  const counts = students.reduce((acc, s) => ({ ...acc, [statusOf(s._id)]: acc[statusOf(s._id)] + 1 }), { P: 0, A: 0, L: 0, LV: 0 });
  const errorRows = localRows.filter((m) => m.error);
  const needsReasonErr = errorRows.some((m) => m.error === 'needs_reason');
  const otherErr = errorRows.find((m) => m.error !== 'needs_reason')?.error;
  const pendingCount = localRows.filter((m) => !m.synced).length;
  const closed = r && (r.closed || (r.school && isClosed(r.school, theDate)));

  const tap = (sid) => setDraft((d) => ({ ...d, [sid]: nextStatus(statusOf(sid)) }));
  const allPresent = () => setDraft(Object.fromEntries(students.map((s) => [s._id, 'P'])));

  const doSave = async (editReason) => {
    const statuses = firstSave
      ? Object.fromEntries(students.map((s) => [s._id, statusOf(s._id)]))
      : Object.fromEntries(changed.map((s) => [s._id, draft[s._id]]));
    const serverMarks = Object.fromEntries((r.marks || []).filter((m) => m.period === period).map((m) => [m.studentId, m.status]));
    await saveMarks({ classId: id, date: theDate, period, statuses, serverMarks, editReason });
    setDraft({});
    setReasonOpen(false);
    qc.invalidateQueries({ queryKey: ['classes'] });
    if (firstSave) setDone({ present: counts.P + counts.L, total: students.length });
    else toast(navigator.onLine ? t('mark.savedServer') : t('mark.savedPhone'));
  };

  const onSave = () => {
    const editsSaved = changed.some((s) => saved[s._id] !== undefined);
    if (!firstSave && editsSaved && r.school && editNeedsReason(r.school, theDate)) setReasonOpen(true);
    else doSave();
  };

  // Date stepping: skip Sundays and holidays; stay inside the back-date limit.
  const today = r?.today || (r?.school ? localToday(r.school.timezone) : theDate);
  const step = (dir) => {
    let d = dayShift(theDate, dir);
    for (let i = 0; i < 10 && isClosed(r.school, d); i++) d = dayShift(d, dir);
    const p = new URLSearchParams(params);
    if (d === today) p.delete('date'); else p.set('date', d);
    setParams(p, { replace: true });
  };
  const canPrev = r?.school && dayShift(theDate, -1) >= dayShift(today, -r.school.teacherBackdateDays);
  const canNext = theDate < today;
  const dateLabel = theDate === today ? t('mark.today')
    : new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${theDate}T00:00:00Z`));

  const setPeriod = (n) => { const p = new URLSearchParams(params); p.set('period', String(n)); setParams(p, { replace: true }); };

  if (roster.isError) {
    return (
      <Shell back="/t">
        <Notice tone="error" className="mt-6">{roster.error?.response ? roster.error.response.data?.error?.message : t('mark.noRoster')}</Notice>
      </Shell>
    );
  }

  return (
    <Shell back="/t" title={r ? classLabel(r.class) : ''} historyTo={`/t/class/${id}/history`}>
      {/* date + period */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <IconBtn label={t('mark.prev')} disabled={!canPrev} onClick={() => step(-1)}><ChevronLeft /></IconBtn>
          <span className="min-w-24 text-center text-lg font-semibold">{dateLabel}</span>
          <IconBtn label={t('mark.next')} disabled={!canNext} onClick={() => step(1)}><ChevronRight /></IconBtn>
        </div>
        {!firstSave && students.length > 0 && (
          <button onClick={allPresent} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[15px] font-semibold text-board-text hover:bg-board/8">
            <RotateCcw className="size-4" /> {t('mark.allPresent')}
          </button>
        )}
      </div>
      {r?.class.mode === 'period' && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {Array.from({ length: r.class.periodsPerDay || 7 }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setPeriod(n)} aria-pressed={period === n}
              className={`shrink-0 rounded-full border px-4 py-1.5 font-semibold ${period === n ? 'border-board bg-board text-chalk' : 'border-line bg-card text-ink'}`}>
              {t('mark.period', { n })}
            </button>
          ))}
        </div>
      )}

      {r?.fromCache && <Notice tone="warn" className="mb-3"><CloudOff className="mr-1 inline size-4" /> {t('mark.offlineRoster')}</Notice>}
      {closed && <Notice tone="info" className="mb-3">{t('mark.closed', { reason: r.closed || 'Sunday' })}</Notice>}
      {needsReasonErr && (
        <Notice tone="warn" className="mb-3">
          <p>{t('mark.needsReason')}</p>
          <div className="mt-2 flex gap-2">
            <Button className="min-h-10 px-3" onClick={() => setReasonOpen('retry')}>{t('mark.addReason')}</Button>
            <Button variant="quiet" className="min-h-10 px-3" onClick={() => discardBatch({ classId: id, date: theDate, period })}>{t('mark.discard')}</Button>
          </div>
        </Notice>
      )}
      {otherErr && (
        <Notice tone="error" className="mb-3">
          <p>{t('mark.error', { message: otherErr })}</p>
          <div className="mt-2 flex gap-2">
            <Button variant="quiet" className="min-h-10 px-3" onClick={() => retryBatch({ classId: id, date: theDate, period })}>{t('mark.retry')}</Button>
            <Button variant="quiet" className="min-h-10 px-3" onClick={() => discardBatch({ classId: id, date: theDate, period })}>{t('mark.discard')}</Button>
          </div>
        </Notice>
      )}
      {firstSave && !closed && <p className="mb-3 text-[15px] text-muted">{t('mark.hint')}</p>}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {roster.isLoading && Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-[84px]" />)}
        {students.map((s) => {
          const isDraft = draft[s._id] !== undefined && draft[s._id] !== (saved[s._id] ?? 'P');
          return (
            <StudentTile key={s._id} student={s} status={statusOf(s._id)} disabled={Boolean(closed)}
              sync={isDraft ? 'draft' : syncOf[s._id] || null}
              note={noteOf[s._id]}
              onTap={() => tap(s._id)} onHold={() => setAuditFor(s)} />
          );
        })}
      </div>
      {!firstSave && students.length > 0 && <p className="mt-3 text-center text-sm text-muted">{t('mark.holdHint')}</p>}

      {/* live counter + save */}
      {students.length > 0 && !closed && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="flex flex-1 flex-wrap gap-x-3 gap-y-0.5 text-[15px]" aria-live="polite">
              {['P', 'A', 'L', 'LV'].map((k) => (counts[k] > 0 || k === 'P' || k === 'A') && (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${STATUS_STYLE[k].dot}`} />
                  <b className="tabular-nums">{counts[k]}</b> {t(`status.${k}`)}
                </span>
              ))}
              {pendingCount > 0 && changed.length === 0 && (
                <span className="inline-flex items-center gap-1 text-muted"><CloudUpload className="size-4" /> {t('sync.pending', { count: pendingCount })}</span>
              )}
            </div>
            {(firstSave || changed.length > 0) ? (
              <Button onClick={onSave} className="min-h-14 px-6 text-lg">
                {firstSave ? t('mark.save') : t('mark.saveChanges', { count: changed.length })}
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-present"><CheckCircle2 className="size-5" /> {t('mark.saved')}</span>
            )}
          </div>
        </div>
      )}

      <ReasonSheet
        open={Boolean(reasonOpen)}
        onClose={() => setReasonOpen(false)}
        onSave={async (reason) => {
          if (reasonOpen === 'retry') { await retryBatch({ classId: id, date: theDate, period, editReason: reason }); setReasonOpen(false); }
          else await doSave(reason);
        }}
      />
      <AuditSheet student={auditFor} date={theDate} onClose={() => setAuditFor(null)} />
      <DoneOverlay done={done} classId={id} go={(path) => { setDone(null); navigate(path, { replace: true }); }} />
    </Shell>
  );
}

function Shell({ back, title, historyTo, children }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh bg-paper pb-36">
      <header className="chalkboard sticky top-0 z-10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Link to={back} aria-label={t('common.back')} className="-ml-2 rounded-full p-2 hover:bg-white/10"><ArrowLeft className="size-6" /></Link>
          <h1 className="flex-1 truncate text-2xl font-bold">{title || t('mark.title')}</h1>
          {historyTo && (
            <Link to={historyTo} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[15px] font-semibold hover:bg-white/20">
              <History className="size-4" /> {t('mark.history')}
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-4">{children}</main>
    </div>
  );
}

function IconBtn({ children, label, ...props }) {
  return (
    <button {...props} aria-label={label} className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-line/50 disabled:opacity-30">
      {children}
    </button>
  );
}

function ReasonSheet({ open, onClose, onSave }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const quick = { kn: ['ತಡವಾಗಿ ಬಂದರು', 'ತಪ್ಪಾಗಿ ಗುರುತಿಸಿದ್ದೆ', 'ಪೋಷಕರು ರಜೆ ತಿಳಿಸಿದರು'], en: ['Came late', 'Marked by mistake', 'Parent informed leave'], hi: ['देर से आया', 'गलती से लगाई', 'अभिभावक ने छुट्टी बताई'] };
  const { i18n } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={t('mark.reasonTitle')}>
      <p className="mb-3 text-muted">{t('mark.reasonIntro')}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {(quick[i18n.language] || quick.en).map((q) => (
          <button key={q} type="button" onClick={() => setReason(q)} className={`rounded-full border px-3 py-1 ${reason === q ? 'border-board bg-board/8 text-board-text' : 'border-line'}`}>{q}</button>
        ))}
      </div>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={t('mark.reasonPlaceholder')}
        aria-label={t('mark.reasonTitle')}
        className="mb-4 w-full rounded-xl border border-line p-3 outline-none focus:border-board focus:ring-4 focus:ring-board/10" />
      <Button className="w-full" loading={busy} disabled={reason.trim().length < 3}
        onClick={async () => { setBusy(true); try { await onSave(reason.trim()); setReason(''); } finally { setBusy(false); } }}>
        {t('mark.reasonSave')}
      </Button>
    </Sheet>
  );
}

function AuditSheet({ student, date, onClose }) {
  const { t, i18n } = useTranslation();
  const q = useQuery({
    queryKey: ['audit', student?._id, date],
    queryFn: () => api.get('/attendance/audit', { params: { studentId: student._id, date } }).then((x) => x.data.logs),
    enabled: Boolean(student),
  });
  return (
    <Sheet open={Boolean(student)} onClose={onClose} title={student ? t('mark.changes', { name: student.name }) : ''}>
      {q.isLoading && <Skeleton className="h-16" />}
      {q.isError && <Notice tone="error">{t('errors.network')}</Notice>}
      {q.data?.length === 0 && <p className="text-muted">{t('mark.noChanges')}</p>}
      <ul className="space-y-2">
        {q.data?.map((l) => (
          <li key={l._id} className="rounded-xl bg-paper px-3 py-2">
            <p className="font-semibold">{t('mark.by', { from: t(`status.${l.from}`), to: t(`status.${l.to}`), name: l.changedBy?.name })}</p>
            <p className="text-[15px] text-muted">{new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(l.at))} · {l.reason}</p>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function DoneOverlay({ done, classId, go }) {
  const { t } = useTranslation();
  const classes = useQuery({ queryKey: ['classes'], queryFn: loadClasses, enabled: Boolean(done) });
  const next = classes.data?.classes.find((c) => c._id !== classId && !c.today);
  return (
    <AnimatePresence>
      {done && (
        <motion.div className="chalkboard fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Confetti fire={done.present === done.total} />
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 14, stiffness: 220, delay: 0.05 }}>
            <CheckCircle2 className="mx-auto size-20 text-chalk" strokeWidth={1.6} />
          </motion.div>
          <p className="mt-4 text-[34px] leading-tight font-bold">{t('mark.doneTitle', done)}</p>
          <p className="mt-2 max-w-sm text-chalk/80">{navigator.onLine ? t('mark.savedServer') : t('mark.savedPhone')}</p>
          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            {next && (
              <button onClick={() => go(`/t/class/${next._id}/mark`)}
                className="min-h-14 rounded-xl bg-chalk text-lg font-semibold text-slate">
                {t('mark.nextClass', { name: classLabel(next) })}
              </button>
            )}
            <button onClick={() => go('/t')} className={`min-h-14 rounded-xl text-lg font-semibold ${next ? 'border border-chalk/40 text-chalk' : 'bg-chalk text-slate'}`}>
              {t('mark.done')}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
