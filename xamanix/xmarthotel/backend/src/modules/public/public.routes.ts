import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';
import { env } from '../../core/env';
import { paystackEnabled, initTransaction, verifyTransaction, recordPaystackPayment } from '../payments/paystack.service';
import { sendBookingConfirmation } from '../notifications/termii.service';

/**
 * Public, UNAUTHENTICATED endpoints for guest-facing experiences:
 *  - Direct booking engine (commission-free reservations on the hotel's own site)
 *  - QR room-service ordering (guest scans a room QR, orders to their folio)
 *
 * These intentionally require no JWT. They are property-scoped by URL param and
 * rate-limited at the server layer. They never expose internal/staff data.
 */
const router = Router();

const isValidDate = (s: string) => !isNaN(new Date(s).getTime());

// ── Discovery ─────────────────────────────────────────────────────────────────
router.get(
  '/properties',
  asyncHandler(async (_req, res) => {
    const properties = await prisma.property.findMany({
      select: { id: true, name: true, city: true, country: true, currency: true },
      orderBy: { name: 'asc' },
    });
    return ok(res, properties);
  }),
);

router.get(
  '/properties/:propertyId/room-types',
  asyncHandler(async (req, res) => {
    const { propertyId } = z.object({ propertyId: z.string().min(1) }).parse(req.params);
    const types = await prisma.roomType.findMany({
      where: { propertyId },
      select: { id: true, name: true, description: true, basePriceMinor: true, capacity: true, amenities: true },
      orderBy: { basePriceMinor: 'asc' },
    });
    return ok(res, types);
  }),
);

// ── Direct booking engine ─────────────────────────────────────────────────────
const bookingSchema = z.object({
  guest: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().min(3),
  }),
  roomTypeId: z.string().min(1),
  checkIn: z.string().refine(isValidDate, { message: 'Invalid check-in date' }),
  checkOut: z.string().refine(isValidDate, { message: 'Invalid check-out date' }),
  adults: z.number().int().min(1).max(20).optional(),
  children: z.number().int().min(0).max(20).optional(),
  specialRequests: z.string().max(500).optional(),
});

router.post(
  '/properties/:propertyId/bookings',
  asyncHandler(async (req, res) => {
    const { propertyId } = z.object({ propertyId: z.string().min(1) }).parse(req.params);
    const body = bookingSchema.parse(req.body);

    const checkIn = new Date(body.checkIn);
    const checkOut = new Date(body.checkOut);
    if (checkOut <= checkIn) return fail(res, 400, 'Check-out must be after check-in');
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (checkIn < startOfToday) return fail(res, 400, 'Check-in cannot be in the past');

    const roomType = await prisma.roomType.findFirst({ where: { id: body.roomTypeId, propertyId } });
    if (!roomType) return fail(res, 404, 'Room type not available at this property');

    // Reuse an existing guest record (same property + phone) or create one.
    const guest =
      (await prisma.guest.findFirst({ where: { propertyId, phone: body.guest.phone } })) ??
      (await prisma.guest.create({
        data: {
          propertyId,
          firstName: body.guest.firstName,
          lastName: body.guest.lastName,
          email: body.guest.email,
          phone: body.guest.phone,
        },
      }));

    const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000));

    const reservation = await prisma.reservation.create({
      data: {
        propertyId,
        guestId: guest.id,
        roomTypeId: body.roomTypeId,
        checkIn,
        checkOut,
        adults: body.adults ?? 1,
        children: body.children ?? 0,
        ratePerNightMinor: roomType.basePriceMinor,
        source: 'Direct',
        specialRequests: body.specialRequests,
        folio: { create: { charges: { create: { description: `Room — ${nights} night(s)`, amountMinor: roomType.basePriceMinor, quantity: nights } } } },
      },
      select: { id: true, checkIn: true, checkOut: true, ratePerNightMinor: true },
    });

    await writeAudit({ propertyId, actorId: null, action: 'DIRECT_BOOKING', entity: 'Reservation', entityId: reservation.id });

    // Confirmation reference (short, human-friendly).
    const reference = reservation.id.slice(-8).toUpperCase();

    // Notify the guest (non-blocking; no-op when Termii is unconfigured).
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { name: true } });
    sendBookingConfirmation({
      phone: guest.phone,
      guestName: guest.firstName,
      propertyName: property?.name ?? 'the hotel',
      reference,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
    });
    return ok(
      res,
      {
        reference,
        reservationId: reservation.id,
        roomType: roomType.name,
        nights,
        totalMinor: roomType.basePriceMinor * nights,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
      },
      'Booking confirmed',
    );
  }),
);

