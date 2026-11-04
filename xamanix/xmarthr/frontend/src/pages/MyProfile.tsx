import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../lib/api';
import { formatMoney, formatDate } from '../lib/format';
import { PageHeader, Spinner, EmptyState, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import type { Employee, Payslip } from '../lib/types';

export default function MyProfile() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.employeeId) { setLoading(false); return; }
    Promise.all([
      get<Employee>('/employees/me').then(setEmployee).catch(() => {}),
      get<Payslip[]>('/payroll/payslips/me').then(setPayslips).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [user?.employeeId]);

  if (loading) return <Spinner />;

  if (!user?.employeeId || !employee) {
    return (
      <>
        <PageHeader title="My profile" subtitle="Self-service" />
        <div className="card p-6 text-sm text-slate-500">Your account isn't linked to an employee record yet. Ask HR to link it.</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="My profile" subtitle={`${employee.staffNo}`} />

      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-900">{employee.firstName} {employee.lastName}</div>
            <div className="text-sm text-slate-500">{employee.position?.title ?? '—'} · {employee.department?.name ?? '—'}</div>
          </div>
          <StatusBadge status={employee.status} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
          <div><div className="text-slate-400">Email</div><div className="text-slate-700">{employee.email ?? '—'}</div></div>
          <div><div className="text-slate-400">Phone</div><div className="text-slate-700">{employee.phone ?? '—'}</div></div>
          <div><div className="text-slate-400">Manager</div><div className="text-slate-700">{employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : '—'}</div></div>
          <div><div className="text-slate-400">Hired</div><div className="text-slate-700">{formatDate(employee.hireDate)}</div></div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">My payslips</div>
        {payslips.length === 0 ? <EmptyState message="No finalized payslips yet." /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2 font-medium">Period</th><th className="px-4 py-2 font-medium text-right">Gross</th><th className="px-4 py-2 font-medium text-right">Deductions</th><th className="px-4 py-2 font-medium text-right">Net</th><th className="px-4 py-2"></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {payslips.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">{p.run?.periodLabel}</td>
                  <td className="px-4 py-2 text-right text-slate-700">{formatMoney(p.grossMinor)}</td>
                  <td className="px-4 py-2 text-right text-amber-600">{formatMoney(p.deductionsMinor)}</td>
                  <td className="px-4 py-2 text-right font-medium text-slate-900">{formatMoney(p.netMinor)}</td>
                  <td className="px-4 py-2 text-right"><Link to={`/payslip/${p.id}`} className="text-brand-700 hover:underline text-xs">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
