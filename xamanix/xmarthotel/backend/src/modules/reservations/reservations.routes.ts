import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';

const router = Router();
const propertyOf = (req: { auth?: { propertyId?: string | null } }): string | null =>
  req.auth?.propertyId ?? null;

const isValidDate = (s: string) => !isNaN(new Date(s).getTime());

router.get(
  '/',
  requireAuth,
  requireRole('FRONT_DESK', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const reservations = await prisma.reservation.findMany({
      where: { propertyId },
      include: {
        guest: { select: { firstName: true, lastName: true, phone: true } },
        roomType: { select: { name: true } },
        room: { select: { number: true } },
      },
      orderBy: { checkIn: 'desc' },
      take: 500,
    });
    return ok(res, reservations);
  }),
);

const createSchema = z
  .object({
    guestId: z.string().min(1).optional(),
    guest: z
      .object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        idType: z.string().optional(),
        idNumber: z.string().optional(),
        address: z.string().optional(),
      })
      .optional(),
    roomTypeId: z.string().min(1),
    checkIn: z.string().refine(isValidDate, { message: 'Invalid check-in date' }),
    checkOut: z.string().refine(isValidDate, { message: 'Invalid check-out date' }),
    adults: z.number().int().min(1).optional(),
    children: z.number().int().min(0).optional(),
    ratePerNightMinor: z.number().int().min(0).optional(),
    source: z.string().optional(),
    specialRequests: z.string().optional(),
  })
  .refine((d) => d.guestId || d.guest, { message: 'Either guestId or guest details are required' });

router.post(
  '/',
  requireAuth,
  requireRole('FRONT_DESK'),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const body = createSchema.parse(req.body);

    if (new Date(body.checkOut) <= new Date(body.checkIn)) {
      return fail(res, 400, 'Check-out must be after check-in');
    }

    const roomType = await prisma.roomType.findFirst({ where: { id: body.roomTypeId, propertyId } });
    if (!roomType) return fail(res, 404, 'Room type not found');

    let guestId: string;
    if (body.guestId) {
      const existing = await prisma.guest.findFirst({ where: { id: body.guestId, propertyId } });
      if (!existing) return fail(res, 404, 'Guest not found');
      guestId = existing.id;
    } else {
      const g = body.guest!;
      const newGuest = await prisma.guest.create({
        data: {
          propertyId,
          firstName: g.firstName,
          lastName: g.lastName,
          email: g.email,
          phone: g.phone,
          idType: g.idType,
          idNumber: g.idNumber,
          address: g.address,
        },
      });
      guestId = newGuest.id;
    }

    const reservation = await prisma.reservation.create({
      data: {
        propertyId,
        guestId,
        roomTypeId: body.roomTypeId,
        checkIn: new Date(body.checkIn),
        checkOut: new Date(body.checkOut),
        adults: body.adults ?? 1,
        children: body.children ?? 0,
        ratePerNightMinor: body.ratePerNightMinor ?? roomType.basePriceMinor,
        source: body.source ?? 'Walk-in',
        specialRequests: body.specialRequests,
        createdById: req.auth!.sub,
        folio: { create: {} },
      },
      include: { guest: true, roomType: true, folio: true },
    });

    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'CREATE_RESERVATION', entity: 'Reservation', entityId: reservation.id });
    return ok(res, reservation, 'Reservation created');
  }),
);

router.get(
  '/:id',
  requireAuth,
  requireRole('FRONT_DESK', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const reservation = await prisma.reservation.findFirst({
      where: { id, propertyId },
      include: { guest: true, roomType: true, room: true, folio: { include: { charges: true, payments: true } } },
    });
    if (!reservation) return fail(res, 404, 'Reservation not found');
    return ok(res, reservation);
  }),
);

router.post(
  '/:id/cancel',
  requireAuth,
  requireRole('FRONT_DESK'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const existing = await prisma.reservation.findFirst({ where: { id, propertyId } });
    if (!existing) return fail(res, 404, 'Reservation not found');
    if (existing.status !== 'Booked') return fail(res, 400, `Cannot cancel a ${existing.status} reservation`);
    const reservation = await prisma.reservation.update({ where: { id }, data: { status: 'Cancelled' } });
    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'CANCEL_RESERVATION', entity: 'Reservation', entityId: id });
    return ok(res, reservation, 'Reservation cancelled');
  }),
);

export const reservationsRouter = router;
