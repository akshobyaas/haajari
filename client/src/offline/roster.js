import { db, rosterKey } from './db';
import { classesApi } from '../api/classes';

/**
 * Network first, phone cache second. The class list (students) rarely changes, so a
 * roster cached on any earlier day is good enough to mark offline today.
 */
export async function loadRoster(classId, date) {
  try {
    const data = await classesApi.roster(classId, date);
    const now = Date.now();
    await db.rosters.bulkPut([
      { key: rosterKey(classId, data.date), classId, cachedAt: now, data },
      { key: rosterKey(classId, 'latest'), classId, cachedAt: now, data },
    ]);
    return { ...data, fromCache: false };
  } catch (e) {
    if (e.response) throw e; // a real server answer (403, 404): don't hide it
    const exact = date && (await db.rosters.get(rosterKey(classId, date)));
    if (exact) return { ...exact.data, fromCache: true };
    const latest = await db.rosters.get(rosterKey(classId, 'latest'));
    if (!latest) throw e;
    const d = latest.data;
    // Same students; no server marks known for this date.
    return { ...d, date: date || localToday(d.school.timezone), marks: date === d.date ? d.marks : [], fromCache: true, closed: null };
  }
}

export async function loadClasses() {
  try {
    const data = await classesApi.overview();
    await db.cache.put({ key: 'classes', data, cachedAt: Date.now() });
    return { ...data, fromCache: false };
  } catch (e) {
    if (e.response) throw e;
    const hit = await db.cache.get('classes');
    if (!hit) throw e;
    return { ...hit.data, fromCache: true };
  }
}

/** Fill the phone cache for every class so the teacher can mark later with no network. */
export async function prefetchRosters(classIds) {
  await Promise.allSettled(classIds.map((id) => loadRoster(id)));
}

export function localToday(tz = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function localTime(tz = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
}
export const editNeedsReason = (school, date) => !(date === localToday(school.timezone) && localTime(school.timezone) <= school.markingWindow.end);
