import { prisma } from '../../core/prisma';

const DAY = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const isWeekend = (d: Date) => { const g = d.getDay(); return g === 5 || g === 6; }; // Fri/Sat

/** Nights of a stay [checkIn,checkOut) that fall within the window [from,to). */
function overlapNights(checkIn: Date, checkOut: Date, from: Date, to: Date): number {
  const start = Math.max(checkIn.getTime(), from.getTime());
  const end = Math.min(checkOut.getTime(), to.getTime());
  return end <= start ? 0 : Math.round((end - start) / DAY);
}

// ── Period KPIs ───────────────────────────────────────────────────────────────
export interface PeriodMetrics {
  from: string; to: string; nights: number; totalRooms: number;
  roomNightsSold: number; occupancyRate: number; // %
  roomRevenueMinor: number; revenueCollectedMinor: number;
  adrMinor: number; revparMinor: number;
  bookings: number; cancellations: number; noShows: number;
  bySource: { source: string; bookings: number }[];
}

export async function computeMetrics(propertyId: string, from: Date, to: Date): Promise<PeriodMetrics> {
  const f = startOfDay(from); const t = startOfDay(to);
  const nights = Math.max(1, Math.round((t.getTime() - f.getTime()) / DAY));
  const totalRooms = await prisma.room.count({ where: { propertyId } });

  const staying = await prisma.reservation.findMany({
    where: { propertyId, status: { in: ['Booked', 'CheckedIn', 'CheckedOut'] }, checkIn: { lt: t }, checkOut: { gt: f } },
    select: { checkIn: true, checkOut: true, ratePerNightMinor: true },
  });
  let roomNightsSold = 0; let roomRevenueMinor = 0;
  for (const r of staying) {
    const n = overlapNights(r.checkIn, r.checkOut, f, t);
    roomNightsSold += n;
    roomRevenueMinor += n * r.ratePerNightMinor;
  }

  const payments = await prisma.payment.findMany({
    where: { refunded: false, createdAt: { gte: f, lt: t }, folio: { reservation: { propertyId } } },
    select: { amountMinor: true },
  });
  const revenueCollectedMinor = payments.reduce((s, p) => s + p.amountMinor, 0);

  const created = await prisma.reservation.findMany({
    where: { propertyId, createdAt: { gte: f, lt: t } },
    select: { source: true, status: true },
  });
  const bookings = created.length;
  const cancellations = created.filter((r) => r.status === 'Cancelled').length;
  const noShows = created.filter((r) => r.status === 'NoShow').length;
  const sourceMap = new Map<string, number>();
  for (const r of created) sourceMap.set(r.source, (sourceMap.get(r.source) ?? 0) + 1);

  const capacity = totalRooms * nights;
  return {
    from: dayKey(f), to: dayKey(t), nights, totalRooms,
    roomNightsSold,
    occupancyRate: capacity ? Math.round((roomNightsSold / capacity) * 1000) / 10 : 0,
    roomRevenueMinor, revenueCollectedMinor,
    adrMinor: roomNightsSold ? Math.round(roomRevenueMinor / roomNightsSold) : 0,
    revparMinor: capacity ? Math.round(roomRevenueMinor / capacity) : 0,
    bookings, cancellations, noShows,
    bySource: [...sourceMap.entries()].map(([source, b]) => ({ source, bookings: b })).sort((a, b) => b.bookings - a.bookings),
  };
}

// ── Demand forecast + dynamic pricing (transparent, rules-based) ──────────────
export interface ForecastDay {
  date: string; weekend: boolean;
  occupancy: number; // % overall
  demand: 'Very low' | 'Low' | 'Moderate' | 'High' | 'Very high';
  roomTypes: { roomTypeId: string; name: string; available: number; total: number; baseMinor: number; multiplier: number; suggestedMinor: number }[];
}

function demandLabel(occ: number): ForecastDay['demand'] {
  if (occ >= 0.85) return 'Very high';
  if (occ >= 0.7) return 'High';
  if (occ >= 0.5) return 'Moderate';
  if (occ >= 0.3) return 'Low';
  return 'Very low';
}
function priceMultiplier(occ: number, weekend: boolean): number {
  let m = occ >= 0.85 ? 1.25 : occ >= 0.7 ? 1.15 : occ >= 0.5 ? 1.0 : occ >= 0.3 ? 0.95 : 0.85;
  if (weekend) m += 0.05;
  return Math.round(m * 100) / 100;
}

