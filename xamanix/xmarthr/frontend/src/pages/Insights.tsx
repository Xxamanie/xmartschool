import { useEffect, useState } from 'react';
import { get, post, errorMessage } from '../lib/api';
import { formatMoney, formatDate } from '../lib/format';
import { PageHeader, Spinner, EmptyState } from '../components/ui';
import { useToast } from '../components/Toast';
import type { HrMetrics, AttritionRisk, LeaveCoverage } from '../lib/types';

const SUGGESTED = ['Who is at risk of leaving and why?', 'How is attendance and punctuality trending?', 'What leave is coming up in the next two weeks?'];

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="card p-5"><div className="text-sm text-slate-500">{label}</div><div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>{hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}</div>;
}

export default function Insights() {
  const toast = useToast();
  const [metrics, setMetrics] = useState<HrMetrics | null>(null);
  const [risks, setRisks] = useState<AttritionRisk[]>([]);
  const [coverage, setCoverage] = useState<LeaveCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<{ answer: string; usedLlm: boolean } | null>(null);

  useEffect(() => {
    Promise.all([
      get<HrMetrics>('/insights/metrics'),
      get<AttritionRisk[]>('/insights/attrition-risk'),
      get<LeaveCoverage>('/insights/leave-coverage'),
    ]).then(([m, r, c]) => { setMetrics(m); setRisks(r); setCoverage(c); })
      .catch((e) => toast.push('error', errorMessage(e)))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = async (q: string) => {
    const query = q.trim();
    if (!query) return;
    setQuestion(query); setAsking(true); setAnswer(null);
    try { setAnswer(await post<{ answer: string; usedLlm: boolean }>('/insights/ask', { question: query })); }
    catch (e) { toast.push('error', errorMessage(e)); }
    finally { setAsking(false); }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Insights" subtitle="Workforce analytics, attrition risk and leave forecast — from your own data" />

      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Ask about your workforce</h2>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="e.g. Who is at risk of leaving?" value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') ask(question); }} />
          <button className="btn-primary" onClick={() => ask(question)} disabled={asking}>{asking ? 'Thinking…' : 'Ask'}</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">{SUGGESTED.map((s) => <button key={s} className="text-xs rounded-full border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-50" onClick={() => ask(s)}>{s}</button>)}</div>
        {answer && <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">{answer.answer}<div className="text-xs text-slate-400 mt-2">{answer.usedLlm ? 'AI-generated from your metrics' : 'Computed summary — add an AI key for free-form answers'}</div></div>}
      </div>

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat label="Headcount" value={String(metrics.headcount)} hint={`${metrics.active} active · ${metrics.hiresLast90} hired (90d)`} />
          <Stat label="Attrition" value={`${metrics.attritionRatePct}%`} hint={`${metrics.terminated} terminated`} />
          <Stat label="Punctuality (30d)" value={`${metrics.punctualityRatePct}%`} />
          <Stat label="Avg review" value={metrics.avgReviewRating ? `${metrics.avgReviewRating}/5` : '—'} />
        </div>
      )}

      <div className="card overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Attrition risk — active employees</div>
        {risks.length === 0 ? <EmptyState message="No employees to score." /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {risks.map((r) => (
              <li key={r.employeeId} className="px-4 py-3 flex items-start justify-between gap-4">
                <div><div className="font-medium text-slate-800">{r.name} <span className="text-xs text-slate-400">· {r.department}</span></div><div className="text-xs text-slate-500 mt-0.5">{r.reasons.join(' · ')}</div></div>
                <span className={`badge shrink-0 ${r.level === 'High' ? 'bg-rose-50 text-rose-700' : r.level === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{r.level} · {Math.round(r.score * 100)}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Leave coverage — next 14 days</div>
        {!coverage || coverage.upcoming.length === 0 ? <EmptyState message="No approved leave upcoming." /> : (
          <>
            <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">By department: {coverage.byDepartment.map((d) => `${d.department} (${d.days}d)`).join(' · ')}</div>
            <ul className="divide-y divide-slate-100 text-sm">
              {coverage.upcoming.map((u, i) => (
                <li key={i} className="px-4 py-3 flex justify-between">
                  <span className="text-slate-700">{u.employee} <span className="text-xs text-slate-400">· {u.department} · {u.leaveType}</span></span>
                  <span className="text-slate-500 text-xs">{formatDate(u.startDate)} → {formatDate(u.endDate)} ({u.days}d)</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {metrics?.lastPayrollNetMinor != null && <p className="text-xs text-slate-400 mt-4">Last finalized payroll net: {formatMoney(metrics.lastPayrollNetMinor)}</p>}
    </>
  );
}
