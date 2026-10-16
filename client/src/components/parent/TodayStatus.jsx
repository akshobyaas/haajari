import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Clock, CalendarOff, HelpCircle, Home } from 'lucide-react';
import { fmtTime } from '../../lib/dates';

const LOOK = {
  P: ['bg-present/12 text-present', CheckCircle2, 'parent.todayP'],
  L: ['bg-late/15 text-late-ink', Clock, 'parent.todayL'],
  A: ['bg-absent/10 text-absent', XCircle, 'parent.todayA'],
  LV: ['bg-leave/10 text-leave', CalendarOff, 'parent.todayLV'],
  none: ['bg-paper text-muted', HelpCircle, 'parent.todayNone'],
};

export default function TodayStatus({ mark, pickup }) {
  const { t } = useTranslation();
  if (pickup?.checkOutAt) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-leave/10 px-3 py-2 font-semibold text-leave">
        <Home className="size-5" /> {t('parent.pickedUp', { name: pickup.collectedBy?.name, time: fmtTime(pickup.checkOutAt) })}
      </p>
    );
  }
  const [cls, Icon, key] = LOOK[mark?.status || 'none'];
  return (
    <p className={`flex items-center gap-2 rounded-xl px-3 py-2 text-lg font-semibold ${cls}`}>
      <Icon className="size-6" /> {t(key)}
    </p>
  );
}