export async function computeForecast(propertyId: string, days: number): Promise<ForecastDay[]> {
  const today = startOfDay(new Date());
  const to = new Date(today.getTime() + days * DAY);
  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId },
    select: { id: true, name: true, basePriceMinor: true, _count: { select: { rooms: true } } },
    orderBy: { name: 'asc' },
  });
  const reservations = await prisma.reservation.findMany({
    where: { propertyId, status: { in: ['Booked', 'CheckedIn'] }, checkIn: { lt: to }, checkOut: { gt: today } },
    select: { roomTypeId: true, checkIn: true, checkOut: true },
  });
  const totalRooms = roomTypes.reduce((s, rt) => s + rt._count.rooms, 0);

  const out: ForecastDay[] = [];
  for (let i = 0; i < days; i++) {
    const night = new Date(today.getTime() + i * DAY);
    const weekend = isWeekend(night);
    let bookedAll = 0;
    const perType = roomTypes.map((rt) => {
      const booked = reservations.filter((r) => r.roomTypeId === rt.id && r.checkIn <= night && r.checkOut > night).length;
      bookedAll += booked;
      const occT = rt._count.rooms ? booked / rt._count.rooms : 0;
      const multiplier = priceMultiplier(occT, weekend);
      return {
        roomTypeId: rt.id, name: rt.name, available: Math.max(0, rt._count.rooms - booked), total: rt._count.rooms,
        baseMinor: rt.basePriceMinor, multiplier, suggestedMinor: Math.round(rt.basePriceMinor * multiplier),
      };
    });
    const occ = totalRooms ? bookedAll / totalRooms : 0;
    out.push({ date: dayKey(night), weekend, occupancy: Math.round(occ * 1000) / 10, demand: demandLabel(occ), roomTypes: perType });
  }
  return out;
}

// ── No-show risk (heuristic, explainable) ─────────────────────────────────────
export interface NoShowRisk {
  reservationId: string; guestName: string; checkIn: string; source: string;
  score: number; // 0..1
  level: 'Low' | 'Medium' | 'High';
  reasons: string[];
}

export async function computeNoShowRisk(propertyId: string): Promise<NoShowRisk[]> {
  const today = startOfDay(new Date());
  const horizon = new Date(today.getTime() + 14 * DAY);

  const upcoming = await prisma.reservation.findMany({
    where: { propertyId, status: 'Booked', checkIn: { gte: today, lt: horizon } },
    include: { guest: { select: { id: true, firstName: true, lastName: true } }, folio: { include: { charges: true, payments: true } } },
    orderBy: { checkIn: 'asc' },
  });

  // Past no-shows per guest (single query, mapped).
  const pastNoShows = await prisma.reservation.findMany({ where: { propertyId, status: 'NoShow' }, select: { guestId: true } });
  const noShowByGuest = new Map<string, number>();
  for (const r of pastNoShows) noShowByGuest.set(r.guestId, (noShowByGuest.get(r.guestId) ?? 0) + 1);

  const otaSources = new Set(['BookingCom', 'Expedia', 'Airbnb', 'OTA', 'Online']);

  const scored = upcoming.map((r): NoShowRisk => {
    const reasons: string[] = [];
    let score = 0.1;

    if (otaSources.has(r.source)) { score += 0.15; reasons.push(`${r.source} booking (higher no-show rate)`); }
    if (r.source === 'Walk-in') { score -= 0.05; }

    const charges = r.folio ? r.folio.charges.reduce((s, c) => s + c.amountMinor * c.quantity, 0) : 0;
    const paid = r.folio ? r.folio.payments.filter((p) => !p.refunded).reduce((s, p) => s + p.amountMinor, 0) : 0;
    if (charges > 0 && paid === 0) { score += 0.2; reasons.push('No deposit paid'); }
    else if (paid > 0 && paid < charges) { score += 0.05; reasons.push('Partial deposit only'); }
    else if (paid >= charges && charges > 0) { score -= 0.1; reasons.push('Fully prepaid'); }

    const leadDays = Math.round((r.checkIn.getTime() - r.createdAt.getTime()) / DAY);
    if (leadDays >= 30) { score += 0.1; reasons.push(`Booked ${leadDays} days ahead`); }

    const prior = noShowByGuest.get(r.guestId) ?? 0;
    if (prior > 0) { score += Math.min(0.3, prior * 0.15); reasons.push(`${prior} prior no-show${prior > 1 ? 's' : ''}`); }

    score = Math.max(0.02, Math.min(0.95, score));
    const level: NoShowRisk['level'] = score >= 0.55 ? 'High' : score >= 0.3 ? 'Medium' : 'Low';
    if (reasons.length === 0) reasons.push('No elevated risk factors');

    return {
      reservationId: r.id,
      guestName: `${r.guest.firstName} ${r.guest.lastName}`,
      checkIn: dayKey(r.checkIn),
      source: r.source,
      score: Math.round(score * 100) / 100,
      level,
      reasons,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 25);
}
