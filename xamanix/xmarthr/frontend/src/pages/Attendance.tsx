import { useCallback, useEffect, useState } from 'react';
import { get, post, errorMessage } from '../lib/api';
import { formatDate, formatTime } from '../lib/format';
import { PageHeader, Spinner, EmptyState, StatusBadge } from '../components/ui';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import type { AttendanceRecord } from '../lib/types';

export default function Attendance() {
  const toast = useToast();
  const { user } = useAuth();
  const isManager = user ? ['OWNER', 'HR_ADMIN', 'MANAGER'].includes(user.role) : false;
  const [mine, setMine] = useState<AttendanceRecord[]>([]);
  const [team, setTeam] = useState<{ date: string; records: AttendanceRecord[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const calls: Promise<unknown>[] = [];
    if (user?.employeeId) calls.push(get<AttendanceRecord[]>('/attendance/me').then(setMine).catch(() => {}));
    if (isManager) calls.push(get<{ date: string; records: AttendanceRecord[] }>('/attendance').then(setTeam).catch(() => {}));
    Promise.all(calls).finally(() => setLoading(false));
  }, [user?.employeeId, isManager]);
  useEffect(() => { load(); }, [load]);

  const today = mine[0] && mine[0].date.slice(0, 10) === new Date().toISOString().slice(0, 10) ? mine[0] : null;

  const clock = async (action: 'clock-in' | 'clock-out') => {
    setBusy(true);
    try {
      const msg = await post<AttendanceRecord>(`/attendance/${action}`);
      void msg;
      toast.push('success', action === 'clock-in' ? 'Clocked in' : 'Clocked out');
      load();
    } catch (e) { toast.push('error', errorMessage(e)); }
    finally { setBusy(false); }
  };

  const markAbsent = async () => {
    try {
      const r = await post<{ marked: number }>('/attendance/mark-absent');
      toast.push('success', `Marked ${r.marked} absent`);
      load();
    } catch (e) { toast.push('error', errorMessage(e)); }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={isManager ? 'Your record and the team today' : 'Clock in and out'}
        action={isManager ? <button className="btn-ghost" onClick={markAbsent}>Mark today's absentees</button> : undefined}
      />

      {user?.employeeId && (
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Today</div>
              <div className="text-slate-800 font-medium">
                In {formatTime(today?.clockIn)} · Out {formatTime(today?.clockOut)}
                {today && <span className="ml-2"><StatusBadge status={today.status} /></span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => clock('clock-in')} disabled={busy || Boolean(today?.clockIn)}>Clock in</button>
              <button className="btn-primary" onClick={() => clock('clock-out')} disabled={busy || !today?.clockIn || Boolean(today?.clockOut)}>Clock out</button>
            </div>
          </div>
        </div>
      )}

      {user?.employeeId && (
        <div className="card overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">My recent attendance</div>
          {mine.length === 0 ? <EmptyState message="No attendance records yet." /> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">In</th><th className="px-4 py-2 font-medium">Out</th><th className="px-4 py-2 font-medium">Hours</th><th className="px-4 py-2 font-medium">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {mine.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-slate-700">{formatDate(r.date)}</td>
                    <td className="px-4 py-2">{formatTime(r.clockIn)}</td>
                    <td className="px-4 py-2">{formatTime(r.clockOut)}</td>
                    <td className="px-4 py-2 text-slate-600">{r.workedMinutes ? (r.workedMinutes / 60).toFixed(1) : '—'}</td>
                    <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {isManager && team && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Team — {team.date} ({team.records.length} clocked in)</div>
          {team.records.length === 0 ? <EmptyState message="No one has clocked in yet today." /> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2 font-medium">Employee</th><th className="px-4 py-2 font-medium">In</th><th className="px-4 py-2 font-medium">Out</th><th className="px-4 py-2 font-medium">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {team.records.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-medium text-slate-800">{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'} <span className="text-xs text-slate-400">{r.employee?.staffNo}</span></td>
                    <td className="px-4 py-2">{formatTime(r.clockIn)}</td>
                    <td className="px-4 py-2">{formatTime(r.clockOut)}</td>
                    <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
