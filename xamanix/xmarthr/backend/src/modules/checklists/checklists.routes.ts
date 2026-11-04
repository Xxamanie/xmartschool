import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';

const router = Router();
const orgOf = (req: Request): string | null => req.auth?.orgId ?? null;

interface ChecklistItem { title: string; done: boolean; doneAt?: string }

// ── Templates ─────────────────────────────────────────────────────────────--
router.get(
  '/templates',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const templates = await prisma.checklistTemplate.findMany({ where: { orgId }, orderBy: { type: 'asc' } });
    return ok(res, templates);
  }),
);

router.post(
  '/templates',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const body = z.object({ type: z.enum(['Onboarding', 'Offboarding']), name: z.string().min(1), items: z.array(z.string().min(1)).min(1) }).parse(req.body);
    const template = await prisma.checklistTemplate.create({ data: { orgId, type: body.type, name: body.name, items: body.items } });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'CREATE_CHECKLIST_TEMPLATE', entity: 'ChecklistTemplate', entityId: template.id });
    return ok(res, template, 'Template saved');
  }),
);

// ── Checklists ────────────────────────────────────────────────────────────--
router.get(
  '/',
  requireAuth,
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const employeeId = req.query.employeeId as string | undefined;
    const checklists = await prisma.checklist.findMany({
      where: { employee: { orgId }, ...(employeeId ? { employeeId } : {}) },
      include: { employee: { select: { firstName: true, lastName: true, staffNo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return ok(res, checklists);
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) return fail(res, 404, 'No employee profile linked to this account');
    const checklists = await prisma.checklist.findMany({ where: { employeeId }, orderBy: { createdAt: 'desc' } });
    return ok(res, checklists);
  }),
);

router.post(
  '/',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    const body = z.object({ employeeId: z.string().min(1), type: z.enum(['Onboarding', 'Offboarding']) }).parse(req.body);
    const employee = await prisma.employee.findFirst({ where: { id: body.employeeId, orgId: orgId ?? undefined } });
    if (!employee) return fail(res, 404, 'Employee not found');
    const template = await prisma.checklistTemplate.findFirst({ where: { orgId: employee.orgId, type: body.type } });
    const titles = (template?.items as string[] | undefined) ?? [];
    const items: ChecklistItem[] = titles.map((t) => ({ title: t, done: false }));
    const checklist = await prisma.checklist.create({ data: { employeeId: body.employeeId, type: body.type, title: template?.name ?? `${body.type} checklist`, items } });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'CREATE_CHECKLIST', entity: 'Checklist', entityId: checklist.id });
    return ok(res, checklist, 'Checklist created');
  }),
);

// Toggle an item — HR/manager, or the owning employee.
router.patch(
  '/:id/item',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = z.object({ index: z.number().int().min(0), done: z.boolean() }).parse(req.body);
    const checklist = await prisma.checklist.findUnique({ where: { id }, include: { employee: { select: { id: true, orgId: true } } } });
    if (!checklist) return fail(res, 404, 'Checklist not found');

    const role = req.auth!.role;
    const isAdmin = role === 'OWNER' || role === 'HR_ADMIN' || role === 'MANAGER';
    const isOwner = req.auth!.employeeId === checklist.employee.id;
    if (!isAdmin && !isOwner) return fail(res, 403, 'Forbidden');
    if (checklist.employee.orgId !== req.auth!.orgId) return fail(res, 403, 'Forbidden');

    const items = (checklist.items as unknown as ChecklistItem[]) ?? [];
    if (body.index >= items.length) return fail(res, 400, 'Invalid item index');
    items[body.index] = { ...items[body.index], done: body.done, doneAt: body.done ? new Date().toISOString() : undefined };
    const status = items.every((i) => i.done) ? 'Done' : 'Open';

    const updated = await prisma.checklist.update({ where: { id }, data: { items: items as unknown as object, status } });
    return ok(res, updated, 'Checklist updated');
  }),
);

export const checklistsRouter = router;
