import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import kn from './kn.json';
import hi from './hi.json';

const saved = (() => { try { return localStorage.getItem('haajari.lang'); } catch { return null; } })();

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, kn: { translation: kn }, hi: { translation: hi } },
  lng: saved || 'kn', // Kannada first: most Karnataka government schools are Kannada medium
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setLanguage(lng) {
  i18n.changeLanguage(lng);
  document.documentElement.lang = lng;
  try { localStorage.setItem('haajari.lang', lng); } catch { /* private mode */ }
}
document.documentElement.lang = i18n.language;

export default i18n;
