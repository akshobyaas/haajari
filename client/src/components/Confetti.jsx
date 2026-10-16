import { useEffect, useRef } from 'react';

/**
 * A short burst of chalk-coloured paper when a whole class is present.
 * One orchestrated moment, 1.6 s, skipped entirely for people who turn off motion.
 */
export default function Confetti({ fire }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!fire || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#d0ff00', '#ffffff', '#101414', '#d0ff00', '#ffffff'];
    const bits = Array.from({ length: 90 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: innerHeight * 0.32,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 11 - 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const start = performance.now();
    let id;
    const frame = (now) => {
      const t = now - start;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.globalAlpha = Math.max(0, 1 - t / 1600);
      bits.forEach((b) => {
        b.vy += 0.35; b.x += b.vx; b.y += b.vy; b.r += b.vr;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
      });
      if (t < 1600) id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [fire]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />;
}
