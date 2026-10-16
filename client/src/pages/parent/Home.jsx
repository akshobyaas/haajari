import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Phone, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { classLabel, firstName, prettyPhone } from '../../lib/format';
import { Card, Skeleton, Notice } from '../../components/ui';
import Avatar from '../../components/Avatar';

export default function ParentHome() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const { data, isLoading, error } = useQuery({ queryKey: ['children'], queryFn: () => api.get('/me/children').then((r) => r.data.children) });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-[28px] font-bold leading-tight">{t('parent.greeting', { name: firstName(user.name) })}</h1>
      <h2 className="mb-3 text-lg font-semibold">{t('parent.children')}</h2>
      {error && <Notice tone="error">{t('errors.network')}</Notice>}
      {isLoading && <Skeleton className="h-56" />}
      {data?.length === 0 && <Notice tone="info">{t('parent.noChildren')}</Notice>}
      <div className="space-y-4">
        {data?.map((c) => {
          const teacher = c.classId?.classTeacherId;
          return (
            <Card key={c._id} className="overflow-hidden">
              <div className="chalkboard flex items-center gap-4 p-5">
                <Avatar name={c.name} size={56} />
                <div>
                  <p className="text-2xl font-bold leading-tight">{c.name}</p>
                  <p className="text-chalk/80">{classLabel(c.classId)} · {t('teacher.roll', { n: c.rollNo })}</p>
                </div>
              </div>
              <dl className="divide-y divide-line/70">
                {teacher && (
                  <div className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <dt className="text-sm text-muted">{t('parent.classTeacher')}</dt>
                      <dd className="font-semibold">{teacher.name}</dd>
                    </div>
                    <a href={`tel:${teacher.phone}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 font-semibold text-board">
                      <Phone className="size-4" /> {t('common.call')}
                    </a>
                  </div>
                )}
                <div className="px-5 py-3">
                  <dt className="mb-1 flex items-center gap-1 text-sm text-muted"><ShieldCheck className="size-4" /> {t('parent.pickup')}</dt>
                  <dd className="flex flex-wrap gap-2">
                    {c.pickupGuardians?.length ? c.pickupGuardians.map((g) => (
                      <span key={g._id} className="rounded-full bg-paper px-3 py-1 text-[15px]">{g.name} · {g.relation}{g.phone ? ` · ${prettyPhone(g.phone)}` : ''}</span>
                    )) : t('common.none')}
                  </dd>
                </div>
                <div className="flex gap-8 px-5 py-3 text-[15px]">
                  <div><dt className="text-sm text-muted">{t('parent.admissionNo')}</dt><dd>{c.admissionNo}</dd></div>
                </div>
              </dl>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
