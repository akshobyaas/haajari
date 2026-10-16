import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import kn from './kn.json';

// Kannada ships with the app (it is the default, so no extra request before the first paint);
// English and Hindi download only if someone uses them.
const LOADERS = { kn: async () => kn, en: () => import('./en.json'), hi: () => import('./hi.json') };

const saved = (() => { try { return localStorage.getItem('haajari.lang'); } catch { return null; } })();
export const initialLanguage = LOADERS[saved] ? saved : 'kn'; // Kannada first: most Karnataka government schools are Kannada medium

export async function ensureLanguage(lng) {
  if (!i18n.hasResourceBundle(lng, 'translation')) {
    const mod = await LOADERS[lng]();
    i18n.addResourceBundle(lng, 'translation', mod.default || mod, true, true);
  }
}

i18n.use(initReactI18next).init({
  resources: { kn: { translation: kn } },
  lng: initialLanguage,
  fallbackLng: false,
  interpolation: { escapeValue: false },
});

export async function setLanguage(lng) {
  await ensureLanguage(lng);
  await i18n.changeLanguage(lng);
  document.documentElement.lang = lng;
  try { localStorage.setItem('haajari.lang', lng); } catch { /* private mode */ }
}
document.documentElement.lang = initialLanguage;

export default i18n;
