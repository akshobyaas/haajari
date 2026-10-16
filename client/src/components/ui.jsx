import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'bg-board text-chalk hover:bg-board-deep active:scale-[0.98]',
  quiet: 'bg-card text-ink border border-line hover:border-board/40',
  ghost: 'text-board hover:bg-board/8',
  danger: 'bg-absent text-white hover:brightness-95',
};

export function Button({ variant = 'primary', loading, className = '', children, ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold transition disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {loading && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export const Input = forwardRef(function Input({ label, hint, error, className = '', ...props }, ref) {
  const id = props.id || props.name;
  return (
    <label htmlFor={id} className={`block ${className}`}>
      <span className="mb-1 block text-[15px] font-semibold text-ink">{label}</span>
      <input
        ref={ref}
        id={id}
        {...props}
        aria-invalid={Boolean(error)}
        className="min-h-12 w-full rounded-xl border border-line bg-card px-4 text-ink outline-none transition placeholder:text-muted/70 focus:border-board focus:ring-4 focus:ring-board/10 aria-[invalid=true]:border-absent"
      />
      {(error || hint) && <span className={`mt-1 block text-sm ${error ? 'text-absent' : 'text-muted'}`}>{error || hint}</span>}
    </label>
  );
});

export function Select({ label, children, className = '', ...props }) {
  return (
    <label htmlFor={props.id || props.name} className={`block ${className}`}>
      {label && <span className="mb-1 block text-[15px] font-semibold text-ink">{label}</span>}
      <select
        id={props.id || props.name}
        {...props}
        className="min-h-12 w-full appearance-none rounded-xl border border-line bg-card bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22><path d=%22M1 1l5 5 5-5%22 fill=%22none%22 stroke=%22%235a6d64%22 stroke-width=%222%22/></svg>')] bg-[length:12px] bg-[right_1rem_center] bg-no-repeat px-4 pr-10 text-ink outline-none focus:border-board focus:ring-4 focus:ring-board/10"
      >
        {children}
      </select>
    </label>
  );
}

export function Card({ className = '', children, ...props }) {
  return <div {...props} className={`rounded-2xl border border-line/70 bg-card ${className}`}>{children}</div>;
}

export function Notice({ tone = 'info', children, className = '' }) {
  const tones = {
    info: 'bg-leave/8 text-leave border-leave/20',
    error: 'bg-absent/8 text-absent border-absent/25',
    ok: 'bg-present/10 text-present border-present/25',
    warn: 'bg-late/12 text-[#8a5a00] border-late/30',
  };
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-[15px] ${tones[tone]} ${className}`}>{children}</div>;
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-line/60 ${className}`} />;
}

export function PageTitle({ title, sub, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] leading-tight font-bold text-ink">{title}</h1>
        {sub && <p className="text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
