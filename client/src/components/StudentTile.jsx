import { useRef } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { CloudUpload, Check, MessageCircle } from 'lucide-react';
import { STATUS_STYLE } from '../lib/status';

/**
 * One child on the marking grid. Tap cycles the status; press and hold opens the change log.
 * sync: 'draft' (changed, not saved), 'phone' (saved on phone only), 'server' (on the server), null (never saved)
 */
export default function StudentTile({ student, status, sync, note, onTap, onHold, disabled }) {
  const { t } = useTranslation();
  const s = STATUS_STYLE[status];
  const timer = useRef(null);
  const held = useRef(false);
  const first = student.name.split(' ')[0];

  const down = () => {
    held.current = false;
    timer.current = setTimeout(() => { held.current = true; navigator.vibrate?.(20); onHold?.(); }, 550);
  };
  const up = () => clearTimeout(timer.current);
  const click = () => {
    if (held.current || disabled) return;
    navigator.vibrate?.(8);
    onTap();
  };

  return (
    <motion.button
      type="button"
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onContextMenu={(e) => e.preventDefault()}
      onClick={click}
      whileTap={{ scale: 0.94 }}
      aria-label={`${student.rollNo}. ${student.name}: ${t(`status.${status}`)}`}
      aria-pressed={status !== 'P'}
      className={`relative flex min-h-[84px] touch-manipulation flex-col justify-between rounded-2xl border-2 p-2.5 text-left transition-colors duration-150 select-none ${s.card} ${disabled ? 'opacity-60' : ''}`}
    >
      <span className="flex items-start justify-between gap-1">
        <span className="text-[26px] leading-none font-bold tabular-nums">{student.rollNo}</span>
        <SyncMark sync={sync} onDark={status === 'A'} />
      </span>
      <span className="truncate text-[15px] leading-tight font-semibold">{first}</span>
      <span className={`mt-1 self-start rounded-full px-2 text-[12px] leading-5 font-semibold ${s.chip}`}>{t(`status.${status}`)}</span>
      {/* What the parent said, e.g. "Sick" */}
      {note && <span className="mt-1 flex items-center gap-1 truncate text-[12px] leading-tight font-semibold opacity-95"><MessageCircle className="size-3 shrink-0" aria-label="Parent" />{note}</span>}
    </motion.button>
  );
}

function SyncMark({ sync, onDark }) {
  if (sync === 'draft') return <span className={`mt-1 size-2.5 rounded-full ${onDark ? 'bg-white' : 'bg-ink'}`} title="Not saved" />;
  if (sync === 'phone') return <CloudUpload className={`size-4 ${onDark ? 'text-white/80' : 'text-muted'}`} aria-label="Saved on phone" />;
  if (sync === 'server') return <Check className={`size-4 ${onDark ? 'text-white/90' : 'text-present'}`} strokeWidth={3} aria-label="Sent" />;
  return null;
}
