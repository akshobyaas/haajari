import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudUpload, Check, MessageCircle } from 'lucide-react';

/**
 * One child on the marking screen: roll number and name, then one button per status
 * (Present, Absent, Late, Leave), so any status is one tap and the current one is always visible.
 * Press and hold the name to open the change log.
 * sync: 'draft' (changed, not saved), 'phone' (saved on phone only), 'server' (on the server), null (never saved)
 */
export const ROW_STATUSES = ['P', 'A', 'L', 'LV'];

// Selected button per status; the unselected ones stay quiet so the absentees stand out.
const ON = {
  P: 'bg-present/12 text-present border-present/50',
  A: 'bg-absent-strong text-white border-absent-strong',
  L: 'bg-late text-on-brand border-late',
  LV: 'bg-leave text-on-leave border-leave',
};
// A coloured edge on the row so a teacher scanning the list spots the absentees at once.
const EDGE = { P: 'border-l-transparent', A: 'border-l-absent bg-absent/5', L: 'border-l-late bg-late/5', LV: 'border-l-leave bg-leave/5' };

export default function StudentRow({ student, status, sync, note, onChange, onHold, disabled }) {
  const { t } = useTranslation();
  const timer = useRef(null);
  const down = () => { timer.current = setTimeout(() => { navigator.vibrate?.(20); onHold?.(); }, 550); };
  const up = () => clearTimeout(timer.current);

  return (
    <li className={`flex items-center gap-2 border-l-4 py-2 pr-2 pl-2 ${EDGE[status]} ${disabled ? 'opacity-60' : ''}`}>
      <div
        className="flex min-w-0 flex-1 touch-manipulation items-center gap-2 select-none"
        onPointerDown={down} onPointerUp={up} onPointerLeave={up} onContextMenu={(e) => e.preventDefault()}
      >
        <span className="w-7 shrink-0 text-right text-[20px] leading-none font-bold tabular-nums">{student.rollNo}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-1">
            <span className="truncate text-[15px] leading-tight font-semibold">{student.name}</span>
            <SyncMark sync={sync} />
          </span>
          {/* What the parent said, e.g. "Sick" */}
          {note && (
            <span className="mt-0.5 flex items-center gap-1 truncate text-[12px] leading-tight font-semibold text-board-text">
              <MessageCircle className="size-3 shrink-0" aria-label="Parent" />{note}
            </span>
          )}
        </span>
      </div>

      <div role="radiogroup" aria-label={`${student.rollNo}. ${student.name}`} className="grid shrink-0 grid-cols-4 gap-1">
        {ROW_STATUSES.map((s) => {
          const on = status === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={t(`status.${s}`)}
              title={t(`status.${s}`)}
              disabled={disabled}
              onClick={() => { if (!on) { navigator.vibrate?.(8); onChange(s); } }}
              className={`size-12 touch-manipulation rounded-xl border-2 text-[17px] leading-tight font-bold transition-colors duration-100 active:scale-95 ${
                on ? ON[s] : 'border-line bg-card text-muted hover:border-muted/50'
              }`}
            >
              {t(`statusShort.${s}`)}
            </button>
          );
        })}
      </div>
    </li>
  );
}

function SyncMark({ sync }) {
  if (sync === 'draft') return <span className="size-2 shrink-0 rounded-full bg-ink" title="Not saved" />;
  if (sync === 'phone') return <CloudUpload className="size-4 shrink-0 text-muted" aria-label="Saved on phone" />;
  if (sync === 'server') return <Check className="size-4 shrink-0 text-present" strokeWidth={3} aria-label="Sent" />;
  return null;
}
