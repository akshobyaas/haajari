import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import BoardHeader from '../components/BoardHeader';
import PinPad from '../components/PinPad';
import { Button, Input, Notice } from '../components/ui';
import { api, errorMessage, errorDetails } from '../lib/api';
import { useAuth, homeFor } from '../lib/auth';
import { setLanguage } from '../i18n';
import { prettyPhone } from '../lib/format';

const DEMO = [
  { label: 'Teacher · 4-A', phone: '9000000007' },
  { label: 'Parent · Riya', phone: '9100000001' },
];

export default function Login() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('phone');
  return (
    <div className="min-h-dvh bg-paper">
      <BoardHeader />
      <main className="relative mx-auto -mt-8 max-w-md px-4 pb-10">
        <div className="rounded-3xl bg-card p-5 shadow-lift">
          <div role="tablist" className="mb-6 grid grid-cols-2 rounded-xl bg-paper p-1">
            {['phone', 'staff'].map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`min-h-11 rounded-lg text-[15px] font-semibold transition ${tab === k ? 'bg-card text-board-text shadow-sm' : 'text-muted'}`}
              >
                {t(k === 'phone' ? 'login.phoneTab' : 'login.staffTab')}
              </button>
            ))}
          </div>
          {tab === 'phone' ? <PhoneLogin /> : <StaffLogin />}
        </div>
      </main>
    </div>
  );
}

function useFinish() {
  const setSession = useAuth((s) => s.setSession);
  const navigate = useNavigate();
  return (data) => {
    setSession(data);
    // A language picked on this screen wins over the saved one, and is saved to the profile.
    let picked = null;
    try { picked = sessionStorage.getItem('haajari.pickedLang'); sessionStorage.removeItem('haajari.pickedLang'); } catch { /* private mode */ }
    if (picked && picked !== data.user.language) {
      api.patch('/auth/me', { language: picked }).then((r) => useAuth.getState().setUser(r.data.user)).catch(() => {});
    } else if (data.user.language) setLanguage(data.user.language);
    navigate(homeFor(data.user.role), { replace: true });
  };
}

function PhoneLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const finish = useFinish();
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('phone');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = /^[6-9]\d{9}$/.test(phone);

  const submitPin = async (value) => {
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/auth/pin-login', { phone, pin: value });
      finish(r.data);
    } catch (e) {
      if (errorDetails(e).needsSetup) return navigate(`/setup?phone=${phone}`);
      setError(errorMessage(e));
      setTimeout(() => setPin(''), 350);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {step === 'phone' ? (
        <motion.form
          key="phone"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          onSubmit={(e) => { e.preventDefault(); if (valid) setStep('pin'); }}
          className="space-y-4"
        >
          <Input
            name="phone"
            label={t('login.phone')}
            hint={t('login.phoneHint')}
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            className="[&_input]:text-[22px] [&_input]:tracking-wider"
            autoFocus
          />
          <Button type="submit" disabled={!valid} className="w-full">{t('login.next')}</Button>
          <p className="pt-2 text-center text-[15px] text-muted">
            {t('login.firstTime')}{' '}
            <Link to={`/setup${valid ? `?phone=${phone}` : ''}`} className="font-semibold text-board-text underline underline-offset-4">
              {t('login.setUpPin')}
            </Link>
          </p>
          {import.meta.env.DEV && (
            <div className="border-t border-line pt-4">
              <p className="mb-2 text-sm text-muted">{t('login.demo')} (PIN 1234)</p>
              <div className="flex flex-wrap gap-2">
                {DEMO.map((d) => (
                  <button key={d.phone} type="button" onClick={() => { setPhone(d.phone); setStep('pin'); }}
                    className="rounded-full border border-line px-3 py-1 text-sm text-ink hover:border-board">
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.form>
      ) : (
        <motion.div key="pin" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}>
          <button onClick={() => { setStep('phone'); setPin(''); setError(''); }} className="mb-3 inline-flex items-center gap-1 text-[15px] text-muted hover:text-board-text">
            <ArrowLeft className="size-4" /> {prettyPhone(phone)} · {t('login.changeNumber')}
          </button>
          <h2 className="mb-5 text-center text-xl font-semibold">{t('login.pin')}</h2>
          <PinPad value={pin} onChange={(v) => { setPin(v); setError(''); }} onComplete={submitPin} error={error} disabled={busy} label={t('login.pin')} />
          {error && <Notice tone="error" className="mt-5">{error}</Notice>}
          <p className="mt-5 text-center text-[15px]">
            <Link to={`/setup?phone=${phone}`} className="font-semibold text-board-text underline underline-offset-4">{t('login.setUpPin')}</Link>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StaffLogin() {
  const { t } = useTranslation();
  const finish = useFinish();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      finish((await api.post('/auth/login', form)).data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Input name="email" type="email" label={t('login.email')} autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      <Input name="password" type="password" label={t('login.password')} autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" loading={busy} className="w-full">{t('login.logIn')}</Button>
      {import.meta.env.DEV && (
        <button type="button" onClick={() => setForm({ email: 'hm@kps-mysuru.in', password: 'Haajari@2026' })} className="w-full text-sm text-muted underline">
          {t('login.demo')}: hm@kps-mysuru.in
        </button>
      )}
    </form>
  );
}
