import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gradeShort } from '../../lib/format';

/**
 * Today's % present per class as horizontal bars. One series, one hue (board green);
 * classes below the school threshold switch to the absent red and carry a text label,
 * so the meaning is never colour alone. Unmarked classes show an empty track.
 */
export default function ClassBars({ classes, threshold }) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(null);
  return (
    <div role="table" aria-label={t('dash.classesToday')} className="space-y-1.5">
      {classes.map((c) => {
        const low = c.pct !== null && c.pct < threshold;
        const label = `${gradeShort(c.grade)} ${c.section}`;
        return (
          <div key={c._id} role="row" className="relative grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-2"
            onMouseEnter={() => setHover(c._id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(c._id)} onBlur={() => setHover(null)} tabIndex={0}>
            <span role="rowheader" className="truncate text-[15px] font-semibold">{label}</span>
            <span role="cell" className="relative h-5 rounded bg-line/45">
              {c.pct !== null && (
                <span className={`absolute inset-y-0 left-0 rounded ${low ? 'bg-absent' : 'bg-board'}`} style={{ width: `${Math.max(c.pct, 2)}%` }} />
              )}
              {/* threshold rule */}
              <span className="absolute inset-y-[-3px] w-0.5 rounded bg-ink/35" style={{ left: `${threshold}%` }} aria-hidden />
            </span>
            <span role="cell" className={`text-right text-[15px] tabular-nums ${low ? 'font-bold text-absent' : 'text-ink'}`}>
              {c.pct === null ? <span className="text-sm text-muted">—</span> : `${Math.round(c.pct)}%`}
            </span>
            {hover === c._id && (
              <span className="pointer-events-none absolute top-full left-20 z-10 mt-1 rounded-lg bg-ink px-3 py-1.5 text-sm whitespace-nowrap text-chalk shadow-lift">
                {c.marked ? `${c.present} ${t('dash.present')} · ${c.A} ${t('dash.absent')}${c.LV ? ` · ${c.LV} ${t('status.LV')}` : ''}` : t('dash.notTaken')}
                {low && ` · ${t('dash.belowLine', { n: threshold })}`}
              </span>
            )}
          </div>
        );
      })}
      <p className="pt-1 text-sm text-muted"><span className="mr-1 inline-block h-3 w-0.5 translate-y-0.5 bg-ink/35" /> {threshold}%</p>
    </div>
  );
}
