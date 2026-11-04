import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';
import { computeStatutory } from './payroll.service';
import { notifyPayslipReady } from '../notifications/termii.service';

const router = Router();
const orgOf = (req: Request): string | null => req.auth?.orgId ?? null;

// ── Statutory rules (auto-applied tax/pension engine) ─────────────────────────
router.get(
  '/rules',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const rules = await prisma.statutoryRule.findMany({ where: { orgId }, orderBy: { order: 'asc' } });
    return ok(res, rules);
  }),
);

router.post(
  '/rules',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const body = z.object({
      name: z.string().min(1),
      kind: z.enum(['Pension', 'Tax', 'Levy', 'Other']),
      method: z.enum(['PercentOfBasic', 'PercentOfGross', 'Fixed', 'PayeBands']),
      rateBps: z.number().int().min(0).optional(),
      fixedMinor: z.number().int().min(0).optional(),
      reliefBps: z.number().int().min(0).optional(),
      bands: z.array(z.object({ uptoMinor: z.number().int().nullable(), rateBps: z.number().int().min(0) })).optional(),
      order: z.number().int().optional(),
    }).parse(req.body);
    const rule = await prisma.statutoryRule.create({
      data: { orgId, name: body.name, kind: body.kind, method: body.method, rateBps: body.rateBps ?? 0, fixedMinor: body.fixedMinor ?? 0, reliefBps: body.reliefBps ?? 0, bands: body.bands ?? undefined, order: body.order ?? 0 },
    });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'CREATE_STATUTORY_RULE', entity: 'StatutoryRule', entityId: rule.id });
    return ok(res, rule, 'Rule added');
  }),
);

router.patch(
  '/rules/:id',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const orgId = orgOf(req);
    const existing = await prisma.statutoryRule.findFirst({ where: { id, orgId: orgId ?? undefined } });
    if (!existing) return fail(res, 404, 'Rule not found');
    const body = z.object({ active: z.boolean().optional(), rateBps: z.number().int().min(0).optional(), fixedMinor: z.number().int().min(0).optional() }).parse(req.body);
    const rule = await prisma.statutoryRule.update({ where: { id }, data: body });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'UPDATE_STATUTORY_RULE', entity: 'StatutoryRule', entityId: id });
    return ok(res, rule, 'Rule updated');
  }),
);

// ── Salary components ─────────────────────────────────────────────────────--
router.get(
  '/components/:employeeId',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const { employeeId } = z.object({ employeeId: z.string().min(1) }).parse(req.params);
    const components = await prisma.salaryComponent.findMany({ where: { employeeId }, orderBy: { type: 'asc' } });
    return ok(res, components);
  }),
);

router.post(
  '/components/:employeeId',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    const { employeeId } = z.object({ employeeId: z.string().min(1) }).parse(req.params);
    const employee = await prisma.employee.findFirst({ where: { id: employeeId, orgId: orgId ?? undefined } });
    if (!employee) return fail(res, 404, 'Employee not found');
    const body = z.object({
      name: z.string().min(1),
      type: z.enum(['Earning', 'Deduction']),
      amountMinor: z.number().int().min(0),
      recurring: z.boolean().optional(),
    }).parse(req.body);
    const component = await prisma.salaryComponent.create({
      data: { employeeId, name: body.name, type: body.type, amountMinor: body.amountMinor, recurring: body.recurring ?? true },
    });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'CREATE_SALARY_COMPONENT', entity: 'SalaryComponent', entityId: component.id });
    return ok(res, component, 'Component added');
  }),
);

// ── Payroll runs ──────────────────────────────────────────────────────────--
router.get(
  '/runs',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const runs = await prisma.payrollRun.findMany({
      where: { orgId },
      include: { _count: { select: { payslips: true } } },
      orderBy: { periodLabel: 'desc' },
    });
    return ok(res, runs);
  }),
);

router.post(
  '/runs',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const { periodLabel } = z.object({ periodLabel: z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM') }).parse(req.body);
    const existing = await prisma.payrollRun.findFirst({ where: { orgId, periodLabel } });
    if (existing) return fail(res, 400, `A run for ${periodLabel} already exists`);
    const run = await prisma.payrollRun.create({ data: { orgId, periodLabel, createdById: req.auth!.sub } });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'CREATE_PAYROLL_RUN', entity: 'PayrollRun', entityId: run.id });
    return ok(res, run, 'Payroll run created');
  }),
);

