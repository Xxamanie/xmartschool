import { ReactNode } from 'react';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner() {
  return <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>;
}

export function EmptyState({ message }: { message: string }) {
  return <div className="py-12 text-center text-slate-400 text-sm">{message}</div>;
}

const STATUS_STYLES: Record<string, string> = {
  Available: 'bg-emerald-50 text-emerald-700',
  Occupied: 'bg-brand-50 text-brand-700',
  Dirty: 'bg-amber-50 text-amber-700',
  Cleaning: 'bg-sky-50 text-sky-700',
  OutOfOrder: 'bg-rose-50 text-rose-700',
  Booked: 'bg-sky-50 text-sky-700',
  CheckedIn: 'bg-emerald-50 text-emerald-700',
  CheckedOut: 'bg-slate-100 text-slate-600',
  Cancelled: 'bg-rose-50 text-rose-700',
  NoShow: 'bg-rose-50 text-rose-700',
  Pending: 'bg-amber-50 text-amber-700',
  InProgress: 'bg-sky-50 text-sky-700',
  Done: 'bg-emerald-50 text-emerald-700',
  Inspected: 'bg-emerald-50 text-emerald-700',
  Open: 'bg-amber-50 text-amber-700',
  Closed: 'bg-slate-100 text-slate-600',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600';
  const label = status.replace(/([a-z])([A-Z])/g, '$1 $2');
  return <span className={`badge ${style}`}>{label}</span>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
