import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';
import { notifyLeaveDecision, notifyManagerLeaveRequest } from '../notifications/termii.service';

const router = Router();
const orgOf = (req: Request): string | null => req.auth?.orgId ?? null;
const DAY = 86_400_000;
const isValidDate = (s: string) => !isNaN(new Date(s).getTime());
const inclusiveDays = (start: Date, end: Date) => Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY) + 1);

// ── Leave types ───────────────────────────────────────────────────────────--
router.get(
  '/types',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const types = await prisma.leaveType.findMany({ where: { orgId }, orderBy: { name: 'asc' } });
    return ok(res, types);
  }),
);

router.post(
  '/types',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const body = z.object({ name: z.string().min(1), daysPerYear: z.number().int().min(0).optional(), paid: z.boolean().optional() }).parse(req.body);
    const type = await prisma.leaveType.create({ data: { orgId, name: body.name, daysPerYear: body.daysPerYear ?? 0, paid: body.paid ?? true } });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'CREATE_LEAVE_TYPE', entity: 'LeaveType', entityId: type.id });
    return ok(res, type, 'Leave type created');
  }),
);

// ── Requests ──────────────────────────────────────────────────────────────--
router.get(
  '/requests',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const role = req.auth!.role;
    const where =
      role === 'EMPLOYEE'
        ? { employeeId: req.auth!.employeeId ?? '__none__' }
        : { employee: { orgId } };
    const requests = await prisma.leaveRequest.findMany({
      where,
      include: { leaveType: { select: { name: true } }, employee: { select: { firstName: true, lastName: true, staffNo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return ok(res, requests);
  }),
);

router.post(
  '/requests',
  requireAuth,
  asyncHandler(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) return fail(res, 404, 'No employee profile linked to this account');
    const body = z.object({
      leaveTypeId: z.string().min(1),
      startDate: z.string().refine(isValidDate),
      endDate: z.string().refine(isValidDate),
      reason: z.string().max(500).optional(),
    }).parse(req.body);
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (end < start) return fail(res, 400, 'End date must be on or after start date');
    const days = inclusiveDays(start, end);
    const request = await prisma.leaveRequest.create({
      data: { employeeId, leaveTypeId: body.leaveTypeId, startDate: start, endDate: end, days, reason: body.reason },
    });
    await writeAudit({ orgId: orgOf(req), actorId: req.auth!.sub, action: 'CREATE_LEAVE_REQUEST', entity: 'LeaveRequest', entityId: request.id });

    // Notify the employee's manager (non-blocking; no-op when Termii is unset).
    const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { firstName: true, lastName: true, manager: { select: { firstName: true, phone: true } } } });
    if (emp?.manager?.phone) notifyManagerLeaveRequest(emp.manager.phone, emp.manager.firstName, `${emp.firstName} ${emp.lastName}`, days);

    return ok(res, request, 'Leave request submitted');
  }),
);

router.post(
  '/requests/:id/decide',
  requireAuth,
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const { status } = z.object({ status: z.enum(['Approved', 'Rejected']) }).parse(req.body);
    const orgId = orgOf(req);

    const existing = await prisma.leaveRequest.findFirst({ where: { id, employee: { orgId: orgId ?? undefined } } });
    if (!existing) return fail(res, 404, 'Request not found');
    if (existing.status !== 'Pending') return fail(res, 400, `Request is already ${existing.status}`);

    const updated = await prisma.leaveRequest.update({ where: { id }, data: { status, decidedById: req.auth!.sub, decidedAt: new Date() } });

    // On approval, draw down the employee's leave balance for the year.
    if (status === 'Approved') {
      const year = existing.startDate.getFullYear();
      await prisma.leaveBalance.upsert({
        where: { employeeId_leaveTypeId_year: { employeeId: existing.employeeId, leaveTypeId: existing.leaveTypeId, year } },
        update: { used: { increment: existing.days } },
        create: { employeeId: existing.employeeId, leaveTypeId: existing.leaveTypeId, year, used: existing.days, entitled: 0 },
      });
    }
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'DECIDE_LEAVE', entity: 'LeaveRequest', entityId: id, metadata: { status } });

    // Notify the employee of the decision (non-blocking).
    const [emp, lt] = await Promise.all([
      prisma.employee.findUnique({ where: { id: existing.employeeId }, select: { firstName: true, phone: true } }),
      prisma.leaveType.findUnique({ where: { id: existing.leaveTypeId }, select: { name: true } }),
    ]);
    if (emp) notifyLeaveDecision(emp.phone, emp.firstName, lt?.name ?? 'leave', status);

    return ok(res, updated, `Leave ${status.toLowerCase()}`);
  }),
);

router.get(
  '/balances/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) return fail(res, 404, 'No employee profile linked to this account');
    const year = new Date().getFullYear();
    const balances = await prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: { leaveType: { select: { name: true, daysPerYear: true, paid: true } } },
    });
    return ok(res, balances);
  }),
);

export const leaveRouter = router;
