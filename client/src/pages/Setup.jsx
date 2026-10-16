import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import BoardHeader from '../components/BoardHeader';
import PinPad from '../components/PinPad';
import { Button, Input, Notice } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useAuth, homeFor } from '../lib/auth';
import { prettyPhone, firstName } from '../lib/format';

// First-time setup and PIN reset: phone -> OTP -> PIN -> confirm PIN.
export default function Setup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setSession = useAuth((s) => s.setSession);
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState(params.get('phone') || '');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [setup, setSetup] = useState(null);
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  const sendCode = () => run(async () => {
    const r = await api.post('/auth/otp/request', { phone });
    setDevCode(r.data.devCode || '');
    setCode('');
    setStep('code');
  });
  const verify = () => run(async () => {
    const r = await api.post('/auth/otp/verify', { phone, code });
    setSetup(r.data);
    setStep('pin');
  });
  const choosePin = (v) => { setFirst(v); setPin(''); setStep('confirm'); };
  const confirmPin = (v) => {
    if (v !== first) {
      setError(t('setup.mismatch'));
      setTimeout(() => { setPin(''); setFirst(''); setStep('pin'); }, 600);
      return;
    }
    run(async () => {
      const r = await api.post('/auth/pin/setup', { setupToken: setup.setupToken, pin: v });
      setSession(r.data);
      navigate(homeFor(r.data.user.role), { replace: true });
    });
  };

  const slide = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 } };

  return (
    <div className="min-h-dvh bg-paper">
      <BoardHeader />
      <main className="relative mx-auto -mt-8 max-w-md px-4 pb-10">
        <div className="rounded-3xl bg-card p-5 shadow-lift">
          <Link to="/login" className="mb-3 inline-flex items-center gap-1 text-[15px] text-muted hover:text-board">
            <ArrowLeft className="size-4" /> {t('common.back')}
          </Link>
          <AnimatePresence mode="wait" initial={false}>
            {step === 'phone' && (
              <motion.form key="phone" {...slide} onSubmit={(e) => { e.preventDefault(); sendCode(); }} className="space-y-4">
                <h1 className="text-2xl font-bold">{t('setup.title')}</h1>
                <p className="text-muted">{t('setup.phoneIntro')}</p>
                <Input name="phone" label={t('login.phone')} inputMode="numeric" maxLength={10} value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} autoFocus className="[&_input]:text-[22px] [&_input]:tracking-wider" />
                {error && <Notice tone="error">{error}</Notice>}
                <Button type="submit" loading={busy} disabled={!/^[6-9]\d{9}$/.test(phone)} className="w-full">{t('setup.sendCode')}</Button>
              </motion.form>
            )}
            {step === 'code' && (
              <motion.form key="code" {...slide} onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-4">
                <h1 className="text-2xl font-bold">{t('setup.codeTitle')}</h1>
                <p className="text-muted">{t('setup.codeSent', { phone: prettyPhone(phone) })}</p>
                {devCode && <Notice tone="warn">{t('setup.devCode', { code: devCode })}</Notice>}
                <input
                  aria-label={t('setup.codeTitle')}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  className="h-16 w-full rounded-xl border border-line bg-card text-center text-[32px] font-semibold tracking-[0.5em] outline-none focus:border-board focus:ring-4 focus:ring-board/10"
                />
                {error && <Notice tone="error">{error}</Notice>}
                <Button type="submit" loading={busy} disabled={code.length !== 6} className="w-full">{t('setup.verify')}</Button>
                <button type="button" onClick={sendCode} className="w-full text-[15px] font-semibold text-board">{t('setup.resend')}</button>
              </motion.form>
            )}
            {(step === 'pin' || step === 'confirm') && (
              <motion.div key={step} {...slide}>
                <h1 className="text-center text-2xl font-bold">{t(step === 'pin' ? 'setup.pinTitle' : 'setup.confirmTitle')}</h1>
                {step === 'pin' && <p className="mt-1 text-center text-muted">{t('setup.pinIntro', { name: firstName(setup?.name) })}</p>}
                <div className="mt-6">
                  <PinPad value={pin} onChange={(v) => { setPin(v); setError(''); }} onComplete={step === 'pin' ? choosePin : confirmPin} error={error} disabled={busy} label={t('setup.pinTitle')} />
                </div>
                {error && <Notice tone="error" className="mt-5">{error}</Notice>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
