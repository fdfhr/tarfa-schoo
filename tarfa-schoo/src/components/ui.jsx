import { Loader2, AlertTriangle, Inbox, X } from 'lucide-react';
import { cx } from '../lib/utils';

export function Card({ className = '', children, ...rest }) {
  return (
    <div className={cx('rounded-2xl border border-line bg-surface shadow-sm', className)} {...rest}>
      {children}
    </div>
  );
}

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20',
  secondary: 'bg-soft text-primary hover:bg-brand-100 dark:hover:bg-brand-900',
  outline: 'border border-line bg-surface text-ink hover:bg-soft',
  ghost: 'text-muted hover:text-ink hover:bg-soft',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
};

export function Button({ variant = 'primary', className = '', icon: Icon, children, loading, disabled, ...rest }) {
  return (
    <button
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

const inputBase =
  'w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-800';

function Field({ label, error, hint, children }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-ink">{label}</span>}
      {children}
      {error ? (
        <span className="block text-xs text-red-600 dark:text-red-400">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ label, error, hint, className = '', ...rest }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <input className={cx(inputBase, error ? 'border-red-400' : 'border-line', className)} {...rest} />
    </Field>
  );
}

export function Select({ label, error, hint, children, className = '', ...rest }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <select className={cx(inputBase, error ? 'border-red-400' : 'border-line', className)} {...rest}>
        {children}
      </select>
    </Field>
  );
}

export function Textarea({ label, error, hint, className = '', rows = 3, ...rest }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <textarea rows={rows} className={cx(inputBase, error ? 'border-red-400' : 'border-line', className)} {...rest} />
    </Field>
  );
}

export function Modal({ open, title, onClose, children, footer, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cx(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-3xl sm:rounded-2xl border border-line bg-surface shadow-2xl animate-fade-up',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-soft hover:text-ink" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Badge({ tone = 'neutral', children, className = '' }) {
  const tones = {
    neutral: 'bg-soft text-muted',
    brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  };
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Spinner({ label = 'جاري التحميل...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, title, text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-muted">
      <Icon className="h-10 w-10 opacity-60" />
      <p className="font-semibold text-ink">{title}</p>
      {text && <p className="text-sm">{text}</p>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="font-semibold underline">
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  };
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', tones[tone])}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {hint && <p className="truncate text-xs text-muted">{hint}</p>}
      </div>
    </Card>
  );
}

export function Avatar({ src, name = '', size = 'md' }) {
  const sizes = { sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-24 w-24 text-2xl' };
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('');
  return src ? (
    <img src={src} alt={name} className={cx('shrink-0 rounded-full object-cover ring-2 ring-line', sizes[size])} />
  ) : (
    <div className={cx('flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-200', sizes[size])}>
      {initials || '?'}
    </div>
  );
}

export function Logo({ className = 'h-12 w-12' }) {
  return <img src="/logo.webp" alt="شعار مدرسة طرفا الثانوية المشتركة" className={cx('rounded-full object-cover', className)} />;
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            'flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition',
            value === t.value ? 'bg-brand-600 text-white shadow-sm' : 'text-muted hover:bg-soft hover:text-ink',
          )}
        >
          {t.icon && <t.icon className="h-4 w-4" />}
          {t.label}
        </button>
      ))}
    </div>
  );
}
