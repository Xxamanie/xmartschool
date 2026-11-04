import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';

const router = Router();
const propertyOf = (req: Request): string | null => req.auth?.propertyId ?? null;

router.get(
  '/arrivals',
  requireAuth,
  requireRole('FRONT_DESK'),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const arrivals = await prisma.reservation.findMany({
      where: { propertyId, status: 'Booked' },
      include: { guest: { select: { firstName: true, lastName: true, phone: true } }, roomType: { select: { name: true } } },
      orderBy: { checkIn: 'asc' },
    });
    return ok(res, arrivals);
  }),
);

router.get(
  '/in-house',
  requireAuth,
  requireRole('FRONT_DESK', 'HOUSEKEEPING'),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const inHouse = await prisma.reservation.findMany({
      where: { propertyId, status: 'CheckedIn' },
      include: { guest: { select: { firstName: true, lastName: true } }, room: { select: { number: true } } },
      orderBy: { checkOut: 'asc' },
    });
    return ok(res, inHouse);
  }),
);

router.post(
  '/:reservationId/check-in',
  requireAuth,
  requireRole('FRONT_DESK'),
  asyncHandler(async (req, res) => {
    const { reservationId } = z.object({ reservationId: z.string().min(1) }).parse(req.params);
    const { roomId } = z.object({ roomId: z.string().min(1) }).parse(req.body);

    const reservation = await prisma.reservation.findUnique({ where: { id: reservationId }, select: { propertyId: true, status: true } });
    if (!reservation) return fail(res, 404, 'Reservation not found');
    if (reservation.propertyId !== req.auth!.propertyId) return fail(res, 403, 'Forbidden');
    if (reservation.status !== 'Booked') return fail(res, 400, `Cannot check in a ${reservation.status} reservation`);

    const room = await prisma.room.findFirst({ where: { id: roomId, propertyId: reservation.propertyId } });
    if (!room) return fail(res, 404, 'Room not found in this property');
    if (room.status === 'Occupied' || room.status === 'OutOfOrder') return fail(res, 400, `Room ${room.number} is ${room.status}`);

    await prisma.$transaction([
      prisma.reservation.update({ where: { id: reservationId }, data: { status: 'CheckedIn', roomId } }),
      prisma.room.update({ where: { id: roomId }, data: { status: 'Occupied' } }),
    ]);
    await writeAudit({ propertyId: reservation.propertyId, actorId: req.auth!.sub, action: 'CHECK_IN', entity: 'Reservation', entityId: reservationId, metadata: { roomId } });
    return ok(res, { reservationId, roomId }, 'Checked in');
  }),
);

router.post(
  '/:reservationId/check-out',
  requireAuth,
  requireRole('FRONT_DESK'),
  asyncHandler(async (req, res) => {
    const { reservationId } = z.object({ reservationId: z.string().min(1) }).parse(req.params);
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        folio: {
          include: {
            charges: { select: { amountMinor: true, quantity: true } },
            payments: { select: { amountMinor: true, refunded: true } },
          },
        },
      },
    });
    if (!reservation) return fail(res, 404, 'Reservation not found');
    if (reservation.propertyId !== req.auth!.propertyId) return fail(res, 403, 'Forbidden');
    if (reservation.status !== 'CheckedIn') return fail(res, 400, `Cannot check out a ${reservation.status} reservation`);

    if (reservation.folio) {
      const chargesTotal = reservation.folio.charges.reduce((s, c) => s + c.amountMinor * c.quantity, 0);
      const paymentsTotal = reservation.folio.payments.filter((p) => !p.refunded).reduce((s, p) => s + p.amountMinor, 0);
      const balance = chargesTotal - paymentsTotal;
      if (balance > 0) {
        return fail(res, 400, 'Unpaid balance on the folio — settle before check-out.');
      }
    }

    const ops: Parameters<typeof prisma.$transaction>[0] = [
      prisma.reservation.update({ where: { id: reservationId }, data: { status: 'CheckedOut' } }),
    ];
    if (reservation.roomId) {
      ops.push(prisma.room.update({ where: { id: reservation.roomId }, data: { status: 'Dirty' } }));
      ops.push(prisma.housekeepingTask.create({ data: { propertyId: reservation.propertyId, roomId: reservation.roomId, type: 'Cleaning', status: 'Pending' } }));
    }
    if (reservation.folio) {
      ops.push(prisma.folio.update({ where: { id: reservation.folio.id }, data: { status: 'Closed' } }));
    }

    await prisma.$transaction(ops);
    await writeAudit({ propertyId: reservation.propertyId, actorId: req.auth!.sub, action: 'CHECK_OUT', entity: 'Reservation', entityId: reservationId });
    return ok(res, { reservationId }, 'Checked out');
  }),
);

export const frontdeskRouter = router;
