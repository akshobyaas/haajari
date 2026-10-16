import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, LayoutGrid, Users, GraduationCap, Settings, CircleUser, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { Notice } from './ui';

const NAV = {
  admin: [
    { to: '/a', icon: Home, key: 'home', end: true },
    { to: '/a/classes', icon: LayoutGrid, key: 'classes' },
    { to: '/a/students', icon: GraduationCap, key: 'students' },
    { to: '/a/teachers', icon: Users, key: 'teachers' },
    { to: '/a/settings', icon: Settings, key: 'settings' },
  ],
  teacher: [
    { to: '/t', icon: Home, key: 'home', end: true },
    { to: '/account', icon: CircleUser, key: 'account' },
  ],
  parent: [
    { to: '/p', icon: Home, key: 'home', end: true },
    { to: '/account', icon: CircleUser, key: 'account' },
  ],
};

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export default function AppShell() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const online = useOnline();
  const items = NAV[user.role];
  const admin = user.role === 'admin';
  // Admin gets Account in the sidebar too.
  const sideItems = admin ? [...items, { to: '/account', icon: CircleUser, key: 'account' }] : items;

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar: desktop */}
      <aside className="chalkboard sticky top-0 hidden h-dvh w-64 shrink-0 flex-col px-4 py-6 lg:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <img src="/icon.svg" alt="" className="size-8" />
          <span className="text-2xl font-bold">{t('app.name')}</span>
        </div>
        <nav className="flex flex-col gap-1">
          {sideItems.map(({ to, icon: Icon, key, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition ${isActive ? 'bg-chalk text-board' : 'text-chalk/80 hover:bg-white/10'}`}>
              <Icon className="size-5" aria-hidden /> {t(`nav.${key}`)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {!online && (
          <div className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-ink px-4 py-2 text-sm text-chalk">
            <WifiOff className="size-4" /> {t('common.offline')}
          </div>
        )}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28 lg:px-8 lg:pt-8 lg:pb-12">
          <Outlet />
        </main>
      </div>

      {/* Bottom bar: phones and tablets */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md justify-around">
          {(admin ? items.slice(0, 4).concat({ to: '/account', icon: CircleUser, key: 'account' }) : items).map(({ to, icon: Icon, key, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold ${isActive ? 'text-board' : 'text-muted'}`}>
              {({ isActive }) => (
                <>
                  <span className={`rounded-full px-4 py-1 transition ${isActive ? 'bg-board/10' : ''}`}><Icon className="size-6" aria-hidden /></span>
                  {t(`nav.${key}`)}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
