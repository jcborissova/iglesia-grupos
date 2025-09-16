import React from 'react';

/* ====== Spinner único y reutilizable ====== */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-label="Cargando"
      role="status"
      className={[
        'inline-block h-5 w-5 animate-spin rounded-full border-[3px]',
        'border-gray-300 border-t-slate-600',
        className,
      ].join(' ')}
    />
  );
}

/* ====== Modal mínimo ====== */
export function Modal({
  open,
  onClose,
  children,
  width = 'max-w-md',
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/30 p-4 sm:p-6 overflow-y-auto">
      <div className={`mx-auto ${width}`}>
        <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
          {children}
        </div>
      </div>
      <button aria-label="Cerrar modal" className="fixed inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

/* ====== Inputs y botones ====== */
export function TextField(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }
) {
  const { label, className, ...rest } = props;
  return (
    <label className="grid gap-1 text-sm">
      {label && <span className="text-gray-700">{label}</span>}
      <input
        {...rest}
        className={[
          'rounded-xl px-3 py-2 outline-none',
          'bg-white ring-1 ring-black/10 focus:ring-2 focus:ring-slate-300',
          className || '',
        ].join(' ')}
      />
    </label>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean };

export function PrimaryButton({ className, loading, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium',
        'bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-60',
        'shadow-sm transition',
        className || '',
      ].join(' ')}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function GhostButton({ className, loading, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm',
        'bg-white hover:bg-slate-50 transition ring-1 ring-black/10 disabled:opacity-60',
        className || '',
      ].join(' ')}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

/* Enlaces acción */
export function Link(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return (
    <button
      {...rest}
      className={['text-xs text-slate-700 hover:text-slate-900 underline', className || ''].join(' ')}
    />
  );
}

export function DangerLink(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return (
    <button
      {...rest}
      className={['text-xs text-rose-600 hover:text-rose-700 underline', className || ''].join(' ')}
    />
  );
}
