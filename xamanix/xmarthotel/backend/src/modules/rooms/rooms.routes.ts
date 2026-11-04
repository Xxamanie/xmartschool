import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';

const router = Router();
const propertyOf = (req: Request): string | null => req.auth?.propertyId ?? null;

// ── Room types ──────────────────────────────────────────────────────────────
router.get(
  '/room-types',
  requireAuth,
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const types = await prisma.roomType.findMany({ where: { propertyId }, orderBy: { name: 'asc' } });
    return ok(res, types);
  }),
);

router.post(
  '/room-types',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const body = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      basePriceMinor: z.number().int().min(0),
      capacity: z.number().int().min(1).optional(),
      amenities: z.array(z.string()).optional(),
    }).parse(req.body);
    const type = await prisma.roomType.create({
      data: { propertyId, name: body.name, description: body.description ?? '', basePriceMinor: body.basePriceMinor, capacity: body.capacity ?? 2, amenities: body.amenities ?? [] },
    });
    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'CREATE_ROOM_TYPE', entity: 'RoomType', entityId: type.id });
    return ok(res, type, 'Room type created');
  }),
);

// ── Rooms ─────────────────────────────────────────────────────────────────--
router.get(
  '/rooms',
  requireAuth,
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const rooms = await prisma.room.findMany({
      where: { propertyId },
      include: { roomType: { select: { name: true, basePriceMinor: true } } },
      orderBy: { number: 'asc' },
    });
    return ok(res, rooms);
  }),
);

router.post(
  '/rooms',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const body = z.object({
      number: z.string().min(1),
      roomTypeId: z.string().min(1),
      floor: z.string().optional(),
    }).parse(req.body);
    const room = await prisma.room.create({
      data: { propertyId, number: body.number, roomTypeId: body.roomTypeId, floor: body.floor ?? '' },
    });
    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'CREATE_ROOM', entity: 'Room', entityId: room.id });
    return ok(res, room, 'Room created');
  }),
);

router.patch(
  '/rooms/:id/status',
  requireAuth,
  requireRole('FRONT_DESK', 'HOUSEKEEPING'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const { status } = z.object({
      status: z.enum(['Available', 'Occupied', 'Dirty', 'Cleaning', 'OutOfOrder']),
    }).parse(req.body);
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const existing = await prisma.room.findFirst({ where: { id, propertyId } });
    if (!existing) return fail(res, 404, 'Room not found');
    const room = await prisma.room.update({ where: { id }, data: { status } });
    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'UPDATE_ROOM_STATUS', entity: 'Room', entityId: id, metadata: { status } });
    return ok(res, room, 'Room status updated');
  }),
);

export const roomsRouter = router;
