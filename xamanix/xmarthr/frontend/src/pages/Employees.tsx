import { useEffect, useState } from 'react';
import { get, post, errorMessage } from '../lib/api';
import { formatMoney, toMinor } from '../lib/format';
import { PageHeader, Spinner, EmptyState, StatusBadge, Modal } from '../components/ui';
import { useToast } from '../components/Toast';
import type { Employee, Department, Position } from '../lib/types';

export default function Employees() {
  const toast = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ staffNo: '', firstName: '', lastName: '', email: '', phone: '', departmentId: '', positionId: '', salary: '' });

  const load = () => {
    Promise.all([get<Employee[]>('/employees'), get<Department[]>('/org/departments'), get<Position[]>('/org/positions')])
      .then(([e, d, p]) => { setEmployees(e); setDepartments(d); setPositions(p); })
      .catch((err) => toast.push('error', errorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await post('/employees', {
        staffNo: form.staffNo, firstName: form.firstName, lastName: form.lastName,
        email: form.email || undefined, phone: form.phone || undefined,
        departmentId: form.departmentId || undefined, positionId: form.positionId || undefined,
        baseSalaryMinor: form.salary ? toMinor(form.salary) : 0,
      });
      toast.push('success', 'Employee added');
      setOpen(false);
      setForm({ staffNo: '', firstName: '', lastName: '', email: '', phone: '', departmentId: '', positionId: '', salary: '' });
      load();
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Employees" subtitle={`${employees.length} people`} action={<button className="btn-primary" onClick={() => setOpen(true)}>Add employee</button>} />

      <div className="card overflow-hidden">
        {employees.length === 0 ? <EmptyState message="No employees yet." /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Staff #</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Position</th>
                <th className="px-4 py-3 font-medium text-right">Base salary</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="px-4 py-3 text-slate-500">{emp.staffNo}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{emp.firstName} {emp.lastName}</td>
                  <td className="px-4 py-3 text-slate-600">{emp.department?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{emp.position?.title ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-800">{formatMoney(emp.baseSalaryMinor)}</td>
                  <td className="px-4 py-3"><StatusBadge status={emp.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add employee">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Staff #</label><input className="input" value={form.staffNo} onChange={(e) => setForm({ ...form, staffNo: e.target.value })} required placeholder="EMP-004" /></div>
            <div><label className="label">Base salary (monthly)</label><input className="input" type="number" min="0" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">First name</label><input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
            <div><label className="label">Last name</label><input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Department</label>
              <select className="input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Position</label>
              <select className="input" value={form.positionId} onChange={(e) => setForm({ ...form, positionId: e.target.value })}>
                <option value="">—</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Add employee</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
