import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';

const router = Router();
const propertyOf = (req: Request): string | null => req.auth?.propertyId ?? null;

// ── Departments ───────────────────────────────────────────────────────────--
router.get(
  '/departments',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const departments = await prisma.department.findMany({ where: { propertyId }, include: { _count: { select: { staff: true } } }, orderBy: { name: 'asc' } });
    return ok(res, departments);
  }),
);

router.post(
  '/departments',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const department = await prisma.department.create({ data: { propertyId, name } });
    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'CREATE_DEPARTMENT', entity: 'Department', entityId: department.id });
    return ok(res, department, 'Department created');
  }),
);

// ── Staff ─────────────────────────────────────────────────────────────────--
router.get(
  '/',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const staff = await prisma.staff.findMany({ where: { propertyId }, include: { department: { select: { name: true } } }, orderBy: { name: 'asc' } });
    return ok(res, staff);
  }),
);

router.post(
  '/',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const body = z.object({
      name: z.string().min(1),
      title: z.string().optional(),
      departmentId: z.string().optional(),
      phone: z.string().optional(),
      userId: z.string().optional(),
    }).parse(req.body);
    const member = await prisma.staff.create({
      data: { propertyId, name: body.name, title: body.title ?? '', departmentId: body.departmentId, phone: body.phone, userId: body.userId },
    });
    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'CREATE_STAFF', entity: 'Staff', entityId: member.id });
    return ok(res, member, 'Staff member added');
  }),
);

// ── Shifts ────────────────────────────────────────────────────────────────--
router.get(
  '/shifts',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const shifts = await prisma.shift.findMany({
      where: { staff: { propertyId } },
      include: { staff: { select: { name: true } } },
      orderBy: { start: 'asc' },
      take: 300,
    });
    return ok(res, shifts);
  }),
);

router.post(
  '/shifts',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const body = z.object({
      staffId: z.string().min(1),
      start: z.string(),
      end: z.string(),
      role: z.string().optional(),
    }).parse(req.body);
    const member = await prisma.staff.findFirst({ where: { id: body.staffId, propertyId } });
    if (!member) return fail(res, 404, 'Staff member not found');
    const shift = await prisma.shift.create({ data: { staffId: body.staffId, start: new Date(body.start), end: new Date(body.end), role: body.role ?? '' } });
    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'CREATE_SHIFT', entity: 'Shift', entityId: shift.id });
    return ok(res, shift, 'Shift scheduled');
  }),
);

export const staffRouter = router;
