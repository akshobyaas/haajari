import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, Link } from 'react-router-dom';
import { CalendarOff, ChevronRight, HeartHandshake, FileSpreadsheet } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth';
import { firstName } from '../../lib/format';
import { db } from '../../offline/db';
import { loadClasses, prefetchRosters } from '../../offline/roster';
import ClassSlate from '../../components/ClassSlate';
import SyncBar from '../../components/SyncBar';
import { Skeleton, Notice } from '../../components/ui';

export default function TeacherHome() {
  const { t, i18n } = useTranslation();
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['classes'], queryFn: loadClasses });
  const leave = useQuery({ queryKey: ['leave'], queryFn: () => api.get('/leave', { params: { status: 'pending' } }).then((r) => r.data.leaves) });
  const pendingLeave = (leave.data || []).filter((l) => l.status === 'pending').length;
  const risk = useQuery({ queryKey: ['risk'], queryFn: () => api.get('/risk').then((r) => r.data.flags) });
  const onPhone = useLiveQuery(
    () => (data?.date ? db.marks.where('synced').equals(0).filter((m) => m.date === data.date).toArray() : []),
    [data?.date],
    []
  );

  // Download every class list now, so marking works later even with no network.
  useEffect(() => {
    if (data && !data.fromCache) prefetchRosters(data.classes.map((c) => c._id));
  }, [data]);

  const today = new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  const caption = (c) => {
    if (onPhone.some((m) => m.classId === c._id)) return t('home.onPhone');
    if (c.today) return t('home.marked', { present: c.today.P + c.today.L, absent: c.today.A });
    return t('home.notMarked');
  };
  const roleOf = (c) => {
    if (String(c.classTeacherId?._id ?? c.classTeacherId) === String(user.id)) return t('teacher.classTeacher');
    const s = user.subjects?.find((x) => String(x.classId) === String(c._id));
    return s ? t('teacher.subject', { subject: s.subject }) : '';
  };

  return (
    <div>
      <p className="text-muted">{today}</p>
      <h1 className="mb-5 text-[28px] font-bold leading-tight">{t('teacher.greeting', { name: firstName(user.name) })}</h1>
      <SyncBar />
      {pendingLeave > 0 && (
        <Link to="/t/leave" className="mb-4 flex items-center gap-3 rounded-2xl border border-late/40 bg-late/10 px-4 py-3">
          <CalendarOff className="size-5 text-late" />
          <span className="flex-1 font-semibold">{t('leaveInbox.waiting', { count: pendingLeave })}</span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
      )}
      {data?.closed && <Notice tone="info" className="mb-4">{t('home.closedToday', { reason: data.closed })}</Notice>}
      <h2 className="mb-3 text-lg font-semibold">{t('teacher.yourClasses')}</h2>
      {error && <Notice tone="error">{t('errors.network')}</Notice>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && [0, 1].map((i) => <Skeleton key={i} className="aspect-[4/3]" />)}
        {data?.classes.map((c) => (
          <ClassSlate key={c._id} cls={c} role={roleOf(c)} caption={caption(c)} done={Boolean(c.today)} onClick={() => navigate(`/t/class/${c._id}/${c.mode === 'checkin' ? 'pickup' : 'mark'}`)} />
        ))}
      </div>
      {data?.classes.length === 0 && <Notice tone="info">{t('teacher.noClasses')}</Notice>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {risk.data?.length > 0 && (
          <Link to="/t/at-risk" className="flex items-center gap-3 rounded-2xl border border-absent/30 bg-absent/5 px-4 py-3">
            <HeartHandshake className="size-5 text-absent" />
            <span className="flex-1 font-semibold">{t('dash.followUpCount', { count: risk.data.length })}</span>
            <ChevronRight className="size-4 text-muted" />
          </Link>
        )}
        <Link to="/t/reports" className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
          <FileSpreadsheet className="size-5 text-board" />
          <span className="flex-1 font-semibold">{t('reports.register')}</span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
      </div>
    </div>
  );
}
