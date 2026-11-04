import { useEffect, useState } from 'react';
import axios from 'axios';
import { get } from '../lib/api';
import { formatMoney } from '../lib/format';
import { PageHeader, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import type { DashboardData } from '../lib/types';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    get<DashboardData>('/reports/dashboard')
      .then(setData)
      .catch((err) => { if (axios.isAxiosError(err) && (err.response?.status === 403 || err.response?.status === 401)) setDenied(true); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  if (denied || !data) {
    return (
      <>
        <PageHeader title={`Welcome, ${user?.name?.split(' ')[0] ?? ''}`} subtitle="Your workspace" />
        <div className="card p-6 text-sm text-slate-500">Use Attendance to clock in/out, Leave to request time off, and My profile to view your details and payslips.</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="HR Dashboard" subtitle="Workforce at a glance" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <Stat label="Headcount" value={String(data.headcount)} hint={`${data.active} active`} />
        <Stat label="Present today" value={String(data.presentToday)} hint={`${data.lateToday} late`} />
        <Stat label="Attendance rate" value={`${data.attendanceRate}%`} />
        <Stat label="Pending leave" value={String(data.pendingLeave)} hint="awaiting decision" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="On leave" value={String(data.onLeave)} />
        <Stat label="Suspended" value={String(data.suspended)} />
        <Stat label="Terminated" value={String(data.terminated)} />
        <Stat label="Last payroll" value={data.lastPayroll ? formatMoney(data.lastPayroll.netMinor) : '—'} hint={data.lastPayroll ? `${data.lastPayroll.periodLabel} · ${data.lastPayroll.payslips} payslips` : 'no finalized run'} />
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Headcount by department</h2>
        {data.byDepartment.length === 0 ? <p className="text-sm text-slate-400">No departments yet.</p> : (
          <div className="space-y-2">
            {data.byDepartment.map((d) => {
              const pct = data.headcount ? Math.round((d.count / data.headcount) * 100) : 0;
              return (
                <div key={d.name}>
                  <div className="flex justify-between text-sm"><span className="text-slate-700">{d.name}</span><span className="text-slate-400">{d.count}</span></div>
                  <div className="h-2 bg-slate-100 rounded-full mt-1"><div className="h-2 bg-brand-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
