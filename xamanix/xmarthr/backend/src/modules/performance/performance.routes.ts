import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';
import { notifyReviewSubmitted } from '../notifications/termii.service';

const router = Router();
const orgOf = (req: Request): string | null => req.auth?.orgId ?? null;

// ── Review cycles ─────────────────────────────────────────────────────────--
router.get(
  '/cycles',
  requireAuth,
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const cycles = await prisma.reviewCycle.findMany({ where: { orgId }, include: { _count: { select: { reviews: true } } }, orderBy: { createdAt: 'desc' } });
    return ok(res, cycles);
  }),
);

router.post(
  '/cycles',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const body = z.object({ name: z.string().min(1), periodLabel: z.string().optional() }).parse(req.body);
    const cycle = await prisma.reviewCycle.create({ data: { orgId, name: body.name, periodLabel: body.periodLabel ?? '' } });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'CREATE_REVIEW_CYCLE', entity: 'ReviewCycle', entityId: cycle.id });
    return ok(res, cycle, 'Review cycle created');
  }),
);

router.patch(
  '/cycles/:id',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const orgId = orgOf(req);
    const existing = await prisma.reviewCycle.findFirst({ where: { id, orgId: orgId ?? undefined } });
    if (!existing) return fail(res, 404, 'Cycle not found');
    const body = z.object({ status: z.enum(['Open', 'Closed']) }).parse(req.body);
    const cycle = await prisma.reviewCycle.update({ where: { id }, data: body });
    return ok(res, cycle, 'Cycle updated');
  }),
);

// ── Reviews ───────────────────────────────────────────────────────────────--
router.get(
  '/reviews',
  requireAuth,
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const cycleId = req.query.cycleId as string | undefined;
    const reviews = await prisma.review.findMany({
      where: { employee: { orgId }, ...(cycleId ? { cycleId } : {}) },
      include: { employee: { select: { firstName: true, lastName: true, staffNo: true } }, reviewer: { select: { firstName: true, lastName: true } }, cycle: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return ok(res, reviews);
  }),
);

router.get(
  '/reviews/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) return fail(res, 404, 'No employee profile linked to this account');
    const reviews = await prisma.review.findMany({
      where: { employeeId },
      include: { reviewer: { select: { firstName: true, lastName: true } }, cycle: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, reviews);
  }),
);

router.post(
  '/reviews',
  requireAuth,
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    const body = z.object({ cycleId: z.string().min(1), employeeId: z.string().min(1), reviewerId: z.string().optional() }).parse(req.body);
    const employee = await prisma.employee.findFirst({ where: { id: body.employeeId, orgId: orgId ?? undefined } });
    if (!employee) return fail(res, 404, 'Employee not found');
    const review = await prisma.review.upsert({
      where: { cycleId_employeeId: { cycleId: body.cycleId, employeeId: body.employeeId } },
      update: { reviewerId: body.reviewerId },
      create: { cycleId: body.cycleId, employeeId: body.employeeId, reviewerId: body.reviewerId ?? req.auth!.employeeId },
    });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'CREATE_REVIEW', entity: 'Review', entityId: review.id });
    return ok(res, review, 'Review created');
  }),
);

router.patch(
  '/reviews/:id',
  requireAuth,
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const orgId = orgOf(req);
    const existing = await prisma.review.findFirst({ where: { id, employee: { orgId: orgId ?? undefined } } });
    if (!existing) return fail(res, 404, 'Review not found');
    const body = z.object({
      overallRating: z.number().int().min(0).max(5).optional(),
      strengths: z.string().optional(),
      improvements: z.string().optional(),
      comments: z.string().optional(),
      status: z.enum(['Draft', 'Submitted', 'Acknowledged']).optional(),
    }).parse(req.body);
    const review = await prisma.review.update({
      where: { id },
      data: { ...body, submittedAt: body.status === 'Submitted' ? new Date() : existing.submittedAt },
    });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'UPDATE_REVIEW', entity: 'Review', entityId: id, metadata: { status: body.status } });

    // Notify the employee when their review is submitted (non-blocking).
    if (body.status === 'Submitted') {
      const detail = await prisma.review.findUnique({ where: { id }, select: { employee: { select: { firstName: true, phone: true } }, cycle: { select: { name: true } } } });
      if (detail?.employee) notifyReviewSubmitted(detail.employee.phone, detail.employee.firstName, detail.cycle?.name ?? 'this cycle');
    }

    return ok(res, review, 'Review saved');
  }),
);

// ── Goals (self-service) ──────────────────────────────────────────────────--
router.get(
  '/goals/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) return fail(res, 404, 'No employee profile linked to this account');
    const goals = await prisma.goal.findMany({ where: { employeeId }, orderBy: { createdAt: 'desc' } });
    return ok(res, goals);
  }),
);

router.post(
  '/goals/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) return fail(res, 404, 'No employee profile linked to this account');
    const body = z.object({ title: z.string().min(1), description: z.string().optional(), dueDate: z.string().optional() }).parse(req.body);
    const goal = await prisma.goal.create({ data: { employeeId, title: body.title, description: body.description, dueDate: body.dueDate ? new Date(body.dueDate) : undefined } });
    return ok(res, goal, 'Goal added');
  }),
);

router.patch(
  '/goals/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const employeeId = req.auth!.employeeId;
    const existing = await prisma.goal.findUnique({ where: { id } });
    if (!existing || existing.employeeId !== employeeId) return fail(res, 404, 'Goal not found');
    const body = z.object({ status: z.enum(['Open', 'InProgress', 'Done', 'Cancelled']) }).parse(req.body);
    const goal = await prisma.goal.update({ where: { id }, data: body });
    return ok(res, goal, 'Goal updated');
  }),
);

export const performanceRouter = router;
