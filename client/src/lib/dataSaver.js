import { create } from 'zustand';

/**
 * Low-data mode for prepaid data packs (research issue #2): no background refreshing of
 * lists and dashboards. Marking and syncing attendance are never affected.
 * Turns on by itself when the phone's Data Saver is on.
 */
const KEY = 'haajari.dataSaver';
const initial = (() => {
  try {
    const v = localStorage.getItem(KEY);
    if (v !== null) return v === '1';
  } catch { /* ignore */ }
  return Boolean(navigator.connection?.saveData);
})();

export const useDataSaver = create((set) => ({
  on: initial,
  set: (on) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ } set({ on }); },
}));

/** Refresh interval for a live view, or none in low-data mode. */
export const live = (ms) => (useDataSaver.getState().on ? false : ms);
