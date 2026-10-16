import { useTranslation } from 'react-i18next';
import { STATUS_STYLE } from '../../lib/status';

/** Month grid, Monday first. Each school day is a dot in the status colour; Sundays and holidays are blank. */
export default function MonthCalendar({ month, days, holidays = [], today }) {
  const { t, i18n } = useTranslation();
  const byDate = new Map(days.map((d) => [d.date, d]));
  const hol = new Set(holidays.map((h) => h.date));
  const first = new Date(`${month}-01T00:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7; // Monday = 0
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const loc = i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`;
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(loc, { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i))));
  const cells = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-sm text-muted">{weekdays.map((w, i) => <span key={i}>{w}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} />;
          const rec = byDate.get(d);
          const closed = new Date(`${d}T00:00:00Z`).getUTCDay() === 0 || hol.has(d);
          const label = rec ? t(`status.${rec.status}`) : closed ? t('parent.holiday') : '';
          return (
            <div key={d} title={label}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg text-[15px] tabular-nums ${d === today ? 'ring-2 ring-board' : ''} ${closed ? 'text-muted/50' : 'bg-card'}`}>
              <span>{Number(d.slice(8))}</span>
              {rec && <span className={`mt-0.5 size-2 rounded-full ${STATUS_STYLE[rec.status].dot}`} aria-label={label} />}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        {['P', 'A', 'L', 'LV'].map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className={`size-2 rounded-full ${STATUS_STYLE[k].dot}`} /> {t(`status.${k}`)}</span>
        ))}
      </div>
    </div>
  );
}
