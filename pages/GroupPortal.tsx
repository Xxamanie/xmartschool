import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { School } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../src/utils/useToast';
import {
  Building2, Users, Crown, TrendingUp, Wallet, AlertCircle,
  LogIn, MapPin, Layers, BarChart3, CheckCircle2,
} from 'lucide-react';

type GroupFinance = {
  totals: { totalPayable: number; totalCollected: number; outstanding: number; studentCount: number; collectionRate: number };
  branches: Array<{ schoolId: string; schoolName: string; totalPayable: number; totalCollected: number; outstanding: number; studentCount: number; fullyPaidCount: number; collectionRate: number }>;
};

const naira = (n: number) => `₦${(n || 0).toLocaleString()}`;

export const GroupPortal: React.FC = () => {
  const { impersonateSchool } = useAuth();
  const navigate = useNavigate();
  const { toasts, toast, dismiss } = useToast();

  const [schools, setSchools] = useState<School[]>([]);
  const [finance, setFinance] = useState<GroupFinance | null>(null);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState<string | null>(null);
  const [tab, setTab] = useState<'branches' | 'earnings'>('branches');

  useEffect(() => {
    (async () => {
      try {
        const [s, f] = await Promise.all([api.getSchools(), api.getGroupFinanceSummary()]);
        if (s.ok) setSchools(s.data || []); else toast.error(s.message || 'Failed to load branches');
        if (f.ok) setFinance(f.data); else toast.error(f.message || 'Failed to load earnings');
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load portfolio');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const manageBranch = async (schoolId: string) => {
    setEntering(schoolId);
    try {
      await impersonateSchool(schoolId);
      navigate('/');
    } catch (e: any) {
      toast.error(e?.message || 'Could not open branch');
    } finally {
      setEntering(null);
    }
  };

  const financeBySchool = useMemo(() => {
    const m = new Map<string, GroupFinance['branches'][number]>();
    finance?.branches.forEach(b => m.set(b.schoolId, b));
    return m;
  }, [finance]);

  const totalStudents = schools.reduce((a, s) => a + (s.studentCount || 0), 0);

  return (
    <div className="space-y-8">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Hero */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
        <div className="relative z-10 flex items-center gap-3 mb-2">
          <Crown className="text-indigo-300" size={30} fill="currentColor" fillOpacity={0.2} />
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-indigo-300 to-indigo-400">Group Portfolio</h1>
          <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 tracking-wider uppercase">Owner</span>
        </div>
        <p className="text-slate-400 text-sm ml-10">Manage every branch from one account. Open any school to run it, or review consolidated earnings across all locations.</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPI icon={<Building2 size={20} />} tint="slate" label="Branches" value={String(schools.length)} />
        <KPI icon={<Users size={20} />} tint="blue" label="Total Students" value={totalStudents.toLocaleString()} />
        <KPI icon={<Wallet size={20} />} tint="emerald" label="Collected (all branches)" value={naira(finance?.totals.totalCollected ?? 0)} />
        <KPI icon={<AlertCircle size={20} />} tint="amber" label="Outstanding" value={naira(finance?.totals.outstanding ?? 0)} />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6">
        {(['branches', 'earnings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-3 px-1 text-sm font-bold transition-colors border-b-2 ${tab === t ? 'border-indigo-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            {t === 'branches' ? 'Branches' : 'Consolidated Earnings'}
          </button>
        ))}
      </div>

      {tab === 'branches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="h-44 bg-slate-100 rounded-2xl animate-pulse" />)
          ) : schools.length === 0 ? (
            <div className="col-span-full text-center text-slate-500 py-10">No branches in your group yet.</div>
          ) : schools.map(s => {
            const f = financeBySchool.get(s.id);
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="h-1.5 w-full" style={{ background: s.themeColor || '#6366f1' }} />
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white" style={{ background: s.themeColor || '#6366f1' }}>
                        <Building2 size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 leading-tight">{s.name}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1"><MapPin size={11} /> {s.region || '—'} · {s.code}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{s.status}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <Mini label="Students" value={(s.studentCount || 0).toLocaleString()} icon={<Users size={13} />} />
                    <Mini label="Collected" value={naira(f?.totalCollected ?? 0)} icon={<Wallet size={13} />} />
                    <Mini label="Rate" value={`${f?.collectionRate ?? 0}%`} icon={<TrendingUp size={13} />} />
                  </div>
                </div>
                <button
                  onClick={() => manageBranch(s.id)}
                  disabled={entering === s.id}
                  className="m-4 mt-0 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                  <LogIn size={15} /> {entering === s.id ? 'Opening…' : 'Manage this branch'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'earnings' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KPI icon={<Wallet size={20} />} tint="emerald" label="Total Collected" value={naira(finance?.totals.totalCollected ?? 0)} />
            <KPI icon={<BarChart3 size={20} />} tint="slate" label="Total Billed" value={naira(finance?.totals.totalPayable ?? 0)} />
            <KPI icon={<TrendingUp size={20} />} tint="indigo" label="Group Collection Rate" value={`${finance?.totals.collectionRate ?? 0}%`} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <Layers size={18} className="text-indigo-500" />
              <h3 className="font-bold text-slate-900">Branch comparison</h3>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3 text-left">Branch</th>
                  <th className="px-6 py-3 text-center">Students</th>
                  <th className="px-6 py-3 text-right">Collected</th>
                  <th className="px-6 py-3 text-right">Outstanding</th>
                  <th className="px-6 py-3 text-left w-48">Collection rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(finance?.branches ?? []).map(b => (
                  <tr key={b.schoolId} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-semibold text-slate-900">{b.schoolName}</td>
                    <td className="px-6 py-3 text-center text-slate-600">{b.studentCount}</td>
                    <td className="px-6 py-3 text-right font-bold text-emerald-700">{naira(b.totalCollected)}</td>
                    <td className="px-6 py-3 text-right text-amber-700">{naira(b.outstanding)}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${b.collectionRate}%`, background: b.collectionRate >= 75 ? '#16a34a' : b.collectionRate >= 50 ? '#ca8a04' : '#dc2626' }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600 w-9 text-right">{b.collectionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!finance || finance.branches.length === 0) && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No earnings data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> Figures roll up live from each branch's fee ledgers.</p>
        </div>
      )}
    </div>
  );
};

const tints: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-600', blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600',
  indigo: 'bg-indigo-50 text-indigo-600',
};

const KPI: React.FC<{ icon: React.ReactNode; tint: string; label: string; value: string }> = ({ icon, tint, label, value }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
    <div className={`inline-flex p-2 rounded-lg mb-3 ${tints[tint] || tints.slate}`}>{icon}</div>
    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
    <h3 className="text-2xl font-bold text-slate-900 mt-1 break-words">{value}</h3>
  </div>
);

const Mini: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-slate-50 rounded-lg py-2">
    <div className="flex items-center justify-center gap-1 text-slate-400">{icon}</div>
    <p className="text-sm font-bold text-slate-800 mt-0.5">{value}</p>
    <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
  </div>
);
