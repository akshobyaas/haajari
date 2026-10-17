import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, KeyRound } from 'lucide-react';
import { errorMessage } from '../../api/client';
import { prettyPhone } from '../../lib/format';
import Avatar from '../../components/ui/Avatar';
import Sheet from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { Button, Card, Input, Notice, PageTitle, Skeleton } from '../../components/ui';
import { usersApi, teachersQuery } from '../../api/users';
import { keys } from '../../api/keys';

export default function Teachers() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const [adding, setAdding] = useState(false);
  const teachers = useQuery(teachersQuery());
  const reset = useMutation({
    mutationFn: (id) => usersApi.resetPin(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.users }); toast(t('admin.pinReset')); },
  });

  return (
    <div>
      <PageTitle title={t('nav.teachers')} action={<Button onClick={() => setAdding(true)}><Plus className="size-5" /> {t('admin.addTeacher')}</Button>} />
      <Card className="divide-y divide-line/70">
        {teachers.isLoading && [0, 1, 2].map((i) => <div key={i} className="p-3"><Skeleton className="h-12" /></div>)}
        {teachers.data?.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Avatar name={u.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{u.name}</p>
              <p className="truncate text-sm text-muted">
                {prettyPhone(u.phone)}
                {u.classTeacherOf.length > 0 && ` · ${t('admin.leads', { list: u.classTeacherOf.join(', ') })}`}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-sm ${u.hasPin ? 'bg-present/10 text-present' : 'bg-late/12 text-late-ink'}`}>
              {u.hasPin ? t('admin.pinSet') : t('admin.pinNotSet')}
            </span>
            {u.hasPin && (
              <button onClick={() => reset.mutate(u.id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-board-text hover:bg-board/8">
                <KeyRound className="size-4" /> {t('admin.resetPin')}
              </button>
            )}
          </div>
        ))}
      </Card>
      <AddTeacher open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function AddTeacher({ open, onClose }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => usersApi.createTeacher({ name: form.name, phone: form.phone, email: form.email || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.users }); toast(t('admin.saved')); setForm({ name: '', phone: '', email: '' }); onClose(); },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <Sheet open={open} onClose={onClose} title={t('admin.addTeacher')}>
      <form onSubmit={(e) => { e.preventDefault(); setError(''); save.mutate(); }} className="space-y-4">
        <Input name="name" label={t('admin.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <Input name="phone" label={t('admin.phone')} inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} required />
        <Input name="email" type="email" label={t('admin.email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="quiet" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
          <Button type="submit" loading={save.isPending} className="flex-1">{t('common.save')}</Button>
        </div>
      </form>
    </Sheet>
  );
}
