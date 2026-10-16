import Dexie from 'dexie';

/**
 * On-phone storage. Marks are written here first, then pushed to the server,
 * so a slow or missing network never blocks a teacher (research issues #1, #2).
 */
export const db = new Dexie('haajari');

db.version(1).stores({
  // key: `${classId}|${date}` and `${classId}|latest`; value: the roster API response
  rosters: 'key, classId, cachedAt',
  // Teacher's class list (home screen) for offline start-up
  cache: 'key',
  // One row per student per day per period. synced: 0 = only on this phone, 1 = on the server.
  marks: '[classId+date+period+studentId], [classId+date+period], synced, clientId',
});

export const rosterKey = (classId, date) => `${classId}|${date}`;

export async function clearOfflineData() {
  await Promise.all([db.rosters.clear(), db.cache.clear(), db.marks.clear()]);
}
