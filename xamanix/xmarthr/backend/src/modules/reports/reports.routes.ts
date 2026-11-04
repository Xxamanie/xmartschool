import { Router, Request } from 'express';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';

const router = Router();
const orgOf = (req: Request): string | null => req.auth?.orgId ?? null;
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

router.get(
  '/dashboard',
  requireAuth,
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const today = startOfDay();

    const [employees, departments, todayAttendance, pendingLeave, lastRun] = await Promise.all([
      prisma.employee.findMany({ where: { orgId }, select: { status: true } }),
      prisma.department.findMany({ where: { orgId }, select: { name: true, _count: { select: { employees: true } } }, orderBy: { name: 'asc' } }),
      prisma.attendanceRecord.findMany({ where: { date: today, employee: { orgId } }, select: { status: true } }),
      prisma.leaveRequest.count({ where: { status: 'Pending', employee: { orgId } } }),
      prisma.payrollRun.findFirst({ where: { orgId, status: 'Finalized' }, orderBy: { periodLabel: 'desc' }, include: { payslips: { select: { netMinor: true } } } }),
    ]);

    const byStatus = employees.reduce<Record<string, number>>((acc, e) => { acc[e.status] = (acc[e.status] ?? 0) + 1; return acc; }, {});
    const headcount = employees.length;
    const present = todayAttendance.filter((a) => a.status === 'Present' || a.status === 'Late' || a.status === 'Remote').length;
    const late = todayAttendance.filter((a) => a.status === 'Late').length;

    return ok(res, {
      headcount,
      active: byStatus['Active'] ?? 0,
      onLeave: byStatus['OnLeave'] ?? 0,
      suspended: byStatus['Suspended'] ?? 0,
      terminated: byStatus['Terminated'] ?? 0,
      presentToday: present,
      lateToday: late,
      attendanceRate: headcount ? Math.round((present / headcount) * 1000) / 10 : 0,
      pendingLeave,
      byDepartment: departments.map((d) => ({ name: d.name, count: d._count.employees })),
      lastPayroll: lastRun ? { periodLabel: lastRun.periodLabel, netMinor: lastRun.payslips.reduce((s, p) => s + p.netMinor, 0), payslips: lastRun.payslips.length } : null,
    });
  }),
);

export const reportsRouter = router;
