import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';

const router = Router();
const propertyOf = (req: Request): string | null => req.auth?.propertyId ?? null;

router.get(
  '/',
  requireAuth,
  requireRole('FRONT_DESK'),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const q = (req.query.q as string | undefined)?.trim();
    const guests = await prisma.guest.findMany({
      where: {
        propertyId,
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return ok(res, guests);
  }),
);

router.get(
  '/:id',
  requireAuth,
  requireRole('FRONT_DESK'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const guest = await prisma.guest.findFirst({
      where: { id, propertyId },
      include: {
        reservations: {
          select: { id: true, status: true, checkIn: true, checkOut: true, roomType: { select: { name: true } } },
          orderBy: { checkIn: 'desc' },
        },
      },
    });
    if (!guest) return fail(res, 404, 'Guest not found');
    return ok(res, guest);
  }),
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('FRONT_DESK'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const body = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional(),
      idType: z.string().optional(),
      idNumber: z.string().optional(),
      address: z.string().optional(),
      loyaltyTier: z.enum(['None', 'Silver', 'Gold', 'Platinum']).optional(),
      notes: z.string().optional(),
    }).parse(req.body);
    const existing = await prisma.guest.findFirst({ where: { id, propertyId } });
    if (!existing) return fail(res, 404, 'Guest not found');
    const guest = await prisma.guest.update({ where: { id }, data: body });
    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'UPDATE_GUEST', entity: 'Guest', entityId: id });
    return ok(res, guest, 'Guest updated');
  }),
);

export const guestsRouter = router;
