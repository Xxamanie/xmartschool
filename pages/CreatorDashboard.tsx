import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { School, AuditLogEntry } from '../types';
import {
  Crown, Building2, GraduationCap, Users, Activity, ArrowRight,
  CheckCircle2, ShieldCheck, TrendingUp,
} from 'lucide-react';

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
const prettyAction = (a: string) => a.toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

export const CreatorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [activity, setActivity] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, u, a] = await Promise.all([
          api.getSchools(),
          api.searchUsers({ page: 1, pageSize: 1 }),
          api.getGlobalAuditLogs(12),
        ]);
        if (s.ok) setSchools(s.data || []);
        if (u.ok) setUserTotal(u.data.total || 0);
        if (a.ok) setActivity(a.data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => ({
    total: schools.length,
    active: schools.filter(s => s.status === 'Active').length,
    students: schools.reduce((acc, s) => acc + (s.studentCount || 0), 0),
  }), [schools]);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Crown className="text-amber-400" size={30} fill="currentColor" fillOpacity={0.2} />
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500">Global Dashboard</h1>
            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-wider uppercase">Command Center</span>
          </div>
          <p className="text-slate-400 text-sm ml-10">A live, read-only overview of the whole SmartSchool platform. Jump into the Schools Registry to manage anything.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Kpi icon={<Building2 size={20} />} label="Registered Schools" value={String(stats.total)} tint="slate"
          badge={<span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center"><Activity size={10} className="mr-1" />{stats.active} Active</span>} />
        <Kpi icon={<GraduationCap size={20} />} label="Total Students" value={stats.students.toLocaleString()} tint="blue" />
        <Kpi icon={<Users size={20} />} label="System Users" value={userTotal.toLocaleString()} tint="amber" />
        <Kpi icon={<ShieldCheck size={20} />} label="Platform Status" value="Operational" tint="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
        {/* Schools at a glance */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2"><Building2 size={18} className="text-amber-500" /> Schools at a glance</h3>
            <button onClick={() => navigate('/schools')} className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1">
              Open Registry <ArrowRight size={13} />
            </button>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 text-left">School</th>
                <th className="px-6 py-3 text-left">Region</th>
                <th className="px-6 py-3 text-center">Students</th>
                <th className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [1, 2, 3, 4].map(i => <tr key={i}><td colSpan={4} className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>)
              ) : schools.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">No schools registered yet.</td></tr>
              ) : schools.slice(0, 8).map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-semibold text-slate-900">{s.name} <span className="text-xs text-slate-400 font-mono">{s.code}</span></td>
                  <td className="px-6 py-3 text-slate-500">{s.region || '—'}</td>
                  <td className="px-6 py-3 text-center font-bold text-slate-800">{(s.studentCount || 0).toLocaleString()}</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${s.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <TrendingUp size={18} className="text-amber-500" />
            <h3 className="font-bold text-slate-900">Recent system activity</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {loading ? (
              [1, 2, 3, 4, 5].map(i => <div key={i} className="px-6 py-3"><div className="h-3 bg-slate-100 rounded animate-pulse" /></div>)
            ) : activity.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400 text-sm">No recorded activity yet.</div>
            ) : activity.map(log => (
              <div key={log.id} className="px-6 py-3 flex items-start gap-3">
                <div className="mt-0.5 h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><CheckCircle2 size={14} /></div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{prettyAction(log.action)}</p>
                  <p className="text-xs text-slate-400">{log.entity}{log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''} · {timeAgo(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const tints: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-600', blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600',
};
const Kpi: React.FC<{ icon: React.ReactNode; label: string; value: string; tint: string; badge?: React.ReactNode }> = ({ icon, label, value, tint, badge }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2 rounded-lg ${tints[tint] || tints.slate}`}>{icon}</div>
      {badge}
    </div>
    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
    <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
  </div>
);
