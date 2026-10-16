import { useEffect } from 'react';
import { motion, useAnimationControls } from 'motion/react';
import { Delete } from 'lucide-react';

/**
 * Big-key number pad. Designed for older teachers and first-time smartphone
 * users: 64px keys, no tiny text field, physical keyboard also works.
 */
export default function PinPad({ length = 4, value, onChange, onComplete, error, disabled, label }) {
  const shake = useAnimationControls();

  useEffect(() => {
    if (error) shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.35 } });
  }, [error, shake]);

  const press = (d) => {
    if (disabled || value.length >= length) return;
    const next = value + d;
    onChange(next);
    if (navigator.vibrate) navigator.vibrate(8);
    if (next.length === length) onComplete?.(next);
  };
  const back = () => !disabled && onChange(value.slice(0, -1));

  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="mx-auto w-full max-w-xs select-none">
      <motion.div animate={shake} className="mb-6 flex justify-center gap-4" role="status" aria-label={label}>
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className={`size-4 rounded-full border-2 transition-all duration-150 ${
              i < value.length ? (error ? 'scale-110 border-absent bg-absent' : 'scale-110 border-board bg-board') : 'border-muted/50'
            }`}
          />
        ))}
      </motion.div>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} onClick={() => press(d)} disabled={disabled}>{d}</Key>
        ))}
        <span />
        <Key onClick={() => press('0')} disabled={disabled}>0</Key>
        <Key onClick={back} disabled={disabled} aria-label="Delete" quiet>
          <Delete className="size-6" />
        </Key>
      </div>
    </div>
  );
}

function Key({ children, quiet, ...props }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      {...props}
      className={`flex h-16 items-center justify-center rounded-2xl text-[26px] font-semibold transition-colors disabled:opacity-40 ${
        quiet ? 'text-muted hover:bg-line/40' : 'bg-card text-ink shadow-lift hover:bg-line/40'
      }`}
    >
      {children}
    </motion.button>
  );
}
