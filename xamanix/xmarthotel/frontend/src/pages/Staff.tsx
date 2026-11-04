import { useEffect, useState } from 'react';
import { get, post, errorMessage } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { PageHeader, Spinner, EmptyState, Modal } from '../components/ui';
import { useToast } from '../components/Toast';
import type { Department, StaffMember, Shift } from '../lib/types';

export default function Staff() {
  const toast = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const [deptModal, setDeptModal] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [staffModal, setStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', title: '', departmentId: '', phone: '' });
  const [shiftModal, setShiftModal] = useState(false);
  const [shiftForm, setShiftForm] = useState({ staffId: '', start: '', end: '', role: '' });

  const load = () => {
    Promise.all([get<Department[]>('/staff/departments'), get<StaffMember[]>('/staff'), get<Shift[]>('/staff/shifts')])
      .then(([d, s, sh]) => { setDepartments(d); setStaff(s); setShifts(sh); })
      .catch((e) => toast.push('error', errorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await post('/staff/departments', { name: deptName });
      toast.push('success', 'Department added');
      setDeptModal(false); setDeptName(''); load();
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await post('/staff', {
        name: staffForm.name, title: staffForm.title || undefined,
        departmentId: staffForm.departmentId || undefined, phone: staffForm.phone || undefined,
      });
      toast.push('success', 'Staff member added');
      setStaffModal(false); setStaffForm({ name: '', title: '', departmentId: '', phone: '' }); load();
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  const addShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.staffId || !shiftForm.start || !shiftForm.end) { toast.push('info', 'Pick staff and times'); return; }
    try {
      await post('/staff/shifts', {
        staffId: shiftForm.staffId,
        start: new Date(shiftForm.start).toISOString(),
        end: new Date(shiftForm.end).toISOString(),
        role: shiftForm.role || undefined,
      });
      toast.push('success', 'Shift scheduled');
      setShiftModal(false); setShiftForm({ staffId: '', start: '', end: '', role: '' }); load();
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Staff" subtitle={`${staff.length} staff · ${departments.length} departments`} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="font-semibold text-slate-700">Departments</span>
            <button className="text-sm text-brand-700 hover:underline" onClick={() => setDeptModal(true)}>+ Add</button>
          </div>
          {departments.length === 0 ? <EmptyState message="No departments." /> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {departments.map((d) => (
                <li key={d.id} className="px-4 py-3 flex justify-between">
                  <span className="text-slate-700">{d.name}</span>
                  <span className="text-xs text-slate-400">{d._count?.staff ?? 0} staff</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="font-semibold text-slate-700">Staff</span>
            <button className="text-sm text-brand-700 hover:underline" onClick={() => setStaffModal(true)}>+ Add</button>
          </div>
          {staff.length === 0 ? <EmptyState message="No staff yet." /> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Title</th><th className="px-4 py-2 font-medium">Department</th><th className="px-4 py-2 font-medium">Phone</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-medium text-slate-800">{s.name}</td>
                    <td className="px-4 py-2 text-slate-600">{s.title || '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{s.department?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{s.phone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card overflow-hidden mt-6">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="font-semibold text-slate-700">Shifts</span>
          <button className="text-sm text-brand-700 hover:underline" onClick={() => setShiftModal(true)} disabled={staff.length === 0}>+ Schedule</button>
        </div>
        {shifts.length === 0 ? <EmptyState message="No shifts scheduled." /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {shifts.map((sh) => (
              <li key={sh.id} className="px-4 py-3 flex justify-between">
                <span className="text-slate-700">{sh.staff?.name ?? '—'}{sh.role ? ` · ${sh.role}` : ''}</span>
                <span className="text-slate-500 text-xs">{formatDateTime(sh.start)} → {formatDateTime(sh.end)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={deptModal} onClose={() => setDeptModal(false)} title="Add department">
        <form onSubmit={addDept} className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={deptName} onChange={(e) => setDeptName(e.target.value)} required /></div>
          <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={() => setDeptModal(false)}>Cancel</button><button type="submit" className="btn-primary">Add</button></div>
        </form>
      </Modal>

      <Modal open={staffModal} onClose={() => setStaffModal(false)} title="Add staff member">
        <form onSubmit={addStaff} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Name</label><input className="input" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} required /></div>
            <div><label className="label">Title</label><input className="input" value={staffForm.title} onChange={(e) => setStaffForm({ ...staffForm, title: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Department</label>
              <select className="input" value={staffForm.departmentId} onChange={(e) => setStaffForm({ ...staffForm, departmentId: e.target.value })}>
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><label className="label">Phone</label><input className="input" value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={() => setStaffModal(false)}>Cancel</button><button type="submit" className="btn-primary">Add</button></div>
        </form>
      </Modal>

      <Modal open={shiftModal} onClose={() => setShiftModal(false)} title="Schedule shift">
        <form onSubmit={addShift} className="space-y-4">
          <div><label className="label">Staff</label>
            <select className="input" value={shiftForm.staffId} onChange={(e) => setShiftForm({ ...shiftForm, staffId: e.target.value })} required>
              <option value="">Select…</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Start</label><input className="input" type="datetime-local" value={shiftForm.start} onChange={(e) => setShiftForm({ ...shiftForm, start: e.target.value })} required /></div>
            <div><label className="label">End</label><input className="input" type="datetime-local" value={shiftForm.end} onChange={(e) => setShiftForm({ ...shiftForm, end: e.target.value })} required /></div>
          </div>
          <div><label className="label">Role (optional)</label><input className="input" value={shiftForm.role} onChange={(e) => setShiftForm({ ...shiftForm, role: e.target.value })} placeholder="e.g. Reception" /></div>
          <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={() => setShiftModal(false)}>Cancel</button><button type="submit" className="btn-primary">Schedule</button></div>
        </form>
      </Modal>
    </>
  );
}
