import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, Download } from 'lucide-react';
import { errorMessage } from '../../api/client';
import Sheet from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { Button, Notice } from '../../components/ui';
import { studentsApi } from '../../api/students';
import { saveBlob } from '../../api/reports';
import { keys } from '../../api/keys';

const COLUMNS = 'admission_no, name, grade, section, roll_no, gender, dob, sats_id, parent_name, parent_phone, relation';

// Two steps: check the file (dry run, nothing saved) and then import.
export default function ImportSheet({ open, onClose }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (f, dryRun) => {
    const body = new FormData();
    body.append('file', f);
    try {
      return await studentsApi.import(body, { dryRun });
    } catch (e) {
      if (e.response?.status === 422) return e.response.data; // the sheet has problems: show them
      throw e;
    }
  };

  const check = async (f) => {
    setFile(f); setResult(null); setError(''); setBusy(true);
    try { setResult(await send(f, true)); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const doImport = async () => {
    setBusy(true); setError('');
    try {
      const r = await send(file, false);
      if (!r.ok) { setResult(r); return; }
      [keys.students, keys.classes, keys.summary].forEach((queryKey) => qc.invalidateQueries({ queryKey }));
      toast(t('admin.imported', r));
      close();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const close = () => { setFile(null); setResult(null); setError(''); onClose(); };
  const template = async () => {
    try { saveBlob(await studentsApi.template(), 'haajari-students-template.csv'); } catch (e) { setError(errorMessage(e)); }
  };

  return (
    <Sheet open={open} onClose={close} title={t('admin.import')}>
      <p className="mb-2 text-muted">{t('admin.importIntro')}</p>
      <p className="mb-4 rounded-xl bg-paper px-3 py-2 font-mono text-[13px] leading-relaxed text-ink/80">{COLUMNS}</p>
      <button onClick={template} className="mb-4 inline-flex items-center gap-2 font-semibold text-board-text"><Download className="size-4" /> {t('admin.template')}</button>
      <label className="mb-4 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line p-4 text-center hover:border-board/50 focus-within:border-board">
        <FileSpreadsheet className="size-7 text-board-text" />
        <span className="font-semibold">{file ? file.name : t('admin.chooseFile')}</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files[0] && check(e.target.files[0])} />
      </label>
      {busy && !result && <Notice>{t('admin.checking')}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {result && !result.ok && (
        <div className="space-y-2">
          <Notice tone="error">{t('admin.importErrors', { count: result.errors.length })}</Notice>
          <ul className="max-h-60 space-y-1 overflow-y-auto text-[15px]">
            {result.errors.map((e) => (
              <li key={e.row} className="rounded-lg bg-paper px-3 py-2"><b>{t('admin.row', { n: e.row })}:</b> {e.message}</li>
            ))}
          </ul>
        </div>
      )}
      {result?.ok && (
        <div className="space-y-4">
          <Notice tone="ok">{t('admin.importReady', { count: result.total })}</Notice>
          <Button onClick={doImport} loading={busy} className="w-full">{t('admin.importNow', { count: result.total })}</Button>
        </div>
      )}
    </Sheet>
  );
}
