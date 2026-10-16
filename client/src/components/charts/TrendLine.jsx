import { useRef, useState } from 'react';
import { fmtDay } from '../../lib/dates';

/** % present over the last school days: one 2px line, a threshold rule, crosshair tooltip on hover/touch. */
export default function TrendLine({ days, threshold, height = 240 }) {
  const ref = useRef(null);
  const [i, setI] = useState(null);
  if (!days.length) return null;
  const W = 600;
  const H = height;
  const pad = { l: 34, r: 8, t: 10, b: 22 };
  const lo = Math.min(60, ...days.map((d) => d.pct));
  const x = (k) => pad.l + (k / Math.max(days.length - 1, 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + ((100 - v) / (100 - lo)) * (H - pad.t - pad.b);
  const path = days.map((d, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)} ${y(d.pct).toFixed(1)}`).join('');
  const ticks = [100, Math.round((100 + lo) / 2), lo];

  const move = (e) => {
    const box = ref.current.getBoundingClientRect();
    const px = ((('touches' in e ? e.touches[0].clientX : e.clientX) - box.left) / box.width) * W;
    setI(Math.max(0, Math.min(days.length - 1, Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (days.length - 1)))));
  };
  const cur = i !== null ? days[i] : null;

  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full touch-pan-y" role="img"
        aria-label={`Attendance trend, ${days.length} school days`} onMouseMove={move} onMouseLeave={() => setI(null)} onTouchStart={move} onTouchMove={move}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">{v}</text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(threshold)} y2={y(threshold)} stroke="var(--color-absent)" strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />
        <text x={W - pad.r} y={y(threshold) - 5} textAnchor="end" fontSize="11" fill="var(--color-absent)">{threshold}%</text>
        <path d={path} fill="none" stroke="var(--color-board)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <text x={pad.l} y={H - 4} fontSize="11" fill="var(--color-muted)">{fmtDay(days[0].date)}</text>
        <text x={W - pad.r} y={H - 4} fontSize="11" fill="var(--color-muted)" textAnchor="end">{fmtDay(days.at(-1).date)}</text>
        {cur && (
          <g>
            <line x1={x(i)} x2={x(i)} y1={pad.t} y2={H - pad.b} stroke="var(--color-ink)" strokeOpacity="0.25" />
            <circle cx={x(i)} cy={y(cur.pct)} r="5" fill="var(--color-board)" stroke="var(--color-card)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {cur && (
        <div className="pointer-events-none absolute top-0 rounded-lg bg-ink px-3 py-1.5 text-sm text-chalk shadow-lift"
          style={{ left: `clamp(0px, calc(${(x(i) / W) * 100}% - 60px), calc(100% - 140px))` }}>
          <b>{fmtDay(cur.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b> · {cur.pct}%
        </div>
      )}
    </div>
  );
}
