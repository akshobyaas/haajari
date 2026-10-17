import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Thermometer, Users, Bus, MoreHorizontal } from 'lucide-react';
import { errorMessage } from '../../api/client';
import { Notice } from '../ui';
import { parentsApi } from '../../api/parents';
import { keys } from '../../api/keys';

const OPTIONS = [
  ['sick', Thermometer],
  ['family', Users],
  ['travel', Bus],
  ['other', MoreHorizontal],
];

// "Why absent?" answered in one tap. Big buttons, icons for parents who read slowly.
export default function ReasonButtons({ attendanceId, name }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const send = async (reason) => {
    setBusy(reason);
    setError('');
    try {
      await parentsApi.giveReason(attendanceId, reason);
      qc.invalidateQueries({ queryKey: keys.children });
      qc.invalidateQueries({ queryKey: keys.childMonth });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div>
      <p className="mb-2 font-semibold">{t('reason.ask', { name })}</p>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map(([code, Icon]) => (
          <button key={code} onClick={() => send(code)} disabled={Boolean(busy)}
            className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-card px-3 font-semibold text-ink hover:border-board disabled:opacity-60">
            <Icon className="size-5 text-board-text" aria-hidden /> {t(`reason.${code}`)}
          </button>
        ))}
      </div>
      {error && <Notice tone="error" className="mt-2">{error}</Notice>}
    </div>
  );
}
