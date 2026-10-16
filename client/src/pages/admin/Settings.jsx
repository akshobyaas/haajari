import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { Button, Card, Input, Notice, PageTitle, Skeleton } from '../../components/ui';

export default function Settings() {
  const { t } = useTranslation();
  const school = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school').then((r) => r.data.school) });
  if (school.isLoading) return <Skeleton className="h-96" />;
  if (school.error) return <Notice tone="error">{t('errors.network')}</Notice>;
  return <SettingsForm key={school.data.updatedAt} school={school.data} />;
}

function SettingsForm({ school }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const [f, setF] = useState({
    name: school.name, udiseCode: school.udiseCode || '', district: school.district || '', academicYear: school.academicYear,
    start: school.markingWindow.start, end: school.markingWindow.end,
    alertThreshold: school.alertThreshold, consecutiveAbsenceAlert: school.consecutiveAbsenceAlert,
    holidays: school.holidays || [],
  });
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => api.patch('/school', {
      name: f.name, udiseCode: f.udiseCode, district: f.district, academicYear: f.academicYear,
      markingWindow: { start: f.start, end: f.end },
      alertThreshold: Number(f.alertThreshold), consecutiveAbsenceAlert: Number(f.consecutiveAbsenceAlert),
      holidays: f.holidays.filter((h) => h.date && h.name),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['school'] }); toast(t('admin.saved')); },
    onError: (e) => setError(errorMessage(e)),
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setHoliday = (i, k, v) => setF({ ...f, holidays: f.holidays.map((h, j) => (j === i ? { ...h, [k]: v } : h)) });

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(''); save.mutate(); }} className="mx-auto max-w-2xl">
      <PageTitle title={t('nav.settings')} />
      <Card className="mb-4 space-y-4 p-5">
        <Input name="name" label={t('admin.schoolName')} value={f.name} onChange={set('name')} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input name="udiseCode" label={t('admin.udise')} value={f.udiseCode} onChange={set('udiseCode')} />
          <Input name="district" label={t('admin.district')} value={f.district} onChange={set('district')} />
          <Input name="academicYear" label={t('admin.academicYear')} value={f.academicYear} onChange={set('academicYear')} />
        </div>
      </Card>
      <Card className="mb-4 space-y-4 p-5">
        <div>
          <p className="mb-1 font-semibold">{t('admin.window')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Input name="start" type="time" aria-label="start" value={f.start} onChange={set('start')} />
            <Input name="end" type="time" aria-label="end" value={f.end} onChange={set('end')} />
          </div>
          <p className="mt-1 text-sm text-muted">{t('admin.windowHint')}</p>
        </div>
        <Input name="alertThreshold" type="number" min={0} max={100} label={t('admin.threshold')} value={f.alertThreshold} onChange={set('alertThreshold')} />
        <Input name="consecutiveAbsenceAlert" type="number" min={1} max={30} label={t('admin.consecutive')} value={f.consecutiveAbsenceAlert} onChange={set('consecutiveAbsenceAlert')} />
      </Card>
      <Card className="mb-6 p-5">
        <p className="mb-3 font-semibold">{t('admin.holidays')}</p>
        <div className="space-y-2">
          {f.holidays.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="date" value={h.date} onChange={(e) => setHoliday(i, 'date', e.target.value)} aria-label="date"
                className="min-h-12 w-40 rounded-xl border border-line px-3 outline-none focus:border-board" />
              <input value={h.name} onChange={(e) => setHoliday(i, 'name', e.target.value)} placeholder={t('admin.holidayName')} aria-label={t('admin.holidayName')}
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-line px-3 outline-none focus:border-board" />
              <button type="button" onClick={() => setF({ ...f, holidays: f.holidays.filter((_, j) => j !== i) })} aria-label={t('common.remove')} className="rounded-lg p-2 text-muted hover:text-absent">
                <Trash2 className="size-5" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setF({ ...f, holidays: [...f.holidays, { date: '', name: '' }] })} className="mt-3 inline-flex items-center gap-1 font-semibold text-board">
          <Plus className="size-4" /> {t('admin.addHoliday')}
        </button>
      </Card>
      {error && <Notice tone="error" className="mb-4">{error}</Notice>}
      <Button type="submit" loading={save.isPending} className="w-full sm:w-auto">{t('common.save')}</Button>
    </form>
  );
}
