import { useEffect, useState } from 'react';
import { get, post, patch, errorMessage } from '../lib/api';
import { PageHeader, Spinner, EmptyState, StatusBadge, Modal } from '../components/ui';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import type { Checklist, ChecklistTemplate, Employee } from '../lib/types';

const progress = (c: Checklist) => { const total = c.items.length || 1; const done = c.items.filter((i) => i.done).length; return { done, total: c.items.length, pct: Math.round((done / total) * 100) }; };

function ChecklistCard({ c, onToggle, canToggle }: { c: Checklist; onToggle: (index: number, done: boolean) => void; canToggle: boolean }) {
  const p = progress(c);
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-medium text-slate-800">{c.title}</span>
          {c.employee && <span className="text-xs text-slate-400 ml-2">{c.employee.firstName} {c.employee.lastName} · {c.employee.staffNo}</span>}
        </div>
        <span className="flex items-center gap-2"><span className="text-xs text-slate-400">{p.done}/{p.total}</span><StatusBadge status={c.status} /></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full mb-3"><div className="h-2 bg-brand-500 rounded-full" style={{ width: `${p.pct}%` }} /></div>
      <ul className="space-y-1.5">
        {c.items.map((it, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={it.done} disabled={!canToggle} onChange={(e) => onToggle(i, e.target.checked)} />
            <span className={it.done ? 'line-through text-slate-400' : 'text-slate-700'}>{it.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Onboarding() {
  const toast = useToast();
  const { user } = useAuth();
  const isManager = user ? ['OWNER', 'HR_ADMIN', 'MANAGER'].includes(user.role) : false;

  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ employeeId: string; type: 'Onboarding' | 'Offboarding' }>({ employeeId: '', type: 'Onboarding' });

  const load = () => {
    const calls: Promise<unknown>[] = [];
    if (isManager) {
      calls.push(get<Checklist[]>('/checklists').then(setChecklists).catch(() => {}));
      calls.push(get<ChecklistTemplate[]>('/checklists/templates').then(setTemplates).catch(() => {}));
      calls.push(get<Employee[]>('/employees').then(setEmployees).catch(() => {}));
    } else if (user?.employeeId) {
      calls.push(get<Checklist[]>('/checklists/me').then(setChecklists).catch(() => {}));
    }
    Promise.all(calls).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (checklistId: string, index: number, done: boolean) => {
    setChecklists((cs) => cs.map((c) => c.id === checklistId ? { ...c, items: c.items.map((it, i) => i === index ? { ...it, done } : it) } : c));
    try { await patch(`/checklists/${checklistId}/item`, { index, done }); }
    catch (e) { toast.push('error', errorMessage(e)); load(); }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId) { toast.push('error', 'Pick an employee'); return; }
    try { await post('/checklists', form); toast.push('success', 'Checklist created'); setOpen(false); load(); }
    catch (err) { toast.push('error', errorMessage(err)); }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Onboarding & offboarding"
        subtitle={isManager ? 'Checklists auto-start when you hire or terminate' : 'Your checklists'}
        action={isManager ? <button className="btn-primary" onClick={() => setOpen(true)}>New checklist</button> : undefined}
      />

      {isManager && templates.length > 0 && (
        <div className="card p-4 mb-6 text-xs text-slate-500">
          Templates: {templates.map((t) => `${t.type} — ${t.name} (${t.items.length} steps)`).join(' · ')}
        </div>
      )}

      {checklists.length === 0 ? (
        <div className="card"><EmptyState message={isManager ? 'No checklists yet. They auto-start on hire/termination, or create one.' : 'No checklists assigned to you.'} /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {checklists.map((c) => <ChecklistCard key={c.id} c={c} canToggle onToggle={(i, d) => toggle(c.id, i, d)} />)}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New checklist">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="label">Employee</label>
            <select className="input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required>
              <option value="">Select…</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} · {emp.staffNo}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'Onboarding' | 'Offboarding' })}>
              <option value="Onboarding">Onboarding</option>
              <option value="Offboarding">Offboarding</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn-primary">Create from template</button></div>
        </form>
      </Modal>
    </>
  );
}
