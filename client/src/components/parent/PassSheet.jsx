import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { errorMessage } from '../../api/client';
import Sheet from '../ui/Sheet';
import Avatar from '../ui/Avatar';
import { Notice, Skeleton } from '../ui';
import { parentsApi } from '../../api/parents';

// Today's pickup pass: the parent picks who is collecting, the QR names that person.
export default function PassSheet({ open, onClose, student }) {
  const { t } = useTranslation();
  const [guardianId, setGuardianId] = useState(null);
  const [img, setImg] = useState('');
  const [error, setError] = useState('');
  const guardians = student.pickupGuardians;
  const chosen = guardians.find((g) => g._id === guardianId);

  useEffect(() => {
    if (!open) { setGuardianId(null); setImg(''); setError(''); return; }
    if (guardians.length === 1) setGuardianId(guardians[0]._id);
  }, [open, guardians]);

  useEffect(() => {
    if (!guardianId) return;
    let alive = true;
    setImg('');
    parentsApi.pickupPass(student._id, guardianId)
      .then((data) => QRCode.toDataURL(data.qr, { width: 640, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#101414', light: '#ffffff' } }))
      .then((url) => alive && setImg(url))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => { alive = false; };
  }, [guardianId, student._id]);

  return (
    <Sheet open={open} onClose={onClose} title={t('parent.passTitle')}>
      {!chosen && (
        <>
          <p className="mb-3 font-semibold">{t('parent.passWho')}</p>
          <div className="space-y-2">
            {guardians.map((g) => (
              <button key={g._id} onClick={() => setGuardianId(g._id)} className="flex w-full items-center gap-3 rounded-2xl border border-line p-3 text-left hover:border-board">
                {g.photoUrl ? <img src={g.photoUrl} alt="" className="size-12 rounded-xl object-cover" /> : <Avatar name={g.name} size={48} />}
                <span><span className="block font-semibold">{g.name}</span><span className="text-muted">{g.relation}</span></span>
              </button>
            ))}
          </div>
        </>
      )}
      {chosen && (
        <div className="text-center">
          <p className="text-xl font-bold">{student.name}</p>
          <p className="mb-3 text-muted">{chosen.name} · {chosen.relation}</p>
          {img ? <img src={img} alt={t('parent.passTitle')} className="mx-auto w-full max-w-72 rounded-2xl border border-line" /> : <Skeleton className="mx-auto aspect-square w-full max-w-72" />}
          <p className="mt-3 text-[15px] text-muted">{t('parent.passValid')}</p>
          {guardians.length > 1 && <button onClick={() => setGuardianId(null)} className="mt-3 font-semibold text-board-text">{t('parent.passWho')}</button>}
        </div>
      )}
      {error && <Notice tone="error" className="mt-3">{error}</Notice>}
    </Sheet>
  );
}
