import { useEffect, useState } from 'react';
import { get, post, errorMessage } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { PageHeader, Spinner, EmptyState } from '../components/ui';
import { useToast } from '../components/Toast';
import type { Announcement, Department } from '../lib/types';

export default function Announcements() {
  const toast = useToast();
  const [list, setList] = useState<Announcement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ message: string; audience: 'All' | 'Department'; departmentId: string; channel: 'generic' | 'whatsapp' }>({ message: '', audience: 'All', departmentId: '', channel: 'whatsapp' });

  const load = () => {
    Promise.all([get<Announcement[]>('/announcements'), get<Department[]>('/org/departments')])
      .then(([a, d]) => { setList(a); setDepartments(d); })
      .catch((e) => toast.push('error', errorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.audience === 'Department' && !form.departmentId) { toast.push('error', 'Pick a department'); return; }
    setBusy(true);
    try {
      const r = await post<{ recipients: number }>('/announcements', {
        message: form.message, audience: form.audience,
        departmentId: form.audience === 'Department' ? form.departmentId : undefined,
        channel: form.channel,
      });
      toast.push('success', `Announcement sent (${r.recipients} recipient${r.recipients === 1 ? '' : 's'})`);
      setForm({ ...form, message: '' });
      load();
    } catch (err) { toast.push('error', errorMessage(err)); }
    finally { setBusy(false); }
  };

  if (loading) return <Spinner />;

  const deptName = (id?: string | null) => departments.find((d) => d.id === id)?.name ?? '—';

  return (
    <>
      <PageHeader title="Announcements" subtitle="Broadcast to staff over WhatsApp or SMS" />

      <div className="card p-5 mb-6">
        <form onSubmit={send} className="space-y-4">
          <div>
            <label className="label">Message</label>
            <textarea className="input" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={1000} required placeholder="e.g. Reminder: the office closes at 2pm on Friday." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Audience</label>
              <select className="input" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as 'All' | 'Department' })}>
                <option value="All">Everyone</option>
                <option value="Department">A department</option>
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <select className="input" value={form.departmentId} disabled={form.audience !== 'Department'} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Channel</label>
              <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as 'generic' | 'whatsapp' })}>
                <option value="whatsapp">WhatsApp</option>
                <option value="generic">SMS</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send announcement'}</button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">History</div>
        {list.length === 0 ? <EmptyState message="No announcements sent yet." /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {list.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="text-slate-800">{a.message}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {formatDateTime(a.createdAt)} · {a.audience === 'All' ? 'Everyone' : deptName(a.departmentId)} · {a.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} · {a.sentCount} delivered
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
