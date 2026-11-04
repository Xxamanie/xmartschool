import { prisma } from '../../core/prisma';

const DAY = 86_400_000;
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// ── Workforce KPIs ────────────────────────────────────────────────────────--
export interface HrMetrics {
  headcount: number; active: number; onLeave: number; suspended: number; terminated: number;
  attritionRatePct: number; // terminated / total
  hiresLast90: number;
  punctualityRatePct: number; // present-on-time / attendance records (30d)
  avgReviewRating: number;
  pendingLeave: number;
  lastPayrollNetMinor: number | null;
}

export async function computeMetrics(orgId: string): Promise<HrMetrics> {
  const since30 = startOfDay(new Date(Date.now() - 30 * DAY));
  const since90 = new Date(Date.now() - 90 * DAY);

  const [employees, attendance, reviews, pendingLeave, lastRun] = await Promise.all([
    prisma.employee.findMany({ where: { orgId }, select: { status: true, hireDate: true } }),
    prisma.attendanceRecord.findMany({ where: { employee: { orgId }, date: { gte: since30 } }, select: { status: true } }),
    prisma.review.findMany({ where: { employee: { orgId }, status: 'Submitted', overallRating: { gt: 0 } }, select: { overallRating: true } }),
    prisma.leaveRequest.count({ where: { status: 'Pending', employee: { orgId } } }),
    prisma.payrollRun.findFirst({ where: { orgId, status: 'Finalized' }, orderBy: { periodLabel: 'desc' }, include: { payslips: { select: { netMinor: true } } } }),
  ]);

  const total = employees.length;
  const byStatus = employees.reduce<Record<string, number>>((a, e) => { a[e.status] = (a[e.status] ?? 0) + 1; return a; }, {});
  const onTime = attendance.filter((a) => a.status === 'Present' || a.status === 'Remote').length;
  const avgRating = reviews.length ? Math.round((reviews.reduce((s, r) => s + r.overallRating, 0) / reviews.length) * 10) / 10 : 0;

  return {
    headcount: total,
    active: byStatus['Active'] ?? 0,
    onLeave: byStatus['OnLeave'] ?? 0,
    suspended: byStatus['Suspended'] ?? 0,
    terminated: byStatus['Terminated'] ?? 0,
    attritionRatePct: total ? Math.round(((byStatus['Terminated'] ?? 0) / total) * 1000) / 10 : 0,
    hiresLast90: employees.filter((e) => e.hireDate >= since90).length,
    punctualityRatePct: attendance.length ? Math.round((onTime / attendance.length) * 1000) / 10 : 0,
    avgReviewRating: avgRating,
    pendingLeave,
    lastPayrollNetMinor: lastRun ? lastRun.payslips.reduce((s, p) => s + p.netMinor, 0) : null,
  };
}

// ── Attrition risk (heuristic, explainable) ───────────────────────────────--
export interface AttritionRisk {
  employeeId: string; name: string; department: string;
  score: number; level: 'Low' | 'Medium' | 'High'; reasons: string[];
}

export async function computeAttritionRisk(orgId: string): Promise<AttritionRisk[]> {
  const since30 = startOfDay(new Date(Date.now() - 30 * DAY));
  const since90 = new Date(Date.now() - 90 * DAY);

  const employees = await prisma.employee.findMany({
    where: { orgId, status: 'Active' },
    select: { id: true, firstName: true, lastName: true, hireDate: true, department: { select: { name: true } } },
  });

  const [lateRecords, leaveReqs, reviews] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { employee: { orgId }, date: { gte: since30 }, status: 'Late' }, select: { employeeId: true } }),
    prisma.leaveRequest.findMany({ where: { employee: { orgId }, createdAt: { gte: since90 } }, select: { employeeId: true } }),
    prisma.review.findMany({ where: { employee: { orgId }, status: 'Submitted', overallRating: { gt: 0 } }, select: { employeeId: true, overallRating: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
  ]);

  const lateBy = new Map<string, number>();
  for (const r of lateRecords) lateBy.set(r.employeeId, (lateBy.get(r.employeeId) ?? 0) + 1);
  const leaveBy = new Map<string, number>();
  for (const r of leaveReqs) leaveBy.set(r.employeeId, (leaveBy.get(r.employeeId) ?? 0) + 1);
  const latestRating = new Map<string, number>();
  for (const r of reviews) if (!latestRating.has(r.employeeId)) latestRating.set(r.employeeId, r.overallRating);

  const scored = employees.map((e): AttritionRisk => {
    const reasons: string[] = [];
    let score = 0.1;

    const tenureDays = Math.round((Date.now() - e.hireDate.getTime()) / DAY);
    if (tenureDays < 365) { score += 0.1; reasons.push('Tenure under 1 year'); }

    const late = lateBy.get(e.id) ?? 0;
    if (late >= 5) { score += 0.2; reasons.push(`${late} late arrivals (30d)`); }
    else if (late >= 3) { score += 0.1; reasons.push(`${late} late arrivals (30d)`); }

    const rating = latestRating.get(e.id);
    if (rating !== undefined && rating > 0 && rating <= 2) { score += 0.25; reasons.push(`Low last review (${rating}/5)`); }

    const leaves = leaveBy.get(e.id) ?? 0;
    if (leaves >= 3) { score += 0.1; reasons.push(`${leaves} leave requests (90d)`); }

    score = Math.max(0.02, Math.min(0.95, score));
    const level: AttritionRisk['level'] = score >= 0.55 ? 'High' : score >= 0.3 ? 'Medium' : 'Low';
    if (reasons.length === 0) reasons.push('No elevated risk factors');
    return { employeeId: e.id, name: `${e.firstName} ${e.lastName}`, department: e.department?.name ?? '—', score: Math.round(score * 100) / 100, level, reasons };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 25);
}

// ── Leave-coverage forecast ───────────────────────────────────────────────--
export interface LeaveCoverage {
  upcoming: { employee: string; department: string; leaveType: string; startDate: string; endDate: string; days: number }[];
  byDepartment: { department: string; days: number }[];
}

export async function computeLeaveCoverage(orgId: string, days = 14): Promise<LeaveCoverage> {
  const today = startOfDay();
  const horizon = new Date(today.getTime() + days * DAY);
  const approved = await prisma.leaveRequest.findMany({
    where: { status: 'Approved', employee: { orgId }, startDate: { lt: horizon }, endDate: { gte: today } },
    include: { employee: { select: { firstName: true, lastName: true, department: { select: { name: true } } } }, leaveType: { select: { name: true } } },
    orderBy: { startDate: 'asc' },
  });

  const byDept = new Map<string, number>();
  const upcoming = approved.map((r) => {
    const dept = r.employee.department?.name ?? '—';
    byDept.set(dept, (byDept.get(dept) ?? 0) + r.days);
    return { employee: `${r.employee.firstName} ${r.employee.lastName}`, department: dept, leaveType: r.leaveType.name, startDate: dayKey(r.startDate), endDate: dayKey(r.endDate), days: r.days };
  });

  return { upcoming, byDepartment: [...byDept.entries()].map(([department, d]) => ({ department, days: d })).sort((a, b) => b.days - a.days) };
}
