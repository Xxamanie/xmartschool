import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';

const router = Router();
const propertyOf = (req: Request): string | null => req.auth?.propertyId ?? null;

// ── Cleaning / inspection tasks ───────────────────────────────────────────────
router.get(
  '/tasks',
  requireAuth,
  requireRole('HOUSEKEEPING'),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const tasks = await prisma.housekeepingTask.findMany({
      where: { propertyId },
      include: { room: { select: { number: true, status: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      take: 300,
    });
    return ok(res, tasks);
  }),
);

router.post(
  '/tasks',
  requireAuth,
  requireRole('HOUSEKEEPING'),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const body = z.object({
      roomId: z.string().min(1),
      type: z.enum(['Cleaning', 'Inspection', 'Linen', 'Maintenance']).optional(),
      notes: z.string().optional(),
      assignedToId: z.string().optional(),
      scheduledFor: z.string().optional(),
    }).parse(req.body);
    const room = await prisma.room.findFirst({ where: { id: body.roomId, propertyId } });
    if (!room) return fail(res, 404, 'Room not found');
    const task = await prisma.housekeepingTask.create({
      data: {
        propertyId,
        roomId: body.roomId,
        type: body.type ?? 'Cleaning',
        notes: body.notes,
        assignedToId: body.assignedToId,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
      },
    });
    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'CREATE_HK_TASK', entity: 'HousekeepingTask', entityId: task.id });
    return ok(res, task, 'Task created');
  }),
);

router.patch(
  '/tasks/:id',
  requireAuth,
  requireRole('HOUSEKEEPING'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = z.object({
      status: z.enum(['Pending', 'InProgress', 'Done', 'Inspected']),
      assignedToId: z.string().optional(),
    }).parse(req.body);

    const existing = await prisma.housekeepingTask.findUnique({ where: { id } });
    if (!existing) return fail(res, 404, 'Task not found');
    if (existing.propertyId !== propertyOf(req)) return fail(res, 403, 'Forbidden');

    const ops: Parameters<typeof prisma.$transaction>[0] = [
      prisma.housekeepingTask.update({
        where: { id },
        data: { status: body.status, assignedToId: body.assignedToId ?? existing.assignedToId },
      }),
    ];
    // Completing a cleaning task returns the room to service.
    if (body.status === 'Done' && existing.type === 'Cleaning') {
      ops.push(prisma.room.update({ where: { id: existing.roomId }, data: { status: 'Available' } }));
    }
    const [task] = await prisma.$transaction(ops);
    await writeAudit({ propertyId: existing.propertyId, actorId: req.auth!.sub, action: 'UPDATE_HK_TASK', entity: 'HousekeepingTask', entityId: id, metadata: { status: body.status } });
    return ok(res, task, 'Task updated');
  }),
);

// ── Maintenance requests ──────────────────────────────────────────────────────
router.get(
  '/maintenance',
  requireAuth,
  requireRole('HOUSEKEEPING'),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const requests = await prisma.maintenanceRequest.findMany({
      where: { propertyId },
      include: { room: { select: { number: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, requests);
  }),
);

router.post(
  '/maintenance',
  requireAuth,
  requireRole('HOUSEKEEPING'),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const body = z.object({
      roomId: z.string().optional(),
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(['Low', 'Normal', 'High', 'Urgent']).optional(),
      blockRoom: z.boolean().optional(),
    }).parse(req.body);

    const request = await prisma.maintenanceRequest.create({
      data: { propertyId, roomId: body.roomId, title: body.title, description: body.description, priority: body.priority ?? 'Normal', reportedById: req.auth!.sub },
    });
    if (body.blockRoom && body.roomId) {
      const blockTarget = await prisma.room.findFirst({ where: { id: body.roomId, propertyId } });
      if (!blockTarget) return fail(res, 404, 'Room not found');
      await prisma.room.update({ where: { id: body.roomId }, data: { status: 'OutOfOrder' } });
    }
    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'CREATE_MAINTENANCE', entity: 'MaintenanceRequest', entityId: request.id });
    return ok(res, request, 'Maintenance request logged');
  }),
);

router.patch(
  '/maintenance/:id',
  requireAuth,
  requireRole('HOUSEKEEPING'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = z.object({
      status: z.enum(['Open', 'InProgress', 'Resolved']),
      releaseRoom: z.boolean().optional(),
    }).parse(req.body);

    const existing = await prisma.maintenanceRequest.findUnique({ where: { id } });
    if (!existing) return fail(res, 404, 'Request not found');
    if (existing.propertyId !== propertyOf(req)) return fail(res, 403, 'Forbidden');

    // Status update and optional room release are atomic.
    const request = await prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceRequest.update({ where: { id }, data: { status: body.status } });
      if (body.releaseRoom && existing.roomId) {
        await tx.room.update({ where: { id: existing.roomId }, data: { status: 'Dirty' } });
      }
      return updated;
    });

    await writeAudit({ propertyId: existing.propertyId, actorId: req.auth!.sub, action: 'UPDATE_MAINTENANCE', entity: 'MaintenanceRequest', entityId: id, metadata: { status: body.status } });
    return ok(res, request, 'Maintenance request updated');
  }),
);

export const housekeepingRouter = router;
