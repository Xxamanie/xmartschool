import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';
import { createChecklistFromTemplate } from '../checklists/checklist.service';

const router = Router();
const orgOf = (req: Request): string | null => req.auth?.orgId ?? null;

router.get(
  '/',
  requireAuth,
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const q = (req.query.q as string | undefined)?.trim();
    const employees = await prisma.employee.findMany({
      where: {
        orgId,
        ...(q ? { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { staffNo: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      include: { department: { select: { name: true } }, position: { select: { title: true } } },
      orderBy: { firstName: 'asc' },
      take: 500,
    });
    return ok(res, employees);
  }),
);

// Current user's own employee profile (self-service).
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) return fail(res, 404, 'No employee profile linked to this account');
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: { select: { name: true } }, position: { select: { title: true } }, manager: { select: { firstName: true, lastName: true } } },
    });
    if (!employee) return fail(res, 404, 'Employee not found');
    return ok(res, employee);
  }),
);

const upsertSchema = z.object({
  staffNo: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  managerId: z.string().optional(),
  baseSalaryMinor: z.number().int().min(0).optional(),
  hireDate: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
});

router.post(
  '/',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const body = upsertSchema.parse(req.body);
    const employee = await prisma.employee.create({
      data: {
        orgId,
        staffNo: body.staffNo,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        departmentId: body.departmentId,
        positionId: body.positionId,
        managerId: body.managerId,
        baseSalaryMinor: body.baseSalaryMinor ?? 0,
        hireDate: body.hireDate ? new Date(body.hireDate) : undefined,
        bankName: body.bankName,
        bankAccount: body.bankAccount,
      },
    });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'CREATE_EMPLOYEE', entity: 'Employee', entityId: employee.id });
    // Auto-start the onboarding checklist from the org template (best-effort).
    await createChecklistFromTemplate(employee.id, orgId, 'Onboarding');
    return ok(res, employee, 'Employee added');
  }),
);

router.get(
  '/:id',
  requireAuth,
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const orgId = orgOf(req);
    const employee = await prisma.employee.findFirst({
      where: { id, orgId: orgId ?? undefined },
      include: { department: true, position: true, manager: { select: { firstName: true, lastName: true } }, components: true },
    });
    if (!employee) return fail(res, 404, 'Employee not found');
    return ok(res, employee);
  }),
);

router.patch(
  '/:id',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const orgId = orgOf(req);
    const existing = await prisma.employee.findFirst({ where: { id, orgId: orgId ?? undefined } });
    if (!existing) return fail(res, 404, 'Employee not found');
    const body = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional(),
      departmentId: z.string().optional(),
      positionId: z.string().optional(),
      managerId: z.string().optional(),
      status: z.enum(['Active', 'OnLeave', 'Suspended', 'Terminated']).optional(),
      baseSalaryMinor: z.number().int().min(0).optional(),
      bankName: z.string().optional(),
      bankAccount: z.string().optional(),
    }).parse(req.body);
    const employee = await prisma.employee.update({ where: { id }, data: body });
    await writeAudit({ orgId: existing.orgId, actorId: req.auth!.sub, action: 'UPDATE_EMPLOYEE', entity: 'Employee', entityId: id });
    // Auto-start the offboarding checklist when an employee is terminated.
    if (body.status === 'Terminated' && existing.status !== 'Terminated') {
      await createChecklistFromTemplate(id, existing.orgId, 'Offboarding');
    }
    return ok(res, employee, 'Employee updated');
  }),
);

export const employeesRouter = router;
