import { useEffect, useState } from 'react';
import { get, post, errorMessage } from '../lib/api';
import { formatMoney } from '../lib/format';
import { PageHeader, Spinner, EmptyState, StatusBadge } from '../components/ui';
import { useToast } from '../components/Toast';

interface PeriodMetrics {
  occupancyRate: number; adrMinor: number; revparMinor: number; revenueCollectedMinor: number;
  bookings: number; cancellations: number; noShows: number; bySource: { source: string; bookings: number }[];
}
interface ForecastDay {
  date: string; weekend: boolean; occupancy: number; demand: string;
  roomTypes: { roomTypeId: string; name: string; available: number; total: number; baseMinor: number; multiplier: number; suggestedMinor: number }[];
}
interface NoShowRisk { reservationId: string; guestName: string; checkIn: string; source: string; score: number; level: 'Low' | 'Medium' | 'High'; reasons: string[] }

const SUGGESTED = [
  'How did the last 30 days compare to the previous month?',
  'Which booking source brought the most reservations?',
  'What does demand look like over the next two weeks?',
];

function Delta({ now, prev, suffix = '' }: { now: number; prev?: number; suffix?: string }) {
  if (prev === undefined) return null;
  const d = Math.round((now - prev) * 10) / 10;
  if (d === 0) return <span className="text-xs text-slate-400 ml-1">±0{suffix}</span>;
  return <span className={`text-xs ml-1 ${d > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{d > 0 ? '▲' : '▼'}{Math.abs(d)}{suffix}</span>;
}

export default function Insights() {
  const toast = useToast();
  const [metrics, setMetrics] = useState<{ current: PeriodMetrics; previous: PeriodMetrics | null } | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [risks, setRisks] = useState<NoShowRisk[]>([]);
  const [loading, setLoading] = useState(true);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<{ answer: string; usedLlm: boolean } | null>(null);

  useEffect(() => {
    Promise.all([
      get<{ current: PeriodMetrics; previous: PeriodMetrics | null }>('/insights/metrics', { compare: 'true' }),
      get<ForecastDay[]>('/insights/forecast', { days: 14 }),
      get<NoShowRisk[]>('/insights/no-show-risk'),
    ])
      .then(([m, f, r]) => { setMetrics(m); setForecast(f); setRisks(r); })
      .catch((e) => toast.push('error', errorMessage(e)))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = async (q: string) => {
    const query = q.trim();
    if (!query) return;
    setQuestion(query);
    setAsking(true);
    setAnswer(null);
    try {
      const r = await post<{ answer: string; usedLlm: boolean }>('/insights/ask', { question: query });
      setAnswer(r);
    } catch (e) { toast.push('error', errorMessage(e)); }
    finally { setAsking(false); }
  };

  if (loading) return <Spinner />;

  const cur = metrics?.current;
  const prev = metrics?.previous ?? undefined;
  const typeCols = forecast[0]?.roomTypes ?? [];

  return (
    <>
      <PageHeader title="Insights" subtitle="Performance, demand forecast and risk — from your own data" />

      {/* Ask */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Ask about your hotel</h2>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="e.g. How did last month compare to the one before?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') ask(question); }}
          />
          <button className="btn-primary" onClick={() => ask(question)} disabled={asking}>{asking ? 'Thinking…' : 'Ask'}</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {SUGGESTED.map((s) => (
            <button key={s} className="text-xs rounded-full border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-50" onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
        {answer && (
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            {answer.answer}
            <div className="text-xs text-slate-400 mt-2">{answer.usedLlm ? 'AI-generated from your metrics' : 'Computed summary — add an AI key for free-form answers'}</div>
          </div>
        )}
      </div>

      {/* KPIs */}
      {cur && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-5"><div className="text-sm text-slate-500">Occupancy (30d)</div><div className="text-2xl font-bold text-slate-900 mt-1">{cur.occupancyRate}%<Delta now={cur.occupancyRate} prev={prev?.occupancyRate} suffix="pts" /></div></div>
          <div className="card p-5"><div className="text-sm text-slate-500">ADR</div><div className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(cur.adrMinor)}</div></div>
          <div className="card p-5"><div className="text-sm text-slate-500">RevPAR</div><div className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(cur.revparMinor)}</div></div>
          <div className="card p-5"><div className="text-sm text-slate-500">Collected (30d)</div><div className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(cur.revenueCollectedMinor)}</div></div>
        </div>
      )}

      {/* Forecast / dynamic pricing */}
      <div className="card overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Demand forecast & suggested rates — next 14 nights</div>
        {forecast.length === 0 ? <EmptyState message="No forecast available." /> : (
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Occupancy</th>
                  <th className="px-3 py-2 font-medium">Demand</th>
                  {typeCols.map((t) => <th key={t.roomTypeId} className="px-3 py-2 font-medium whitespace-nowrap">{t.name}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {forecast.map((d) => (
                  <tr key={d.date} className={d.weekend ? 'bg-slate-50/50' : ''}>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">{d.date.slice(5)}{d.weekend ? ' ·wknd' : ''}</td>
                    <td className="px-3 py-2">{d.occupancy}%</td>
                    <td className="px-3 py-2"><StatusBadge status={d.demand.replace(' ', '')} /></td>
                    {d.roomTypes.map((t) => (
                      <td key={t.roomTypeId} className="px-3 py-2 whitespace-nowrap">
                        <span className="font-medium text-slate-800">{formatMoney(t.suggestedMinor)}</span>
                        {t.multiplier !== 1 && <span className={`text-xs ml-1 ${t.multiplier > 1 ? 'text-emerald-600' : 'text-amber-600'}`}>×{t.multiplier}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* No-show risk */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">No-show risk — upcoming arrivals</div>
        {risks.length === 0 ? <EmptyState message="No upcoming arrivals to score." /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {risks.map((r) => (
              <li key={r.reservationId} className="px-4 py-3 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-slate-800">{r.guestName} <span className="text-xs text-slate-400">· {r.checkIn} · {r.source}</span></div>
                  <div className="text-xs text-slate-500 mt-0.5">{r.reasons.join(' · ')}</div>
                </div>
                <span className={`badge shrink-0 ${r.level === 'High' ? 'bg-rose-50 text-rose-700' : r.level === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{r.level} · {Math.round(r.score * 100)}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
