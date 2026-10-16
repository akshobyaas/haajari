import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db, clearOfflineData } from '../offline/db';
import { syncNow } from '../offline/sync';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
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
      {blocked && <Notice tone="warn" className="mb-4">{t('account.unsynced')}</Notice>}
      <Button variant="quiet" className="w-full" onClick={logOut}>
        <LogOut className="size-5" /> {t('common.logOut')}
      </Button>
    </div>
  );
}
