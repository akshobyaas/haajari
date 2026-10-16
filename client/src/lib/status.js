// Tap order on the marking screen. Absent comes first because it is the common change.
export const CYCLE = ['P', 'A', 'L', 'LV'];
export const nextStatus = (s) => CYCLE[(CYCLE.indexOf(s) + 1) % CYCLE.length];

// Card styles per status: present stays quiet so absentees stand out.
export const STATUS_STYLE = {
  P: { card: 'bg-card border-line', chip: 'bg-present/12 text-present', dot: 'bg-present' },
  A: { card: 'bg-absent text-white border-absent', chip: 'bg-white/20 text-white', dot: 'bg-absent' },
  L: { card: 'bg-late/15 border-late', chip: 'bg-late text-white', dot: 'bg-late' },
  LV: { card: 'bg-leave/12 border-leave/60', chip: 'bg-leave text-white', dot: 'bg-leave' },
};
