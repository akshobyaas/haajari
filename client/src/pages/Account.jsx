import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db, clearOfflineData } from '../offline/db';
import { syncNow } from '../offline/sync';
import { useNavigate } from 'react-router-dom';
import { LogOut, LayoutGrid, GraduationCap, Users, Settings, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { prettyPhone } from '../lib/format';
import { Card, Button, PageTitle, Notice } from '../components/ui';
import LanguageSwitch from '../components/LanguageSwitch';
import Avatar from '../components/Avatar';

export default function Account() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [blocked, setBlocked] = useState(false);
  // Never throw away marks that exist only on this phone.
  const logOut = async () => {
    await syncNow();
    if ((await db.marks.where('synced').equals(0).count()) > 0) { setBlocked(true); return; }
    await clearOfflineData();
    logout();
    qc.clear();
    navigate('/login', { replace: true });
  };
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title={t('nav.account')} />
      <Card className="mb-4 flex items-center gap-4 p-5">
        <Avatar name={user.name} size={56} />
        <div>
          <p className="text-xl font-bold">{user.name}</p>
          <p className="text-muted">{user.phone ? prettyPhone(user.phone) : user.email}</p>
        </div>
      </Card>
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <span className="font-semibold">{t('lang.choose')}</span>
        <LanguageSwitch />
      </Card>
      {user.role === 'admin' && (
        // On phones the bottom bar has room for five; the rest of the office tools live here.
        <Card className="mb-6 divide-y divide-line/70 lg:hidden">
          {[['/a/classes', LayoutGrid, 'classes'], ['/a/students', GraduationCap, 'students'], ['/a/teachers', Users, 'teachers'], ['/a/settings', Settings, 'settings']].map(([to, Icon, key]) => (
            <Link key={to} to={to} className="flex items-center gap-3 px-5 py-3.5 font-semibold">
              <Icon className="size-5 text-board" /> <span className="flex-1">{t(`nav.${key}`)}</span> <ChevronRight className="size-4 text-muted" />
            </Link>
          ))}
        </Card>
      )}
      {blocked && <Notice tone="warn" className="mb-4">{t('account.unsynced')}</Notice>}
      <Button variant="quiet" className="w-full" onClick={logOut}>
        <LogOut className="size-5" /> {t('common.logOut')}
      </Button>
    </div>
  );
}
