import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { get, errorMessage } from '../lib/api';
import { formatMoney } from '../lib/format';
import { Spinner, EmptyState } from '../components/ui';
import type { PayslipDetail } from '../lib/types';

export default function PayslipView() {
  const { id } = useParams();
  const [slip, setSlip] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    get<PayslipDetail>(`/payroll/payslips/${id}`).then(setSlip).catch((e) => setErr(errorMessage(e))).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (err || !slip) return <EmptyState message={err ?? 'Payslip not found'} />;

  const currency = slip.run?.org?.currency ?? 'NGN';
  const lines = slip.breakdown ?? [];
  const earnings = lines.filter((l) => l.type === 'Earning');
  const deductions = lines.filter((l) => l.type === 'Deduction');
  const fmt = (m: number) => formatMoney(m, currency);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4 no-print">
        <h1 className="text-xl font-bold text-slate-900">Payslip</h1>
        <button className="btn-primary" onClick={() => window.print()}>Print / Save PDF</button>
      </div>

      <div className="card p-8 print-area">
        <div className="flex justify-between items-start border-b border-slate-200 pb-4">
          <div>
            <div className="text-lg font-bold text-brand-700">{slip.run?.org?.name ?? 'XmartHR'}</div>
            <div className="text-xs text-slate-400">Payslip · {slip.run?.periodLabel}</div>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold text-slate-800">{slip.employee?.firstName} {slip.employee?.lastName}</div>
            <div className="text-xs text-slate-500">{slip.employee?.staffNo} · {slip.employee?.position?.title ?? '—'}</div>
            <div className="text-xs text-slate-500">{slip.employee?.department?.name ?? '—'}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Earnings</h3>
            <ul className="text-sm space-y-1">
              {earnings.map((l, i) => <li key={i} className="flex justify-between"><span className="text-slate-600">{l.name}</span><span className="text-slate-800">{fmt(l.amountMinor)}</span></li>)}
            </ul>
            <div className="flex justify-between text-sm font-semibold border-t border-slate-100 mt-2 pt-2"><span>Gross</span><span>{fmt(slip.grossMinor)}</span></div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Deductions</h3>
            <ul className="text-sm space-y-1">
              {deductions.length === 0 ? <li className="text-slate-400">None</li> : deductions.map((l, i) => (
                <li key={i} className="flex justify-between"><span className="text-slate-600">{l.name}{l.category === 'Statutory' ? ' *' : ''}</span><span className="text-amber-700">{fmt(l.amountMinor)}</span></li>
              ))}
            </ul>
            <div className="flex justify-between text-sm font-semibold border-t border-slate-100 mt-2 pt-2"><span>Total deductions</span><span>{fmt(slip.deductionsMinor)}</span></div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-400">
            * statutory (incl. tax {fmt(slip.taxMinor)}, pension {fmt(slip.pensionMinor)})
            {slip.employee?.bankAccount && <div>Paid to: {slip.employee.bankName} · {slip.employee.bankAccount}</div>}
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Net pay</div>
            <div className="text-2xl font-bold text-emerald-600">{fmt(slip.netMinor)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
