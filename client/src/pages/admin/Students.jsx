import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Upload, Search, AlertTriangle } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { classLabel, prettyPhone } from '../../lib/format';
import Avatar from '../../components/Avatar';
import Sheet from '../../components/Sheet';
import ImportSheet from './ImportSheet';
import { useToast } from '../../components/Toast';
import { Button, Card, Input, Select, Notice, PageTitle, Skeleton } from '../../components/ui';

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

export default function Students() {
  const { t } = useTranslation();
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes').then((r) => r.data.classes) });
  const [classId, setClassId] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const q = useDebounced(search);
  const firstClass = classes.data?.[0]?._id;
  const activeClass = classId || (q ? '' : firstClass);

  const students = useQuery({
    queryKey: ['students', activeClass || 'all', q],
    queryFn: () => api.get('/students', { params: { classId: activeClass || undefined, search: q || undefined } }).then((r) => r.data.students),
    enabled: Boolean(activeClass || q),
  });

  return (
    <div>
      <PageTitle
        title={t('nav.students')}
        action={
          <div className="flex gap-2">
            <Button variant="quiet" onClick={() => setImporting(true)}><Upload className="size-5" /> <span className="hidden sm:inline">{t('admin.import')}</span></Button>
            <Button onClick={() => setEditing({ classId: activeClass })}><Plus className="size-5" /> {t('admin.addStudent')}</Button>
          </div>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[220px_1fr]">
        <Select name="class" aria-label={t('admin.gradeLabel')} value={activeClass || ''} onChange={(e) => setClassId(e.target.value)}>
          {q && <option value="">{t('admin.allClasses')}</option>}
          {classes.data?.map((c) => <option key={c._id} value={c._id}>{classLabel(c)} ({c.studentCount})</option>)}
        </Select>
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (e.target.value) setClassId(''); }}
            placeholder={t('admin.searchStudents')}
            aria-label={t('common.search')}
            className="min-h-12 w-full rounded-xl border border-line bg-card pr-4 pl-12 outline-none focus:border-board focus:ring-4 focus:ring-board/10"
          />
        </label>
      </div>
      <Card className="divide-y divide-line/70">
        {students.isLoading && [0, 1, 2, 3, 4].map((i) => <div key={i} className="p-3"><Skeleton className="h-10" /></div>)}
        {students.data?.length === 0 && <p className="p-6 text-center text-muted">{t('admin.noStudents')}</p>}
        {students.data?.map((s) => (
          <button key={s._id} onClick={() => setEditing(s)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper/60">
            <span className="w-7 text-right text-muted tabular-nums">{s.rollNo}</span>
            <Avatar name={s.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{s.name}</span>
              <span className="block truncate text-sm text-muted">
                {s.admissionNo}{!activeClass && s.classId ? ` · ${classLabel(s.classId)}` : ''}
                {s.parentIds?.[0] ? ` · ${s.parentIds[0].name} ${prettyPhone(s.parentIds[0].phone)}` : ''}
              </span>
            </span>
            {!s.satsId && <span className="hidden items-center gap-1 rounded-full bg-late/12 px-2 py-0.5 text-sm text-[#8a5a00] sm:inline-flex"><AlertTriangle className="size-3.5" /> SATS</span>}
          </button>
        ))}
      </Card>
      <StudentForm student={editing} classes={classes.data || []} onClose={() => setEditing(null)} />
      <ImportSheet open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}

function StudentForm({ student, classes, onClose }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const isNew = student && !student._id;
  const [form, setForm] = useState({});
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [formKey, setFormKey] = useState(null);
  const key = student?._id || (student ? 'new' : null);
  if (student && formKey !== key) {
    const p = student.parentIds?.[0];
    setFormKey(key);
    setForm({
      name: student.name || '', admissionNo: student.admissionNo || '', classId: student.classId?._id || student.classId || classes[0]?._id || '',
      rollNo: student.rollNo || '', gender: student.gender || '', dob: student.dob || '', satsId: student.satsId || '',
      parentName: p?.name || '', parentPhone: p?.phone || '', relation: student.pickupGuardians?.[0]?.relation || 'Mother',
    });
    setRemoving(false); setReason(''); setError('');
  }
  if (!student && formKey) setFormKey(null);

  const done = (msg) => { qc.invalidateQueries({ queryKey: ['students'] }); qc.invalidateQueries({ queryKey: ['classes'] }); qc.invalidateQueries({ queryKey: ['summary'] }); toast(msg); onClose(); };
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name, admissionNo: form.admissionNo, classId: form.classId,
        rollNo: form.rollNo ? Number(form.rollNo) : undefined, gender: form.gender || undefined, dob: form.dob || undefined, satsId: form.satsId,
        parent: form.parentPhone ? { name: form.parentName || 'Parent', phone: form.parentPhone, relation: form.relation } : undefined,
      };
      return isNew ? api.post('/students', body) : api.patch(`/students/${student._id}`, body);
    },
    onSuccess: () => done(t('admin.saved')),
    onError: (e) => setError(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/students/${student._id}`, { data: { reason } }),
    onSuccess: () => done(t('admin.saved')),
    onError: (e) => setError(errorMessage(e)),
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <Sheet open={Boolean(student)} onClose={onClose} title={t(isNew ? 'admin.addStudent' : 'admin.editStudent')}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <Input name="name" label={t('admin.name')} value={form.name || ''} onChange={set('name')} required />
        <div className="grid grid-cols-2 gap-3">
          <Input name="admissionNo" label={t('admin.admissionNo')} value={form.admissionNo || ''} onChange={set('admissionNo')} required disabled={!isNew} />
          <Input name="rollNo" label={t('admin.rollNo')} inputMode="numeric" value={form.rollNo || ''} onChange={(e) => setForm({ ...form, rollNo: e.target.value.replace(/\D/g, '') })} />
        </div>
        <Select name="classId" label={t('admin.gradeLabel')} value={form.classId} onChange={set('classId')}>
          {classes.map((c) => <option key={c._id} value={c._id}>{classLabel(c)}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Select name="gender" label={t('admin.gender')} value={form.gender} onChange={set('gender')}>
            <option value="">—</option>
            {['F', 'M', 'O'].map((g) => <option key={g} value={g}>{t(`admin.genders.${g}`)}</option>)}
          </Select>
          <Input name="dob" type="date" label={t('admin.dob')} value={form.dob || ''} onChange={set('dob')} />
        </div>
        <Input name="satsId" label={t('admin.satsId')} inputMode="numeric" maxLength={9} value={form.satsId || ''} onChange={(e) => setForm({ ...form, satsId: e.target.value.replace(/\D/g, '') })} />
        <div className="grid grid-cols-2 gap-3">
          <Input name="parentName" label={t('admin.parentName')} value={form.parentName || ''} onChange={set('parentName')} />
          <Input name="parentPhone" label={t('admin.parentPhone')} inputMode="numeric" maxLength={10} value={form.parentPhone || ''} onChange={(e) => setForm({ ...form, parentPhone: e.target.value.replace(/\D/g, '') })} />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="quiet" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
          <Button type="submit" loading={save.isPending} className="flex-1">{t('common.save')}</Button>
        </div>
        {!isNew && (
          <div className="border-t border-line pt-4">
            {!removing ? (
              <button type="button" onClick={() => setRemoving(true)} className="font-semibold text-absent">{t('admin.removeStudent')}</button>
            ) : (
              <div className="space-y-3">
                <Input name="reason" label={t('admin.removeReason')} value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button type="button" variant="danger" loading={remove.isPending} disabled={reason.trim().length < 2} onClick={() => remove.mutate()} className="w-full">{t('admin.removeStudent')}</Button>
              </div>
            )}
          </div>
        )}
      </form>
    </Sheet>
  );
}
