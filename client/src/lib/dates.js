import i18n from '../i18n';

const locale = () => (i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`);
export const fmtDay = (iso, opts = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat(locale(), { ...opts, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
export const fmtTime = (d) => new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(d));
export const fmtMonth = (ym) => new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ym}-01T00:00:00Z`));
export const shiftMonth = (ym, n) => {
  const d = new Date(`${ym}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
export const reasonText = (t, reason) => {
  if (!reason) return '';
  const [code, ...rest] = reason.split(': ');
  const known = ['sick', 'family', 'travel', 'other'].includes(code);
  return known ? [t(`reason.${code}`), rest.join(': ')].filter(Boolean).join(': ') : reason;
};
export const fmtStamp = (d) => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(d));