// ── QR room-service ordering ──────────────────────────────────────────────────
router.get(
  '/properties/:propertyId/menu',
  asyncHandler(async (req, res) => {
    const { propertyId } = z.object({ propertyId: z.string().min(1) }).parse(req.params);
    const items = await prisma.menuItem.findMany({
      where: { propertyId, available: true },
      select: { id: true, name: true, category: true, priceMinor: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return ok(res, items);
  }),
);

const roomServiceSchema = z.object({
  roomNumber: z.string().min(1),
  items: z.array(z.object({ menuItemId: z.string().min(1), quantity: z.number().int().min(1).max(50) })).min(1),
  note: z.string().max(300).optional(),
});

router.post(
  '/properties/:propertyId/room-service',
  asyncHandler(async (req, res) => {
    const { propertyId } = z.object({ propertyId: z.string().min(1) }).parse(req.params);
    const body = roomServiceSchema.parse(req.body);

    const menuItems = await prisma.menuItem.findMany({ where: { propertyId, available: true, id: { in: body.items.map((i) => i.menuItemId) } } });
    const priceById = new Map(menuItems.map((m) => [m.id, m.priceMinor]));
    if (priceById.size !== new Set(body.items.map((i) => i.menuItemId)).size) return fail(res, 400, 'One or more items are unavailable');

    // Try to attach the order to the in-house reservation occupying this room.
    const room = await prisma.room.findFirst({ where: { propertyId, number: body.roomNumber } });
    const reservation = room
      ? await prisma.reservation.findFirst({ where: { propertyId, roomId: room.id, status: 'CheckedIn' }, include: { folio: true } })
      : null;

    const order = await prisma.kitchenOrder.create({
      data: {
        propertyId,
        reservationId: reservation?.id,
        tableLabel: `Room ${body.roomNumber}`,
        items: { create: body.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, priceMinor: priceById.get(i.menuItemId)! })) },
      },
      include: { items: true },
    });

    // Post to the guest folio when we found an open one.
    if (reservation?.folio && reservation.folio.status === 'Open') {
      const total = order.items.reduce((s, it) => s + it.priceMinor * it.quantity, 0);
      await prisma.folioCharge.create({ data: { folioId: reservation.folio.id, description: `Room service — order #${order.id.slice(-6)}`, amountMinor: total } });
    }

    await writeAudit({ propertyId, actorId: null, action: 'ROOM_SERVICE_ORDER', entity: 'KitchenOrder', entityId: order.id, metadata: { roomNumber: body.roomNumber, postedToFolio: Boolean(reservation?.folio) } });

    return ok(
      res,
      { orderId: order.id, reference: order.id.slice(-6).toUpperCase(), postedToFolio: Boolean(reservation?.folio), matchedReservation: Boolean(reservation) },
      'Order received',
    );
  }),
);

// ── Direct-booking online payment (Paystack hosted checkout) ──────────────────
router.post(
  '/properties/:propertyId/reservations/:reservationId/pay',
  asyncHandler(async (req, res) => {
    if (!paystackEnabled()) return fail(res, 503, 'Online payments are not configured');
    const { propertyId, reservationId } = z.object({ propertyId: z.string().min(1), reservationId: z.string().min(1) }).parse(req.params);

    const reservation = await prisma.reservation.findFirst({
      where: { id: reservationId, propertyId },
      include: { guest: { select: { email: true, phone: true } }, folio: { include: { charges: true, payments: true } } },
    });
    if (!reservation || !reservation.folio) return fail(res, 404, 'Reservation not found');

    const charges = reservation.folio.charges.reduce((s, c) => s + c.amountMinor * c.quantity, 0);
    const paid = reservation.folio.payments.filter((p) => !p.refunded).reduce((s, p) => s + p.amountMinor, 0);
    const balance = charges - paid;
    if (balance <= 0) return fail(res, 400, 'This booking is already paid');

    const init = await initTransaction({
      amountMinor: balance,
      email: reservation.guest.email || `guest${(reservation.guest.phone ?? '').replace(/\D/g, '') || 'anon'}@guest.xmarthotel`,
      callbackUrl: `${env.publicBaseUrl}/payment/callback`,
      metadata: { folioId: reservation.folio.id, context: 'booking' },
    });
    return ok(res, init, 'Payment initialized');
  }),
);

router.get(
  '/pay/verify',
  asyncHandler(async (req, res) => {
    if (!paystackEnabled()) return fail(res, 503, 'Online payments are not configured');
    const { reference } = z.object({ reference: z.string().min(1) }).parse(req.query);
    const result = await verifyTransaction(reference);
    if (result.status !== 'success') return ok(res, { status: result.status, recorded: false }, 'Payment not successful');

    const folioId = (result.metadata as { folioId?: string } | null)?.folioId;
    if (!folioId) return fail(res, 400, 'Payment is missing folio metadata');
    const { recorded, alreadyRecorded } = await recordPaystackPayment({ folioId, amountMinor: result.amountMinor, reference: result.reference });
    return ok(res, { status: 'success', recorded, alreadyRecorded }, 'Payment verified');
  }),
);

export const publicRouter = router;
