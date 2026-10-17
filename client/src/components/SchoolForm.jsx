import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Notice } from './ui';
import { errorMessage } from '../lib/api';

const EMPTY = { name: '', udiseCode: '', district: '', block: '', hmName: '', email: '', phone: '', password: '', note: '' };

// Server field paths (from validation or duplicate checks) -> the input that should show the error.
const FIELD = {
  'school.name': 'name', 'school.udiseCode': 'udiseCode', udiseCode: 'udiseCode', 'school.district': 'district', 'school.block': 'block',
  'hm.name': 'hmName', 'hm.email': 'email', email: 'email', 'hm.phone': 'phone', phone: 'phone', 'hm.password': 'password',
};

/**
 * School + headmaster details, used by the public "Register your school" page and by the
 * approver's "Add a school". onSubmit receives the request body and may throw an axios error.
 */
export default function SchoolForm({ onSubmit, submitLabel, defaults = {} }) {
  const { t } = useTranslation();
  const [f, setF] = useState({ ...EMPTY, ...defaults });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    const v = ['udiseCode', 'phone'].includes(k) ? e.target.value.replace(/\D/g, '') : e.target.value;
    setF({ ...f, [k]: v });
    setErrors({ ...errors, [k]: undefined });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setErrors({});
    try {
      await onSubmit({
        school: { name: f.name, udiseCode: f.udiseCode, district: f.district, block: f.block },
        hm: { name: f.hmName, email: f.email, phone: f.phone, password: f.password },
        ...(f.note.trim() ? { note: f.note.trim() } : {}),
      });
    } catch (err) {
      const data = err?.response?.data?.error;
      const fieldErrors = {};
      (data?.fields || []).forEach((x) => { if (FIELD[x.field]) fieldErrors[FIELD[x.field]] = x.message; });
      if (data?.details?.field && FIELD[data.details.field]) fieldErrors[FIELD[data.details.field]] = errorMessage(err);
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (k, label, props = {}) => (
    <Input name={k} label={label} value={f[k]} onChange={set(k)} error={errors[k]} required {...props} />
  );

  return (
    <form onSubmit={submit} className="space-y-6" noValidate={false}>
      <fieldset className="space-y-4">
        <legend className="mb-3 text-lg font-bold">{t('register.schoolSection')}</legend>
        {field('name', t('register.name'), { autoComplete: 'organization' })}
        {field('udiseCode', t('register.udise'), { hint: t('register.udiseHint'), inputMode: 'numeric', maxLength: 11, pattern: '\\d{11}' })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field('district', t('register.district'))}
          {field('block', t('register.block'))}
        </div>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="mb-3 text-lg font-bold">{t('register.hmSection')}</legend>
        {field('hmName', t('register.hmName'), { autoComplete: 'name' })}
        {field('email', t('register.email'), { type: 'email', autoComplete: 'email' })}
        {field('phone', t('register.phone'), { inputMode: 'numeric', maxLength: 10, autoComplete: 'tel-national', pattern: '[6-9]\\d{9}' })}
        {field('password', t('register.password'), { type: 'password', hint: t('register.passwordHint'), minLength: 8, autoComplete: 'new-password' })}
        <label htmlFor="note" className="block">
          <span className="mb-1 block text-[15px] font-semibold text-ink">{t('register.note')}</span>
          <textarea id="note" name="note" rows={2} maxLength={300} value={f.note} onChange={set('note')}
            className="w-full rounded-xl border border-line bg-card px-4 py-3 text-ink outline-none focus:border-board focus:ring-4 focus:ring-board/10" />
        </label>
      </fieldset>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" loading={busy} className="w-full">{submitLabel}</Button>
    </form>
  );
}
