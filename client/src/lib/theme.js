// Light, dark, or follow the phone. Stored per device; the CSS does the rest (see index.css).
const KEY = 'haajari.theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

export const getTheme = () => { try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; } };

function apply(choice) {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  const dark = choice === 'dark' || (choice === 'system' && media.matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#173a2e' : '#1E4A3B');
}

export function setTheme(choice) {
  try { localStorage.setItem(KEY, choice); } catch { /* private mode */ }
  apply(choice);
}

apply(getTheme());
media.addEventListener?.('change', () => apply(getTheme()));
