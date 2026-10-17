import { useTranslation } from 'react-i18next';
import LanguageSwitch from './LanguageSwitch';

// The teal panel at the top of the login and setup screens, with the lime squiggle from the palette poster.
export default function BoardHeader({ children }) {
  const { t } = useTranslation();
  return (
    <header className="chalkboard relative overflow-hidden px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <span className="relative flex items-center gap-2 text-[15px] font-semibold text-chalk/80">
          <img src="/icon.svg" alt="" className="size-7" />
          {t('app.tagline')}
        </span>
      </div>
      <Squiggle />
      <div className="relative mx-auto mt-8 max-w-md">
        <p className="text-[64px] leading-none font-extrabold tracking-tight" lang={t('app.name') === 'Haajari' ? 'en' : undefined}>
          {t('app.name')}
        </p>
        {children}
        <div className="mt-6"><LanguageSwitch onBoard /></div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-2 bg-accent" />
    </header>
  );
}

function Squiggle() {
  return (
    <svg aria-hidden="true" viewBox="0 0 300 260" fill="none"
      className="pointer-events-none absolute -right-32 -bottom-14 w-72 opacity-95 sm:right-[max(0px,calc(50%-26rem))]">
      <path d="M30 40c60-30 90 40 60 80s-50 90 10 100 70-60 110-70 70 40 60 90"
        stroke="var(--color-accent)" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
