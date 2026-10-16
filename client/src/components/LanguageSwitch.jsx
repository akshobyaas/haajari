import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function LanguageSwitch({ onBoard = false }) {
  const { i18n, t } = useTranslation();
  const { token, setUser } = useAuth();
  const choose = async (lng) => {
    setLanguage(lng);
    if (token) {
      try { const r = await api.patch('/auth/me', { language: lng }); setUser(r.data.user); } catch { /* keep local choice */ }
    }
  };
  return (
    <div role="radiogroup" aria-label={t('lang.choose')} className={`inline-flex rounded-full p-1 ${onBoard ? 'bg-black/20' : 'bg-line/50'}`}>
      {['kn', 'en', 'hi'].map((l) => {
        const on = i18n.language === l;
        return (
          <button
            key={l}
            role="radio"
            aria-checked={on}
            onClick={() => choose(l)}
            className={`rounded-full px-3 py-1 text-[15px] font-semibold transition ${
              on ? (onBoard ? 'bg-chalk text-slate' : 'bg-card text-board-text shadow-sm') : onBoard ? 'text-chalk/80' : 'text-muted'
            }`}
          >
            {t(`lang.${l}`)}
          </button>
        );
      })}
    </div>
  );
}
