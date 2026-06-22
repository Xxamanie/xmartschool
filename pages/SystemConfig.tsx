import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { AuditLogEntry } from '../types';
import { Settings2, ScrollText, Search, Database, ShieldCheck, Building2, Users } from 'lucide-react';

const timeAgo = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString();
};
const prettyAction = (a: string) => a.toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

export const SystemConfig: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [schoolCount, setSchoolCount] = useState(0);
  const [userTotal, setUserTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [a, s, u] = await Promise.all([
          api.getGlobalAuditLogs(200),
          api.getSchools(),
          api.searchUsers({ page: 1, pageSize: 1 }),
        ]);
        if (a.ok) setLogs(a.data || []);
        if (s.ok) setSchoolCount((s.data || []).length);
        if (u.ok) setUserTotal(u.data.total || 0);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(l => l.action.toLowerCase().includes(q) || l.entity.toLowerCase().includes(q));
  }, [logs, filter]);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Settings2 className="text-amber-400" size={28} />
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500">System Configuration</h1>
          </div>
          <p className="text-slate-400 text-sm ml-10">Platform-wide governance — the global audit trail and system information. (Personal preferences live in Settings.)</p>
        </div>
      </div>

      {/* System info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Info icon={<Building2 size={18} />} label="Schools" value={String(schoolCount)} />
        <Info icon={<Users size={18} />} label="System Users" value={userTotal.toLocaleString()} />
        <Info icon={<Database size={18} />} label="Grading Systems" value="Nigeria · British" />
        <Info icon={<ShieldCheck size={18} />} label="Demo Auth" value="Disabled in production" />
      </div>

      {/* Global audit log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 flex items-center gap-2"><ScrollText size={18} className="text-amber-500" /> Global Audit Log</h3>
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Search size={14} /></div>
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter by action or entity…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 text-left">Action</th>
                <th className="px-6 py-3 text-left">Entity</th>
                <th className="px-6 py-3 text-left">School</th>
                <th className="px-6 py-3 text-left">Actor</th>
                <th className="px-6 py-3 text-left">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => <tr key={i}><td colSpan={5} className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>)
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">{logs.length === 0 ? 'No audit activity recorded yet.' : 'No entries match that filter.'}</td></tr>
              ) : filtered.map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-semibold text-slate-800">{prettyAction(l.action)}</td>
                  <td className="px-6 py-3 text-slate-500">{l.entity}</td>
                  <td className="px-6 py-3 text-slate-500 font-mono text-xs">{l.schoolId ? l.schoolId.slice(0, 10) : '—'}</td>
                  <td className="px-6 py-3 text-slate-500 font-mono text-xs">{l.userId ? l.userId.slice(0, 10) : 'system'}</td>
                  <td className="px-6 py-3 text-slate-400 text-xs whitespace-nowrap">{timeAgo(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Info: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
    <div className="inline-flex p-2 rounded-lg bg-amber-50 text-amber-600 mb-3">{icon}</div>
    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
    <h3 className="text-lg font-bold text-slate-900 mt-1">{value}</h3>
  </div>
);
