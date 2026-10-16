import { useCallback, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { ArrowLeft, ScanLine, Home, Phone, ShieldAlert } from 'lucide-react';
import { db } from '../../offline/db';
import { saveMarks } from '../../offline/sync';
import { api, errorMessage } from '../../lib/api';
import { classLabel, firstName } from '../../lib/format';
import { fmtTime } from '../../lib/dates';
import Sheet from '../../components/Sheet';
import QrScan from '../../components/QrScan';
import Avatar from '../../components/Avatar';
import { useToast } from '../../components/Toast';
import { Button, Notice, Skeleton } from '../../components/ui';
import { live } from '../../lib/dataSaver';

// Reads the child and guardian ids from a pass so the teacher can compare faces before handing over.
// The server still verifies the signature; this is only for showing the photo.
// Pass layout (see server/src/utils/pass.js): "HJ1:" + base64url(sid 12 bytes | gid 12 bytes | expiry 4 | mac 10).
const peekPass = (qr) => {
  if (!qr.startsWith('HJ1:')) return null;
  try {
    const bin = atob(qr.slice(4).replace(/-/g, '+').replace(/_/g, '/'));
    const hex = (from, to) => Array.from(bin.slice(from, to), (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    return bin.length === 38 ? { sid: hex(0, 12), gid: hex(12, 24) } : null;
  } catch { return null; }
};

const STATE_STYLE = {
  notArrived: 'border-dashed border-muted/40 bg-transparent text-muted',
  inSchool: 'border-present bg-present/10 text-ink',
  goneHome: 'border-leave bg-leave text-white',
  A: 'border-absent-strong bg-absent-strong text-white',
  LV: 'border-leave/60 bg-leave/12 text-ink',
};

/**
 * Pre-primary day: tap as each child arrives (works offline, uses the attendance queue);
 * at home time, hand each child to a person on the parent's list, by photo or QR pass.
 */
export default function PickupBoard() {
  const { id } = useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const board = useQuery({ queryKey: ['pickup', id], queryFn: () => api.get(`/pickup/class/${id}/today`).then((r) => r.data), refetchInterval: () => live(30_000) });
  const b = board.data;
  const local = useLiveQuery(() => (b ? db.marks.where('[classId+date+period]').equals([id, b.date, 0]).toArray() : []), [id, b?.date], []);
  const [handing, setHanding] = useState(null); // { student, guardianId?, passToken? }
  const [scanning, setScanning] = useState(false);
  const [doneFor, setDoneFor] = useState(null);

  const kids = useMemo(() => {
    if (!b) return [];
    const loc = new Map(local.map((m) => [m.studentId, m]));
    return b.students.map((s) => {
      const l = loc.get(s._id);
      const status = l?.status ?? s.mark?.status;
      const arrivedAt = l?.markedAt ?? s.mark?.markedAt;
      let state = 'notArrived';
      if (s.pickup?.checkOutAt) state = 'goneHome';
      else if (status === 'P' || status === 'L') state = 'inSchool';
      else if (status === 'A' || status === 'LV') state = status;
      return { ...s, status, arrivedAt, state };
    });
  }, [b, local]);

  const count = (st) => kids.filter((k) => k.state === st).length;
  const notArrived = kids.filter((k) => k.state === 'notArrived');

  const arrive = async (k) => {
    const late = k.state === 'A';
    await saveMarks({ classId: id, date: b.date, period: 0, statuses: { [k._id]: late ? 'L' : 'P' }, serverMarks: k.mark ? { [k._id]: k.mark.status } : {}, editReason: late ? 'Arrived late (check-in)' : undefined });
  };
  const markRestAbsent = () => saveMarks({ classId: id, date: b.date, period: 0, statuses: Object.fromEntries(notArrived.map((k) => [k._id, 'A'])) });

  const onTap = (k) => {
    if (k.state === 'notArrived' || k.state === 'A') return arrive(k);
    if (k.state === 'inSchool') return setHanding({ student: k });
    if (k.state === 'goneHome') return setDoneFor(k);
    return null;
  };

  const onScan = useCallback((text) => {
    setScanning(false);
    const p = peekPass(text);
    const student = p && kids.find((k) => k._id === p.sid);
    if (!p) { toast(t('pickup.notAPass')); return; }
    if (!student) { toast(t('pickup.otherClass')); return; }
    setHanding({ student, guardianId: p.gid, passToken: text });
  }, [kids, t, toast]);

  if (board.isError) {
    return <Shell title=""><Notice tone="error" className="mt-6">{board.error?.response ? errorMessage(board.error) : t('pickup.needOnline')}</Notice></Shell>;
  }

  return (
    <Shell title={b ? classLabel(b.class) : ''} onScan={() => setScanning(true)}>
      {b && <p className="mb-1 text-muted">{t('pickup.at', { time: b.pickupTime })}</p>}
      <p className="mb-4 text-[15px] text-muted">{t('pickup.hint')}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {board.isLoading && Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-28" />)}
        {kids.map((k) => (
          <motion.button key={k._id} whileTap={{ scale: 0.94 }} onClick={() => onTap(k)} disabled={k.state === 'LV'}
            className={`flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-center ${STATE_STYLE[k.state]}`}>
            <Avatar name={k.name} size={40} />
            <span className="w-full truncate font-semibold">{firstName(k.name)}</span>
            <span className="text-[12px] leading-tight opacity-90">
              {k.state === 'goneHome' ? <><Home className="mr-0.5 inline size-3" />{fmtTime(k.pickup.checkOutAt)}</>
                : k.state === 'inSchool' ? t('pickup.inSchool')
                : k.state === 'notArrived' ? t('pickup.notArrived')
                : t(`status.${k.state}`)}
            </span>
          </motion.button>
        ))}
      </div>

      {b && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
            <div className="flex flex-1 flex-wrap gap-x-3 text-[15px]" aria-live="polite">
              <span><b>{count('inSchool')}</b> {t('pickup.inSchool')}</span>
              <span><b>{count('goneHome')}</b> {t('pickup.goneHome')}</span>
              <span className="text-muted"><b>{notArrived.length}</b> {t('pickup.notArrived')}</span>
            </div>
            {notArrived.length > 0 && count('inSchool') + count('goneHome') > 0 && (
              <Button variant="quiet" className="min-h-11 px-3" onClick={markRestAbsent}>{t('pickup.markRest', { count: notArrived.length })}</Button>
            )}
          </div>
        </div>
      )}

      <Sheet open={scanning} onClose={() => setScanning(false)} title={t('pickup.scan')}>
        {scanning && <QrScan onResult={onScan} />}
      </Sheet>
      <HandOver handing={handing} onClose={() => setHanding(null)} onDone={(child, g, pickup) => {
        setHanding(null);
        // Show "gone home" at once from the server's reply, then refresh in the background.
        qc.setQueryData(['pickup', id], (old) => old && { ...old, students: old.students.map((x) => (x._id === child._id ? { ...x, pickup } : x)) });
        qc.invalidateQueries({ queryKey: ['pickup', id] });
        toast(t('pickup.handedOver', { child: firstName(child.name), name: g.name }));
      }} onScan={() => { setHanding(null); setScanning(true); }} />
      <Sheet open={Boolean(doneFor)} onClose={() => setDoneFor(null)} title={doneFor?.name || ''}>
        {doneFor && (
          <div className="space-y-4">
            <p className="text-lg">{t('pickup.by', { name: `${doneFor.pickup.collectedBy?.name} (${doneFor.pickup.collectedBy?.relation})`, time: fmtTime(doneFor.pickup.checkOutAt) })}</p>
            <Button variant="quiet" className="w-full" onClick={async () => {
              try {
                await api.post('/pickup/undo', { studentId: doneFor._id });
                qc.setQueryData(['pickup', id], (old) => old && { ...old, students: old.students.map((x) => (x._id === doneFor._id ? { ...x, pickup: null } : x)) });
                qc.invalidateQueries({ queryKey: ['pickup', id] });
                setDoneFor(null);
              } catch (e) { toast(errorMessage(e)); }
            }}>{t('pickup.undo')}</Button>
          </div>
        )}
      </Sheet>
    </Shell>
  );
}

function HandOver({ handing, onClose, onDone, onScan }) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(null);
  const s = handing?.student;
  const k = handing ? `${s._id}|${handing.guardianId || ''}` : null;
  if (k !== key) { setKey(k); setChosen(handing?.guardianId || null); setError(''); }
  const g = s?.pickupGuardians.find((x) => x._id === chosen);
  const parentPhone = s?.pickupGuardians.find((x) => x.phone)?.phone;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/pickup/checkout', handing.passToken ? { passToken: handing.passToken, studentId: s._id } : { studentId: s._id, guardianId: chosen });
      onDone(s, g, data.pickup);
    } catch (e) {
      setError(e.response ? errorMessage(e) : t('pickup.needOnline'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={Boolean(handing)} onClose={onClose} title={s ? t('pickup.handOver', { name: s.name }) : ''}>
      {s && !g && (
        <>
          <p className="mb-3 font-semibold">{t('pickup.who')}</p>
          <div className="grid grid-cols-2 gap-3">
            {s.pickupGuardians.map((x) => (
              <button key={x._id} onClick={() => setChosen(x._id)} className="flex flex-col items-center gap-2 rounded-2xl border-2 border-line p-3 text-center hover:border-board">
                {x.photoUrl ? <img src={x.photoUrl} alt="" className="aspect-square w-full rounded-xl object-cover" /> : <Avatar name={x.name} size={72} />}
                <span><span className="block font-semibold">{x.name}</span><span className="text-sm text-muted">{x.relation}</span></span>
              </button>
            ))}
          </div>
          <Button variant="quiet" className="mt-4 w-full" onClick={onScan}><ScanLine className="size-5" /> {t('pickup.scan')}</Button>
          <p className="mt-4 flex items-start gap-2 text-[15px] text-absent"><ShieldAlert className="mt-0.5 size-5 shrink-0" /> {t('pickup.notOnList')}</p>
          {parentPhone && <a href={`tel:${parentPhone}`} className="mt-2 inline-flex items-center gap-2 font-semibold text-board-text"><Phone className="size-4" /> {t('pickup.callParent')}</a>}
        </>
      )}
      {s && g && (
        <div className="text-center">
          {g.photoUrl ? <img src={g.photoUrl} alt="" className="mx-auto mb-3 aspect-square w-48 rounded-2xl object-cover" /> : <div className="mb-3 flex justify-center"><Avatar name={g.name} size={120} /></div>}
          <p className="text-2xl font-bold">{g.name}</p>
          <p className="mb-5 text-muted">{g.relation}</p>
          {error && <Notice tone="error" className="mb-3 text-left">{error}</Notice>}
          <Button className="min-h-14 w-full text-lg" loading={busy} onClick={confirm}>{t('pickup.confirm', { name: g.name })}</Button>
          {!handing.passToken && <button onClick={() => setChosen(null)} className="mt-3 font-semibold text-muted">{t('common.back')}</button>}
        </div>
      )}
    </Sheet>
  );
}

function Shell({ title, onScan, children }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh bg-paper pb-36">
      <header className="chalkboard sticky top-0 z-10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Link to="/t" aria-label={t('common.back')} className="-ml-2 rounded-full p-2 hover:bg-white/10"><ArrowLeft className="size-6" /></Link>
          <h1 className="flex-1 truncate text-2xl font-bold">{title || t('pickup.title')}</h1>
          {onScan && (
            <button onClick={onScan} className="inline-flex items-center gap-1 rounded-full bg-chalk px-3 py-1.5 font-semibold text-slate">
              <ScanLine className="size-4" /> {t('pickup.scan')}
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-4">{children}</main>
    </div>
  );
}
