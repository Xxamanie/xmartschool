import { ReactNode } from 'react';

/** Standalone guest-facing chrome — no staff sidebar, embeddable look. */
export default function PublicShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-brand-700">{title}</div>
            {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
          </div>
          <div className="text-xs text-slate-300">Powered by XmartHotel</div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-8">{children}</main>
    </div>
  );
}
