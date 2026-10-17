import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2, Plus } from 'lucide-react';
import { errorMessage } from '../../api/client';
import { resizeImage } from '../../lib/image';
import Sheet from '../ui/Sheet';
import Avatar from '../ui/Avatar';
import { useToast } from '../ui/Toast';
import { Button, Notice } from '../ui';
import { parentsApi } from '../../api/parents';
import { keys } from '../../api/keys';

const inputCls = 'min-h-11 w-full rounded-xl border border-line px-3 outline-none focus:border-board focus:ring-4 focus:ring-board/10';

// Parents keep the list of people allowed to collect a pre-primary child.
export default function GuardiansSheet({ open, onClose, student }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const [list, setList] = useState([]);
  const [key, setKey] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (open && key !== student._id) {
    setKey(student._id);
    setList(student.pickupGuardians.map((g) => ({ _id: g._id, name: g.name, relation: g.relation, phone: g.phone || '', photoUrl: g.photoUrl || '' })));
  }
  if (!open && key) setKey(null);
  const set = (i, k, v) => setList(list.map((g, j) => (j === i ? { ...g, [k]: v } : g)));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await parentsApi.setGuardians(student._id, list);
      qc.invalidateQueries({ queryKey: keys.children });
      toast(t('parent.listSaved'));
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('parent.pickupTitle', { name: student.name })}>
      <p className="mb-4 text-sm text-muted">{t('parent.photoConsent')}</p>
      <div className="space-y-4">
        {list.map((g, i) => (
          <div key={g._id || `new${i}`} className="rounded-2xl border border-line p-3">
            <div className="mb-3 flex items-center gap-3">
              {g.photoUrl ? <img src={g.photoUrl} alt="" className="size-16 rounded-xl object-cover" /> : <Avatar name={g.name || '?'} size={64} />}
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 font-semibold text-board-text hover:bg-board/8">
                <Camera className="size-4" /> {g.photoUrl ? t('parent.changePhoto') : t('parent.takePhoto')}
                <input type="file" accept="image/*" capture="user" className="sr-only"
                  onChange={async (e) => e.target.files[0] && set(i, 'photoUrl', await resizeImage(e.target.files[0]))} />
              </label>
              <button onClick={() => setList(list.filter((_, j) => j !== i))} aria-label={t('common.remove')} className="ml-auto rounded-lg p-2 text-muted hover:text-absent">
                <Trash2 className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input aria-label={t('admin.name')} placeholder={t('admin.name')} value={g.name} onChange={(e) => set(i, 'name', e.target.value)} className={inputCls} />
              <input aria-label={t('parent.relation')} placeholder={t('parent.relation')} value={g.relation} onChange={(e) => set(i, 'relation', e.target.value)} className={inputCls} />
              <input aria-label={t('parent.phoneOptional')} placeholder={t('parent.phoneOptional')} inputMode="numeric" maxLength={10} value={g.phone}
                onChange={(e) => set(i, 'phone', e.target.value.replace(/\D/g, ''))} className={`${inputCls} col-span-2`} />
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => setList([...list, { name: '', relation: '', phone: '', photoUrl: '' }])} className="mt-3 inline-flex items-center gap-1 font-semibold text-board-text">
        <Plus className="size-4" /> {t('parent.addPerson')}
      </button>
      {error && <Notice tone="error" className="mt-3">{error}</Notice>}
      <Button onClick={save} loading={busy} className="mt-4 w-full">{t('parent.saveList')}</Button>
    </Sheet>
  );
}
