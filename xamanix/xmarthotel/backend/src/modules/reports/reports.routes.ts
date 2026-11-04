import { Router } from 'express';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';

const router = Router();
const propertyOf = (req: any): string | null => req.auth?.propertyId ?? null;

const dayBounds = (d = new Date()) => {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

router.get(
  '/dashboard',
  requireAuth,
  requireRole('ACCOUNTANT'), // OWNER & MANAGER always pass requireRole
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const { start, end } = dayBounds();

    const [rooms, inHouse, arrivalsToday, departuresToday, paymentsToday] = await Promise.all([
      prisma.room.findMany({ where: { propertyId }, select: { status: true } }),
      prisma.reservation.findMany({ where: { propertyId, status: 'CheckedIn' }, select: { ratePerNightMinor: true } }),
      prisma.reservation.count({ where: { propertyId, status: 'Booked', checkIn: { gte: start, lt: end } } }),
      prisma.reservation.count({ where: { propertyId, status: 'CheckedIn', checkOut: { gte: start, lt: end } } }),
      prisma.payment.findMany({ where: { refunded: false, createdAt: { gte: start, lt: end }, folio: { reservation: { propertyId } } }, select: { amountMinor: true } }),
    ]);

    const totalRooms = rooms.length;
    const byStatus = rooms.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});
    const occupied = byStatus['Occupied'] ?? 0;
    const roomsSold = inHouse.length;
    // Blended rate: weighted average of contracted nightly rates for occupied rooms tonight.
    // Not the industry-standard ADR (which uses actual collected revenue over a period).
    const roomRevenueMinor = inHouse.reduce((sum, r) => sum + r.ratePerNightMinor, 0);
    const revenueTodayMinor = paymentsToday.reduce((sum, p) => sum + p.amountMinor, 0);

    return ok(res, {
      totalRooms,
      roomsByStatus: {
        available: byStatus['Available'] ?? 0,
        occupied,
        dirty: byStatus['Dirty'] ?? 0,
        cleaning: byStatus['Cleaning'] ?? 0,
        outOfOrder: byStatus['OutOfOrder'] ?? 0,
      },
      occupancyRate: totalRooms ? Math.round((occupied / totalRooms) * 1000) / 10 : 0, // %
      adrMinor: roomsSold ? Math.round(roomRevenueMinor / roomsSold) : 0,   // avg contracted rate tonight
      revparMinor: totalRooms ? Math.round(roomRevenueMinor / totalRooms) : 0, // room revenue / total rooms
      arrivalsToday,
      departuresToday,
      inHouse: roomsSold,
      revenueTodayMinor,
    });
  }),
);

router.get(
  '/revenue',
  requireAuth,
  requireRole('ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const days = Math.min(Math.max(Number(req.query.days ?? 14), 1), 90);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const payments = await prisma.payment.findMany({
      where: { refunded: false, createdAt: { gte: since }, folio: { reservation: { propertyId } } },
      select: { amountMinor: true, createdAt: true },
    });

    const buckets: Record<string, number> = {};
    for (const p of payments) {
      const key = p.createdAt.toISOString().slice(0, 10);
      buckets[key] = (buckets[key] ?? 0) + p.amountMinor;
    }
    const series = Object.entries(buckets)
      .map(([date, amountMinor]) => ({ date, amountMinor }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return ok(res, { days, totalMinor: payments.reduce((s, p) => s + p.amountMinor, 0), series });
  }),
);

export const reportsRouter = router;
