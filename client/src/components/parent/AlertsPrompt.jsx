import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing } from 'lucide-react';
import { enablePush, pushState } from '../../lib/push';
import { Button, Notice } from '../ui';

// Asks once, in context, why alerts matter, instead of a browser prompt on page load.
export default function AlertsPrompt() {
  const { t } = useTranslation();
  const [state, setState] = useState(pushState());
  const [busy, setBusy] = useState(false);
  if (state === 'granted' || state === 'unsupported') return null;
  if (state === 'denied') return <Notice tone="warn" className="mb-4">{t('parent.alertsBlocked')}</Notice>;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-board/20 bg-board/5 p-4">
      <BellRing className="size-6 shrink-0 text-board" />
      <p className="min-w-48 flex-1">{t('parent.alertsOff')}</p>
      <Button loading={busy} onClick={async () => { setBusy(true); try { setState(await enablePush()); } finally { setBusy(false); } }}>
        {t('parent.alertsOn')}
      </Button>
    </div>
  );
}
