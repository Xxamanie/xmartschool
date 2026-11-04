import { prisma } from '../../core/prisma';

export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** Mark every active employee with no attendance record for `date` as Absent. */
export async function markAbsenteesForOrg(orgId: string, date = startOfDay()): Promise<number> {
  const [active, present] = await Promise.all([
    prisma.employee.findMany({ where: { orgId, status: 'Active' }, select: { id: true } }),
    prisma.attendanceRecord.findMany({ where: { date, employee: { orgId } }, select: { employeeId: true } }),
  ]);
  const seen = new Set(present.map((p) => p.employeeId));
  const missing = active.filter((e) => !seen.has(e.id));
  if (missing.length > 0) {
    await prisma.attendanceRecord.createMany({
      data: missing.map((e) => ({ employeeId: e.id, date, status: 'Absent' as const })),
      skipDuplicates: true,
    });
  }
  return missing.length;
}

/** Active employees (with a phone) who have not clocked in today. */
export async function employeesNotClockedIn(orgId: string, date = startOfDay()) {
  const [active, present] = await Promise.all([
    prisma.employee.findMany({ where: { orgId, status: 'Active', phone: { not: null } }, select: { id: true, firstName: true, phone: true } }),
    prisma.attendanceRecord.findMany({ where: { date, employee: { orgId }, clockIn: { not: null } }, select: { employeeId: true } }),
  ]);
  const clockedIn = new Set(present.map((p) => p.employeeId));
  return active.filter((e) => !clockedIn.has(e.id));
}
