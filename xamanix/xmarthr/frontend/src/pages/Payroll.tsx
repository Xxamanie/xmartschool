import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post, errorMessage } from '../lib/api';
import { formatMoney } from '../lib/format';
import { PageHeader, Spinner, EmptyState, StatusBadge } from '../components/ui';
import { useToast } from '../components/Toast';
import type { PayrollRun, Payslip, StatutoryRule } from '../lib/types';

interface RunDetail extends PayrollRun { payslips: Payslip[]; totals: { gross: number; deductions: number; net: number }; }

const ruleSummary = (r: StatutoryRule) =>
  r.method === 'PayeBands' ? 'progressive bands' : r.method === 'Fixed' ? formatMoney(r.fixedMinor) : `${(r.rateBps / 100).toFixed(2)}% of ${r.method === 'PercentOfBasic' ? 'basic' : 'gross'}`;

export default function Payroll() {
  const toast = useToast();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [rules, setRules] = useState<StatutoryRule[]>([]);
  const [selected, setSelected] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);

  const loadRuns = () => get<PayrollRun[]>('/payroll/runs').then(setRuns).catch((e) => toast.push('error', errorMessage(e))).finally(() => setLoading(false));
  useEffect(() => {
    loadRuns();
    get<StatutoryRule[]>('/payroll/rules').then(setRules).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openRun = (id: string) => get<RunDetail>(`/payroll/runs/${id}`).then(setSelected).catch((e) => toast.push('error', errorMessage(e)));

  const createRun = async () => {
    try { await post('/payroll/runs', { periodLabel: period }); toast.push('success', 'Run created'); loadRuns(); }
    catch (e) { toast.push('error', errorMessage(e)); }
  };
  const generate = async (id: string) => {
    setBusy(true);
    try { const r = await post<{ payslips: number }>(`/payroll/runs/${id}/generate`); toast.push('success', `Generated ${r.payslips} payslips`); openRun(id); loadRuns(); }
    catch (e) { toast.push('error', errorMessage(e)); } finally { setBusy(false); }
  };
  const finalize = async (id: string) => {
    try { await post(`/payroll/runs/${id}/finalize`); toast.push('success', 'Payroll finalized'); openRun(id); loadRuns(); }
    catch (e) { toast.push('error', errorMessage(e)); }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle="Monthly runs and payslips"
        action={<div className="flex gap-2"><input className="input w-32" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /><button className="btn-primary" onClick={createRun}>New run</button></div>}
      />

      {rules.length > 0 && (
        <div className="card p-4 mb-6">
          <div className="text-sm font-semibold text-slate-700 mb-1">Statutory deductions <span className="text-xs font-normal text-slate-400">— applied automatically when you generate payroll</span></div>
          <div className="flex flex-wrap gap-2 text-xs">
            {rules.map((r) => (
              <span key={r.id} className={`badge ${r.active ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400 line-through'}`}>{r.name}: {ruleSummary(r)}</span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Runs</div>
          {runs.length === 0 ? <EmptyState message="No payroll runs yet." /> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {runs.map((r) => (
                <li key={r.id}>
                  <button onClick={() => openRun(r.id)} className={`w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between ${selected?.id === r.id ? 'bg-brand-50' : ''}`}>
                    <span className="font-medium text-slate-800">{r.periodLabel}</span>
                    <span className="flex items-center gap-2"><span className="text-xs text-slate-400">{r._count?.payslips ?? 0}</span><StatusBadge status={r.status} /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2">
          {!selected ? (
            <div className="card"><EmptyState message="Select a run to view payslips." /></div>
          ) : (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">{selected.periodLabel}</div>
                    <div className="text-xs text-slate-400">{selected.payslips.length} payslips</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selected.status} />
                    {selected.status === 'Draft' && <button className="btn-ghost" onClick={() => generate(selected.id)} disabled={busy}>{busy ? 'Generating…' : 'Generate'}</button>}
                    {selected.status === 'Draft' && selected.payslips.length > 0 && <button className="btn-primary" onClick={() => finalize(selected.id)}>Finalize</button>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                  <div className="rounded-lg bg-slate-50 py-3"><div className="text-xs text-slate-500">Gross</div><div className="font-bold text-slate-800">{formatMoney(selected.totals.gross)}</div></div>
                  <div className="rounded-lg bg-slate-50 py-3"><div className="text-xs text-slate-500">Deductions</div><div className="font-bold text-amber-600">{formatMoney(selected.totals.deductions)}</div></div>
                  <div className="rounded-lg bg-slate-50 py-3"><div className="text-xs text-slate-500">Net</div><div className="font-bold text-emerald-600">{formatMoney(selected.totals.net)}</div></div>
                </div>
              </div>

              <div className="card overflow-hidden">
                {selected.payslips.length === 0 ? <EmptyState message="No payslips — click Generate." /> : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2 font-medium">Employee</th><th className="px-4 py-2 font-medium text-right">Gross</th><th className="px-4 py-2 font-medium text-right">Deductions</th><th className="px-4 py-2 font-medium text-right">Net</th><th className="px-4 py-2"></th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {selected.payslips.map((p) => (
                        <tr key={p.id}>
                          <td className="px-4 py-2 font-medium text-slate-800">{p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : '—'} <span className="text-xs text-slate-400">{p.employee?.staffNo}</span></td>
                          <td className="px-4 py-2 text-right text-slate-700">{formatMoney(p.grossMinor)}</td>
                          <td className="px-4 py-2 text-right text-amber-600">{formatMoney(p.deductionsMinor)}</td>
                          <td className="px-4 py-2 text-right font-medium text-slate-900">{formatMoney(p.netMinor)}</td>
                          <td className="px-4 py-2 text-right"><Link to={`/payslip/${p.id}`} className="text-brand-700 hover:underline text-xs">View</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
