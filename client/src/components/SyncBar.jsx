import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { CloudUpload, AlertTriangle, Loader2 } from 'lucide-react';
import { db } from '../offline/db';
import { syncNow } from '../offline/sync';

// Shows teachers how many marks are only on this phone, with a manual send button.
export default function SyncBar() {
  const { t } = useTranslation();
  const pending = useLiveQuery(() => db.marks.where('synced').equals(0).toArray(), [], []);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const f = () => setOnline(navigator.onLine);
    window.addEventListener('online', f);
    window.addEventListener('offline', f);
    return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f); };
  }, []);
  if (!pending.length) return null;
  const attention = pending.some((m) => m.error);
  return (
    <div className={`mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 ${attention ? 'border-late/40 bg-late/10' : 'border-line bg-card'}`}>
      {attention ? <AlertTriangle className="size-5 shrink-0 text-late" /> : <CloudUpload className="size-5 shrink-0 text-muted" />}
      <span className="flex-1 text-[15px]">{attention ? t('sync.needsAttention') : t('sync.pending', { count: pending.length })}</span>
      {online && !attention && (
        <button onClick={async () => { setBusy(true); await syncNow(); setBusy(false); }} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold text-board hover:bg-board/8">
          {busy && <Loader2 className="size-4 animate-spin" />} {busy ? t('sync.sending') : t('sync.now')}
        </button>
      )}
    </div>
  );
}
