import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, Skeleton, PageTitle, Notice } from '../../components/ui';

export default function Dashboard() {
  const { t } = useTranslation();
  const school = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school').then((r) => r.data.school) });
  const { data: s, isLoading, error } = useQuery({ queryKey: ['summary'], queryFn: () => api.get('/dashboard/summary').then((r) => r.data) });

  const checks = s
    ? [
        { n: s.classesWithoutTeacher, label: t('admin.checkTeacher', { count: s.classesWithoutTeacher }), to: '/a/classes' },
        { n: s.studentsWithoutSats, label: t('admin.checkSats', { count: s.studentsWithoutSats }), to: '/a/students' },
        { n: s.studentsWithoutParent, label: t('admin.checkParent', { count: s.studentsWithoutParent }), to: '/a/students' },
      ].filter((c) => c.n > 0)
    : [];

  return (
    <div>
      <PageTitle title={school.data?.name || ' '} sub={school.data && `${school.data.district} · ${school.data.academicYear}`} />
      {error && <Notice tone="error">{t('errors.network')}</Notice>}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        {s && [
          [t('admin.statStudents'), s.students],
          [t('admin.statClasses'), s.classes],
          [t('admin.statTeachers'), s.teachers],
          [t('admin.statParents'), s.parents],
        ].map(([label, n]) => (
          <Card key={label} className="p-4">
            <p className="text-[36px] leading-none font-bold text-board">{n}</p>
            <p className="mt-1 text-muted">{label}</p>
          </Card>
        ))}
      </div>
      <h2 className="text-lg font-semibold">{t('admin.setupTitle')}</h2>
      <p className="mb-3 text-muted">{t('admin.setupIntro')}</p>
      {s && (
        <Card className="divide-y divide-line/70">
          {checks.length === 0 && (
            <p className="flex items-center gap-3 p-4 font-semibold text-present"><CheckCircle2 className="size-5" /> {t('admin.allGood')}</p>
          )}
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-3 p-4">
              <AlertCircle className="size-5 shrink-0 text-late" />
              <span className="flex-1">{c.label}</span>
              <Link to={c.to} className="rounded-lg px-3 py-1.5 font-semibold text-board hover:bg-board/8">{t('admin.fix')}</Link>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
