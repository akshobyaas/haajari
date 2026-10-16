// School-local dates as 'YYYY-MM-DD' strings, so a 9 a.m. mark in Mysuru is never filed under yesterday.
function partsIn(tz, d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const todayIn = (tz, d) => partsIn(tz, d).date;
const nowTimeIn = (tz, d) => partsIn(tz, d).time;
const dayOfWeek = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

// Why a date cannot be marked, or null if it can.
function closedReason(school, iso) {
  if (dayOfWeek(iso) === 0) return 'Sunday';
  const h = (school.holidays || []).find((x) => x.date === iso);
  return h ? `Holiday: ${h.name}` : null;
}

// A changed mark needs a reason unless it is the same day and still inside the marking window.
function editNeedsReason(school, date, now = new Date()) {
  return !(date === todayIn(school.timezone, now) && nowTimeIn(school.timezone, now) <= school.markingWindow.end);
}

module.exports = { editNeedsReason, todayIn, nowTimeIn, dayOfWeek, addDays, daysBetween, closedReason };
