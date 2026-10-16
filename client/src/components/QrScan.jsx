import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Notice } from './ui';

/** Camera view that reports the first QR code it reads. Uses the phone's back camera. */
export default function QrScan({ onResult }) {
  const { t } = useTranslation();
  const video = useRef(null);
  const [error, setError] = useState(false);
  // Keep the latest callback without restarting the camera when the parent re-renders.
  const handler = useRef(onResult);
  useEffect(() => { handler.current = onResult; }, [onResult]);
  useEffect(() => {
    let scanner;
    let done = false;
    import('qr-scanner').then(({ default: QrScanner }) => {
      scanner = new QrScanner(video.current, (r) => {
        if (done) return;
        done = true;
        navigator.vibrate?.(30);
        handler.current(r.data);
      }, { returnDetailedScanResult: true, preferredCamera: 'environment', highlightScanRegion: true, maxScansPerSecond: 8 });
      scanner.start().catch(() => setError(true));
    }).catch(() => setError(true));
    return () => { done = true; scanner?.destroy(); };
  }, []);
  return (
    <div>
      <p className="mb-2 text-muted">{t('pickup.scanHint')}</p>
      {error ? <Notice tone="warn">{t('pickup.cameraError')}</Notice> : <video ref={video} className="aspect-square w-full rounded-2xl bg-black object-cover" muted playsInline />}
    </div>
  );
}
