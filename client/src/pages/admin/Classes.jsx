import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { GRADES, gradeLabel, firstName } from '../../lib/format';
import ClassSlate from '../../components/ClassSlate';
import Sheet from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { Button, Select, Input, Notice, PageTitle, Skeleton } from '../../components/ui';

export default function Classes() {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(null); // null | {} (new) | class
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes').then((r) => r.data.classes) });

  return (
    <div>
      <PageTitle title={t('nav.classes')} action={<Button onClick={() => setEditing({})}><Plus className="size-5" /> {t('admin.addClass')}</Button>} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {classes.isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[4/3]" />)}
        {classes.data?.map((c) => (
          <ClassSlate key={c._id} cls={c} caption={c.classTeacherId ? firstName(c.classTeacherId.name) : t('admin.noTeacher')} onClick={() => setEditing(c)} />
        ))}
      </div>
      <ClassForm cls={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ClassForm({ cls, onClose }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const isNew = cls && !cls._id;
  const teachers = useQuery({ queryKey: ['users', 'teacher'], queryFn: () => api.get('/users', { params: { role: 'teacher' } }).then((r) => r.data.users), enabled: Boolean(cls) });
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const key = cls?._id || 'new';
  const [formKey, setFormKey] = useState(null);
  if (cls && formKey !== key) {
    setFormKey(key);
    setForm({ grade: cls.grade || '1', section: cls.section || 'A', medium: cls.medium || 'kannada', classTeacherId: cls.classTeacherId?._id || '', mode: cls.mode || '' });
    setError('');
  }

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, classTeacherId: form.classTeacherId || null };
      if (!body.mode) delete body.mode;
      return isNew ? api.post('/classes', body) : api.patch(`/classes/${cls._id}`, body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['classes'] }); qc.invalidateQueries({ queryKey: ['summary'] }); toast(t('admin.saved')); onClose(); },
    onError: (e) => setError(errorMessage(e)),
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <Sheet open={Boolean(cls)} onClose={onClose} title={t(isNew ? 'admin.addClass' : 'admin.editClass')}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select name="grade" label={t('admin.gradeLabel')} value={form.grade} onChange={set('grade')} disabled={!isNew}>
            {GRADES.map((g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}
          </Select>
          <Input name="section" label={t('admin.section')} value={form.section || ''} maxLength={3} onChange={(e) => setForm({ ...form, section: e.target.value.toUpperCase() })} />
        </div>
        <Select name="medium" label={t('admin.medium')} value={form.medium} onChange={set('medium')}>
          {['kannada', 'english', 'urdu'].map((m) => <option key={m} value={m}>{t(`admin.mediums.${m}`)}</option>)}
        </Select>
        <Select name="classTeacherId" label={t('admin.classTeacher')} value={form.classTeacherId} onChange={set('classTeacherId')}>
          <option value="">{t('admin.noTeacher')}</option>
          {teachers.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
        <Select name="mode" label={t('admin.markingMode')} value={form.mode} onChange={set('mode')}>
          {isNew && <option value="">—</option>}
          {['checkin', 'daily', 'period'].map((m) => <option key={m} value={m}>{t(`mode.${m}`)}</option>)}
        </Select>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="quiet" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
          <Button type="submit" loading={save.isPending} className="flex-1">{t('common.save')}</Button>
        </div>
      </form>
    </Sheet>
  );
}
