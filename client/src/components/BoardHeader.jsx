import { useTranslation } from 'react-i18next';
import LanguageSwitch from './LanguageSwitch';

// The chalkboard panel at the top of the login and setup screens.
export default function BoardHeader({ children }) {
  const { t } = useTranslation();
  return (
    <header className="chalkboard relative overflow-hidden px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <span className="flex items-center gap-2 text-[15px] text-chalk/80">
          <img src="/icon.svg" alt="" className="size-7" />
          {t('app.tagline')}
        </span>
      </div>
      <div className="mx-auto mt-8 max-w-md">
        <p className="text-[64px] leading-none font-bold tracking-tight" lang={t('app.name') === 'Haajari' ? 'en' : undefined}>
          {t('app.name')}
        </p>
        {children}
        <div className="mt-6"><LanguageSwitch onBoard /></div>
      </div>
      {/* chalk ledge */}
      <div className="absolute inset-x-0 bottom-0 h-2 bg-[#0f2a20]" />
    </header>
  );
}
