import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';

const router = Router();
const orgOf = (req: Request): string | null => req.auth?.orgId ?? null;

// ── Departments ───────────────────────────────────────────────────────────--
router.get(
  '/departments',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const departments = await prisma.department.findMany({ where: { orgId }, include: { _count: { select: { employees: true } } }, orderBy: { name: 'asc' } });
    return ok(res, departments);
  }),
);

router.post(
  '/departments',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const department = await prisma.department.create({ data: { orgId, name } });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'CREATE_DEPARTMENT', entity: 'Department', entityId: department.id });
    return ok(res, department, 'Department created');
  }),
);

// ── Positions ─────────────────────────────────────────────────────────────--
router.get(
  '/positions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const positions = await prisma.position.findMany({ where: { orgId }, orderBy: { title: 'asc' } });
    return ok(res, positions);
  }),
);

router.post(
  '/positions',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const body = z.object({ title: z.string().min(1), grade: z.string().optional() }).parse(req.body);
    const position = await prisma.position.create({ data: { orgId, title: body.title, grade: body.grade ?? '' } });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'CREATE_POSITION', entity: 'Position', entityId: position.id });
    return ok(res, position, 'Position created');
  }),
);

export const orgRouter = router;
