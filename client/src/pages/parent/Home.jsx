import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, QrCode, CalendarDays, ChevronRight } from 'lucide-react';
import { useAuth } from '../../stores/auth';
import { classLabel, firstName } from '../../lib/format';
import { reasonText } from '../../lib/dates';
import { Card, Skeleton, Notice } from '../../components/ui';
import Avatar from '../../components/ui/Avatar';
import TodayStatus from '../../components/parent/TodayStatus';
import ReasonButtons from '../../components/parent/ReasonButtons';
import AlertsPrompt from '../../components/parent/AlertsPrompt';
import PassSheet from '../../components/parent/PassSheet';
import { live } from '../../stores/dataSaver';
import { childrenQuery } from '../../api/parents';

export default function ParentHome() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const [passFor, setPassFor] = useState(null);
  const { data, isLoading, error } = useQuery({
    ...childrenQuery(),
    refetchInterval: () => live(60_000),
  });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-5 text-[28px] font-bold leading-tight">{t('parent.greeting', { name: firstName(user.name) })}</h1>
      <AlertsPrompt />
      {error && <Notice tone="error">{t('errors.network')}</Notice>}
      {isLoading && <Skeleton className="h-56" />}
      {data?.length === 0 && <Notice tone="info">{t('parent.noChildren')}</Notice>}
      <div className="space-y-4">
        {data?.map((c) => {
          const teacher = c.classId?.classTeacherId;
          const mark = c.today?.mark;
          const prePrimary = c.classId?.mode === 'checkin';
          return (
            <Card key={c._id} className="overflow-hidden">
              <div className="chalkboard flex items-center gap-4 p-5">
                <Avatar name={c.name} size={56} />
                <div className="min-w-0">
                  <p className="truncate text-2xl font-bold leading-tight">{c.name}</p>
                  <p className="text-chalk/80">{classLabel(c.classId)} · {t('teacher.roll', { n: c.rollNo })}</p>
                </div>
              </div>
              <div className="space-y-4 p-4">
                <TodayStatus mark={mark} pickup={c.today?.pickup} />
                {mark?.status === 'A' && (mark.reasonBy === 'parent'
                  ? <p className="text-[15px] text-muted">{t('reason.given', { reason: reasonText(t, mark.reason) })}</p>
                  : <ReasonButtons attendanceId={mark._id} name={firstName(c.name)} />)}
                <div className="flex flex-wrap gap-2">
                  <Link to={`/p/child/${c._id}`} className="inline-flex min-h-11 flex-1 items-center justify-between gap-2 rounded-xl border border-line px-4 font-semibold text-board-text hover:border-board">
                    <span className="inline-flex items-center gap-2"><CalendarDays className="size-5" /> {t('parent.viewAttendance')}</span>
                    <ChevronRight className="size-4" />
                  </Link>
                  {prePrimary && (
                    <button onClick={() => setPassFor(c)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-board px-4 font-semibold text-chalk">
                      <QrCode className="size-5" /> {t('parent.pickupPass')}
                    </button>
                  )}
                </div>
                {teacher && (
                  <div className="flex items-center justify-between gap-3 border-t border-line/70 pt-3">
                    <div>
                      <p className="text-sm text-muted">{t('parent.classTeacher')}</p>
                      <p className="font-semibold">{teacher.name}</p>
                    </div>
                    <a href={`tel:${teacher.phone}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 font-semibold text-board-text">
                      <Phone className="size-4" /> {t('common.call')}
                    </a>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {passFor && <PassSheet open onClose={() => setPassFor(null)} student={passFor} />}
    </div>
  );
}
