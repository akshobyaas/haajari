// Initial-based avatar. Photos come later and only with parent consent.
const TINTS = ['#e3efe8', '#fbeed2', '#e6ecf8', '#f6e3e1', '#ece6f5'];
export default function Avatar({ name = '', size = 40 }) {
  const initial = name.trim().charAt(0).toUpperCase();
  const tint = TINTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-board-text"
      style={{ width: size, height: size, background: tint, fontSize: size * 0.45 }}>
      {initial}
    </span>
  );
}
