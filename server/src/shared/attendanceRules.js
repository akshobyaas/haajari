/**
 * Rules about attendance that several features share. Keep them here so reports,
 * the parent app, the follow-up list and school setup always agree.
 */

// Which register counts as "the day": period 0 for daily classes, period 1 for period-wise classes.
const dayPeriod = (cls) => (cls?.mode === 'period' ? 1 : 0);

// Percentage with one decimal, or null when nothing was marked.
const pct = (present, total) => (total ? Math.round((present / total) * 1000) / 10 : null);

// The Indian academic year starts in June. From a school-date "YYYY-MM-DD":
const academicYearStart = (iso) => (Number(iso.slice(5, 7)) >= 6 ? `${iso.slice(0, 4)}-06-01` : `${Number(iso.slice(0, 4)) - 1}-06-01`);

// Label for the academic year containing a date: Oct 2026 -> "2026-27", Mar 2027 -> "2026-27".
function academicYearOf(date = new Date()) {
  const y = date.getFullYear();
  const start = date.getMonth() >= 5 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

// Counts per status plus days and % present (late counts as present).
function tally(rows) {
  const t = { P: 0, A: 0, L: 0, LV: 0 };
  rows.forEach((r) => { t[r.status] += 1; });
  const days = t.P + t.A + t.L + t.LV;
  return { ...t, days, pct: pct(t.P + t.L, days) };
}

module.exports = { dayPeriod, pct, academicYearStart, academicYearOf, tally };