router.post(
  '/runs/:id/generate',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const orgId = orgOf(req);
    const run = await prisma.payrollRun.findFirst({ where: { id, orgId: orgId ?? undefined } });
    if (!run) return fail(res, 404, 'Run not found');
    if (run.status === 'Finalized') return fail(res, 400, 'Run is finalized');

    const [employees, rules] = await Promise.all([
      prisma.employee.findMany({ where: { orgId: run.orgId, status: 'Active' }, include: { components: true } }),
      prisma.statutoryRule.findMany({ where: { orgId: run.orgId, active: true } }),
    ]);

    let count = 0;
    for (const emp of employees) {
      const earnings = emp.components.filter((c) => c.type === 'Earning').reduce((s, c) => s + c.amountMinor, 0);
      const manualDeductions = emp.components.filter((c) => c.type === 'Deduction').reduce((s, c) => s + c.amountMinor, 0);
      const grossMinor = emp.baseSalaryMinor + earnings;

      // Auto-compute statutory deductions (pension, PAYE, levies) from the rules.
      const statutory = computeStatutory(grossMinor, emp.baseSalaryMinor, rules);
      const deductionsMinor = manualDeductions + statutory.totalMinor;
      const netMinor = grossMinor - deductionsMinor;

      const breakdown = [
        { name: 'Base salary', type: 'Earning', category: 'Base', amountMinor: emp.baseSalaryMinor },
        ...emp.components.filter((c) => c.type === 'Earning').map((c) => ({ name: c.name, type: 'Earning', category: 'Allowance', amountMinor: c.amountMinor })),
        ...emp.components.filter((c) => c.type === 'Deduction').map((c) => ({ name: c.name, type: 'Deduction', category: 'Voluntary', amountMinor: c.amountMinor })),
        ...statutory.lines.map((l) => ({ name: l.name, type: 'Deduction', category: 'Statutory', amountMinor: l.amountMinor })),
      ];

      await prisma.payslip.upsert({
        where: { runId_employeeId: { runId: run.id, employeeId: emp.id } },
        update: { grossMinor, deductionsMinor, taxMinor: statutory.taxMinor, pensionMinor: statutory.pensionMinor, statutoryMinor: statutory.totalMinor, netMinor, breakdown },
        create: { runId: run.id, employeeId: emp.id, grossMinor, deductionsMinor, taxMinor: statutory.taxMinor, pensionMinor: statutory.pensionMinor, statutoryMinor: statutory.totalMinor, netMinor, breakdown },
      });
      count++;
    }
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'GENERATE_PAYROLL', entity: 'PayrollRun', entityId: id, metadata: { payslips: count } });
    return ok(res, { runId: id, payslips: count }, `Generated ${count} payslips`);
  }),
);

router.post(
  '/runs/:id/finalize',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const orgId = orgOf(req);
    const run = await prisma.payrollRun.findFirst({ where: { id, orgId: orgId ?? undefined }, include: { org: { select: { currency: true } } } });
    if (!run) return fail(res, 404, 'Run not found');
    const updated = await prisma.payrollRun.update({ where: { id }, data: { status: 'Finalized' } });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'FINALIZE_PAYROLL', entity: 'PayrollRun', entityId: id });

    // Auto-notify each employee that their payslip is ready (non-blocking).
    const payslips = await prisma.payslip.findMany({ where: { runId: id }, select: { netMinor: true, employee: { select: { firstName: true, phone: true } } } });
    for (const p of payslips) notifyPayslipReady(p.employee.phone, p.employee.firstName, run.periodLabel, p.netMinor, run.org.currency);

    return ok(res, { ...updated, notified: payslips.length }, 'Payroll finalized');
  }),
);

router.get(
  '/runs/:id',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const orgId = orgOf(req);
    const run = await prisma.payrollRun.findFirst({
      where: { id, orgId: orgId ?? undefined },
      include: { payslips: { include: { employee: { select: { firstName: true, lastName: true, staffNo: true } } }, orderBy: { netMinor: 'desc' } } },
    });
    if (!run) return fail(res, 404, 'Run not found');
    const totals = run.payslips.reduce(
      (acc, p) => ({ gross: acc.gross + p.grossMinor, deductions: acc.deductions + p.deductionsMinor, net: acc.net + p.netMinor }),
      { gross: 0, deductions: 0, net: 0 },
    );
    return ok(res, { ...run, totals });
  }),
);

// Employee self-service payslips.
router.get(
  '/payslips/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) return fail(res, 404, 'No employee profile linked to this account');
    const payslips = await prisma.payslip.findMany({
      where: { employeeId, run: { status: 'Finalized' } },
      include: { run: { select: { periodLabel: true } } },
      orderBy: { run: { periodLabel: 'desc' } },
    });
    return ok(res, payslips);
  }),
);

// Single payslip (for the printable view) — HR/admin, or the owning employee.
router.get(
  '/payslips/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: {
        run: { select: { periodLabel: true, status: true, orgId: true, org: { select: { name: true, currency: true } } } },
        employee: { select: { id: true, firstName: true, lastName: true, staffNo: true, department: { select: { name: true } }, position: { select: { title: true } }, bankName: true, bankAccount: true } },
      },
    });
    if (!payslip) return fail(res, 404, 'Payslip not found');

    const role = req.auth!.role;
    const isAdmin = role === 'OWNER' || role === 'HR_ADMIN' || role === 'MANAGER';
    const isOwner = req.auth!.employeeId === payslip.employee.id;
    if (!isAdmin && !isOwner) return fail(res, 403, 'Forbidden');
    if (payslip.run.orgId !== req.auth!.orgId) return fail(res, 403, 'Forbidden');

    return ok(res, payslip);
  }),
);

export const payrollRouter = router;
