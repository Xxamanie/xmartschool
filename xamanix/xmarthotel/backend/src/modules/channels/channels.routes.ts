import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';
import { computeAvailability } from './availability';
import { adapterFor, AvailabilityUpdate } from './adapters';

const router = Router();
const propertyOf = (req: Request): string | null => req.auth?.propertyId ?? null;
const isValidDate = (s: string) => !isNaN(new Date(s).getTime());

/** Never leak raw OTA credentials to the client. */
const publicChannel = (c: {
  id: string; type: string; name: string; status: string; ingestToken: string;
  credentials: unknown; roomTypeMap: unknown; lastSyncAt: Date | null; lastSyncOk: boolean | null; lastSyncMsg: string | null;
}) => ({
  id: c.id, type: c.type, name: c.name, status: c.status,
  ingestToken: c.ingestToken,
  hasCredentials: Boolean(c.credentials),
  roomTypeMap: (c.roomTypeMap as Record<string, string> | null) ?? {},
  lastSyncAt: c.lastSyncAt, lastSyncOk: c.lastSyncOk, lastSyncMsg: c.lastSyncMsg,
});

// ── List / create / update ────────────────────────────────────────────────────
router.get(
  '/',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const channels = await prisma.channel.findMany({ where: { propertyId }, orderBy: { createdAt: 'asc' } });
    return ok(res, channels.map(publicChannel));
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
      type: z.enum(['BookingCom', 'Expedia', 'Airbnb', 'Generic']),
      name: z.string().min(1),
      roomTypeMap: z.record(z.string()).optional(),
      credentials: z.record(z.any()).optional(),
    }).parse(req.body);
    const channel = await prisma.channel.create({
      data: { propertyId, type: body.type, name: body.name, roomTypeMap: body.roomTypeMap ?? {}, credentials: body.credentials },
    });
    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'CREATE_CHANNEL', entity: 'Channel', entityId: channel.id });
    return ok(res, publicChannel(channel), 'Channel connected');
  }),
);

router.patch(
  '/:id',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const propertyId = propertyOf(req);
    const existing = await prisma.channel.findFirst({ where: { id, propertyId: propertyId ?? undefined } });
    if (!existing) return fail(res, 404, 'Channel not found');
    const body = z.object({
      name: z.string().min(1).optional(),
      status: z.enum(['Active', 'Paused']).optional(),
      roomTypeMap: z.record(z.string()).optional(),
      credentials: z.record(z.any()).optional(),
    }).parse(req.body);
    const channel = await prisma.channel.update({ where: { id }, data: body });
    await writeAudit({ propertyId: existing.propertyId, actorId: req.auth!.sub, action: 'UPDATE_CHANNEL', entity: 'Channel', entityId: id });
    return ok(res, publicChannel(channel), 'Channel updated');
  }),
);

// ── Availability (ARI) calendar ───────────────────────────────────────────────
router.get(
  '/availability',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const q = z.object({ from: z.string().optional(), to: z.string().optional() }).parse(req.query);
    const from = q.from && isValidDate(q.from) ? new Date(q.from) : new Date();
    const to = q.to && isValidDate(q.to) ? new Date(q.to) : new Date(Date.now() + 14 * 86_400_000);
    const availability = await computeAvailability(propertyId, from, to);
    return ok(res, availability);
  }),
);

// ── Push availability/rates to the OTA ────────────────────────────────────────
router.post(
  '/:id/sync',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const propertyId = propertyOf(req);
    const channel = await prisma.channel.findFirst({ where: { id, propertyId: propertyId ?? undefined } });
    if (!channel) return fail(res, 404, 'Channel not found');

    const from = new Date();
    const to = new Date(Date.now() + 30 * 86_400_000);
    const availability = await computeAvailability(channel.propertyId, from, to);

    const updates: AvailabilityUpdate[] = availability.flatMap((rt) =>
      rt.calendar.map((c) => ({ roomTypeId: rt.roomTypeId, date: c.date, available: c.available, ratePerNightMinor: rt.basePriceMinor })),
    );

    const result = await adapterFor(channel).pushAvailability(updates);
    const updated = await prisma.channel.update({
      where: { id },
      data: { lastSyncAt: new Date(), lastSyncOk: result.ok, lastSyncMsg: result.message },
    });
    await writeAudit({ propertyId: channel.propertyId, actorId: req.auth!.sub, action: 'SYNC_CHANNEL', entity: 'Channel', entityId: id, metadata: { rows: updates.length, ok: result.ok } });
    return ok(res, { ...publicChannel(updated), rows: updates.length }, result.message);
  }),
);

// ── Inbound: receive a booking from the OTA (token-secured, no JWT) ────────────
const ingestSchema = z.object({
  externalRef: z.string().min(1),
  otaRoomCode: z.string().min(1),
  checkIn: z.string().refine(isValidDate),
  checkOut: z.string().refine(isValidDate),
  guest: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }),
  adults: z.number().int().min(1).optional(),
  children: z.number().int().min(0).optional(),
  ratePerNightMinor: z.number().int().min(0).optional(),
});

router.post(
  '/:id/ingest',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const token = (req.headers['x-channel-token'] as string | undefined) || (req.query.token as string | undefined);
    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel || !token || token !== channel.ingestToken) return fail(res, 401, 'Invalid channel token');

    const body = ingestSchema.parse(req.body);

    // Idempotent on the OTA's booking id for this channel.
    const dupe = await prisma.reservation.findFirst({ where: { channelId: channel.id, externalRef: body.externalRef } });
    if (dupe) return ok(res, { reservationId: dupe.id, duplicate: true }, 'Already ingested');

    const map = (channel.roomTypeMap as Record<string, string> | null) ?? {};
    const roomTypeId = map[body.otaRoomCode];
    if (!roomTypeId) return fail(res, 400, `No room-type mapping for OTA code "${body.otaRoomCode}"`);
    const roomType = await prisma.roomType.findFirst({ where: { id: roomTypeId, propertyId: channel.propertyId } });
    if (!roomType) return fail(res, 400, 'Mapped room type not found');

    const guest =
      (body.guest.phone ? await prisma.guest.findFirst({ where: { propertyId: channel.propertyId, phone: body.guest.phone } }) : null) ??
      (await prisma.guest.create({
        data: { propertyId: channel.propertyId, firstName: body.guest.firstName, lastName: body.guest.lastName, phone: body.guest.phone, email: body.guest.email },
      }));

    const checkIn = new Date(body.checkIn);
    const checkOut = new Date(body.checkOut);
    const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000));
    const rate = body.ratePerNightMinor ?? roomType.basePriceMinor;

    const reservation = await prisma.reservation.create({
      data: {
        propertyId: channel.propertyId,
        guestId: guest.id,
        roomTypeId,
        channelId: channel.id,
        externalRef: body.externalRef,
        checkIn,
        checkOut,
        adults: body.adults ?? 1,
        children: body.children ?? 0,
        ratePerNightMinor: rate,
        source: channel.type,
        folio: { create: { charges: { create: { description: `Room — ${nights} night(s)`, amountMinor: rate, quantity: nights } } } },
      },
      select: { id: true },
    });
    await writeAudit({ propertyId: channel.propertyId, actorId: null, action: 'CHANNEL_BOOKING', entity: 'Reservation', entityId: reservation.id, metadata: { channelId: channel.id, externalRef: body.externalRef } });
    return ok(res, { reservationId: reservation.id, duplicate: false }, 'Booking ingested');
  }),
);

export const channelsRouter = router;
