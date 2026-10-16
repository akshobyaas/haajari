import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { localToday } from '../../offline/roster';
import Sheet from '../Sheet';
import { useToast } from '../Toast';
import { Button, Input, Notice } from '../ui';

export default function LeaveSheet({ open, onClose, student }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const today = localToday();
  const [f, setF] = useState({ from: today, to: today, reason: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/leave', { studentId: student._id, ...f });
      qc.invalidateQueries({ queryKey: ['child-month'] });
      toast(t('parent.leaveSent'));
      setF({ from: today, to: today, reason: '' });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('parent.applyLeave')}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input name="from" type="date" label={t('parent.leaveFrom')} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: f.to < e.target.value ? e.target.value : f.to })} required />
          <Input name="to" type="date" label={t('parent.leaveTo')} min={f.from} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} required />
        </div>
        <label className="block">
          <span className="mb-1 block text-[15px] font-semibold">{t('parent.leaveReason')}</span>
          <textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} rows={2} placeholder={t('parent.leaveReasonHint')}
            className="w-full rounded-xl border border-line p-3 outline-none focus:border-board focus:ring-4 focus:ring-board/10" />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" loading={busy} disabled={f.reason.trim().length < 3} className="w-full">{t('parent.leaveSend')}</Button>
      </form>
    </Sheet>
  );
}
