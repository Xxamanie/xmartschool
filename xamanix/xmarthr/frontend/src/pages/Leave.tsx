import { useEffect, useState } from 'react';
import { get, post, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { PageHeader, Spinner, EmptyState, StatusBadge, Modal } from '../components/ui';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import type { LeaveRequest, LeaveType, LeaveBalance } from '../lib/types';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Leave() {
  const toast = useToast();
  const { user } = useAuth();
  const isManager = user ? ['OWNER', 'HR_ADMIN', 'MANAGER'].includes(user.role) : false;
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: '', startDate: todayISO(), endDate: todayISO(), reason: '' });

  const load = () => {
    const calls: Promise<unknown>[] = [
      get<LeaveRequest[]>('/leave/requests').then(setRequests).catch(() => {}),
      get<LeaveType[]>('/leave/types').then((t) => { setTypes(t); setForm((f) => ({ ...f, leaveTypeId: f.leaveTypeId || t[0]?.id || '' })); }).catch(() => {}),
    ];
    if (user?.employeeId) calls.push(get<LeaveBalance[]>('/leave/balances/me').then(setBalances).catch(() => {}));
    Promise.all(calls).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await post('/leave/requests', { leaveTypeId: form.leaveTypeId, startDate: form.startDate, endDate: form.endDate, reason: form.reason || undefined });
      toast.push('success', 'Leave request submitted');
      setOpen(false);
      setForm({ ...form, reason: '' });
      load();
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  const decide = async (id: string, status: 'Approved' | 'Rejected') => {
    try {
      await post(`/leave/requests/${id}/decide`, { status });
      toast.push('success', `Leave ${status.toLowerCase()}`);
      load();
    } catch (e) { toast.push('error', errorMessage(e)); }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Leave" subtitle={isManager ? 'Requests and approvals' : 'Your leave'} action={user?.employeeId ? <button className="btn-primary" onClick={() => setOpen(true)}>Request leave</button> : undefined} />

      {user?.employeeId && balances.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {balances.map((b) => (
            <div key={b.id} className="card p-4">
              <div className="text-sm text-slate-500">{b.leaveType?.name}</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{Math.max(0, (b.entitled || b.leaveType?.daysPerYear || 0) - b.used)}<span className="text-sm font-normal text-slate-400"> days left</span></div>
              <div className="text-xs text-slate-400">{b.used} used of {b.entitled || b.leaveType?.daysPerYear || 0}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">{isManager ? 'All requests' : 'My requests'}</div>
        {requests.length === 0 ? <EmptyState message="No leave requests." /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                {isManager && <th className="px-4 py-2 font-medium">Employee</th>}
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Dates</th>
                <th className="px-4 py-2 font-medium">Days</th>
                <th className="px-4 py-2 font-medium">Status</th>
                {isManager && <th className="px-4 py-2 font-medium text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((r) => (
                <tr key={r.id}>
                  {isManager && <td className="px-4 py-2 font-medium text-slate-800">{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}</td>}
                  <td className="px-4 py-2 text-slate-600">{r.leaveType?.name}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(r.startDate)} → {formatDate(r.endDate)}</td>
                  <td className="px-4 py-2 text-slate-600">{r.days}</td>
                  <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                  {isManager && (
                    <td className="px-4 py-2 text-right">
                      {r.status === 'Pending' && (
                        <span className="flex gap-2 justify-end">
                          <button className="text-emerald-600 hover:underline" onClick={() => decide(r.id, 'Approved')}>Approve</button>
                          <button className="text-rose-600 hover:underline" onClick={() => decide(r.id, 'Rejected')}>Reject</button>
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Request leave">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Leave type</label>
            <select className="input" value={form.leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })} required>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}{t.paid ? '' : ' (unpaid)'}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Start</label><input type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
            <div><label className="label">End</label><input type="date" className="input" value={form.endDate} min={form.startDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></div>
          </div>
          <div><label className="label">Reason (optional)</label><input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Submit request</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
