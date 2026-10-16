import { db } from './db';
import { api } from '../lib/api';

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Save a class's marks on the phone. Only students whose status differs from what is
 * already stored get a new row, so re-saving does not resend the whole class.
 * Returns the number of rows queued.
 */
export async function saveMarks({ classId, date, period, statuses, serverMarks = {}, editReason }) {
  const now = new Date().toISOString();
  let queued = 0;
  await db.transaction('rw', db.marks, async () => {
    const existing = await db.marks.where('[classId+date+period]').equals([classId, date, period]).toArray();
    const local = new Map(existing.map((m) => [m.studentId, m]));
    for (const [studentId, status] of Object.entries(statuses)) {
      const current = local.get(studentId)?.status ?? serverMarks[studentId];
      if (current === status) continue;
      await db.marks.put({ classId, date, period, studentId, status, clientId: newId(), markedAt: now, synced: 0, editReason: editReason || null, error: null });
      queued += 1;
    }
  });
  if (queued) syncNow();
  return queued;
}

let running = null;
let again = false; // marks saved while a sync was already running
const listeners = new Set();
export const onSyncResult = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/** Push every unsynced batch to the server. Safe to call often; runs one at a time. */
export function syncNow() {
  if (running) { again = true; return running; }
  running = (async () => {
    if (!navigator.onLine) return { pending: true };
    const pending = await db.marks.where('synced').equals(0).filter((m) => !m.error).toArray();
    const groups = new Map();
    for (const m of pending) {
      const k = `${m.classId}|${m.date}|${m.period}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m);
    }
    let sent = 0;
    for (const rows of groups.values()) {
      const { classId, date, period } = rows[0];
      const editReason = rows.find((r) => r.editReason)?.editReason || undefined;
      try {
        const res = await api.post('/attendance/bulk', {
          classId, date, period, editReason,
          marks: rows.map(({ studentId, status, clientId, markedAt }) => ({ studentId, status, clientId, markedAt })),
        });
        await db.transaction('rw', db.marks, async () => {
          for (const r of res.data.results) {
            const row = await db.marks.get([classId, date, period, r.studentId]);
            if (!row || row.clientId !== r.clientId) continue; // changed again meanwhile; next sync sends it
            if (r.result === 'stale') await db.marks.update([classId, date, period, r.studentId], { status: r.current, synced: 1 });
            else await db.marks.update([classId, date, period, r.studentId], { synced: 1 });
          }
        });
        sent += rows.length;
        listeners.forEach((fn) => fn({ classId, date, period, ok: true }));
      } catch (e) {
        if (!e.response) break; // offline or server down: keep everything for later
        const code = e.response.data?.error?.code;
        const message = e.response.data?.error?.message || 'Could not save';
        // 4xx: retrying the same data will not help; flag it so the teacher can act.
        if (e.response.status >= 400 && e.response.status < 500) {
          await db.marks.bulkUpdate(rows.map((r) => ({ key: [r.classId, r.date, r.period, r.studentId], changes: { error: code === 'needs_reason' ? 'needs_reason' : message } })));
        }
        listeners.forEach((fn) => fn({ classId, date, period, ok: false, code, message }));
      }
    }
    return { sent };
  })().finally(() => {
    running = null;
    // Quick taps on the pickup board queue marks mid-sync; send them now, not in 20 seconds.
    if (again) { again = false; syncNow(); }
  });
  return running;
}

/** Retry a batch that the server refused, e.g. after adding a reason. */
export async function retryBatch({ classId, date, period, editReason }) {
  const rows = await db.marks.where('[classId+date+period]').equals([classId, date, period]).filter((m) => !m.synced).toArray();
  await db.marks.bulkUpdate(rows.map((r) => ({ key: [r.classId, r.date, r.period, r.studentId], changes: { error: null, ...(editReason ? { editReason } : {}) } })));
  return syncNow();
}

/** Throw away changes the server will not accept, going back to what is saved there. */
export async function discardBatch({ classId, date, period }) {
  const keys = await db.marks.where('[classId+date+period]').equals([classId, date, period]).filter((m) => !m.synced).primaryKeys();
  await db.marks.bulkDelete(keys);
}

let started = false;
export function startBackgroundSync() {
  if (started) return;
  started = true;
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncNow());
  setInterval(() => syncNow(), 20_000);
  syncNow();
}
