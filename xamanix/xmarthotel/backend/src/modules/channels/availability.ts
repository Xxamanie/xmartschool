import { prisma } from '../../core/prisma';

export interface RoomTypeAvailability {
  roomTypeId: string;
  name: string;
  totalRooms: number;
  basePriceMinor: number;
  calendar: { date: string; available: number }[];
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function enumerateDays(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/**
 * Compute per-room-type availability for each night in [from, to).
 * Available(type, night) = totalRoomsOfType − reservations of that type that
 * occupy the night (checkIn <= night < checkOut, excluding cancelled/no-show).
 * This is the inventory we push to OTAs and never let drop below zero.
 */
export async function computeAvailability(propertyId: string, from: Date, to: Date): Promise<RoomTypeAvailability[]> {
  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId },
    select: { id: true, name: true, basePriceMinor: true, _count: { select: { rooms: true } } },
    orderBy: { name: 'asc' },
  });

  const reservations = await prisma.reservation.findMany({
    where: {
      propertyId,
      status: { in: ['Booked', 'CheckedIn'] },
      checkIn: { lt: to },
      checkOut: { gt: from },
    },
    select: { roomTypeId: true, checkIn: true, checkOut: true },
  });

  const days = enumerateDays(from, to);

  return roomTypes.map((rt) => {
    const total = rt._count.rooms;
    const calendar = days.map((d) => {
      const nightStart = new Date(d); nightStart.setHours(0, 0, 0, 0);
      const booked = reservations.filter(
        (r) => r.roomTypeId === rt.id && r.checkIn <= nightStart && r.checkOut > nightStart,
      ).length;
      return { date: dayKey(nightStart), available: Math.max(0, total - booked) };
    });
    return { roomTypeId: rt.id, name: rt.name, totalRooms: total, basePriceMinor: rt.basePriceMinor, calendar };
  });
}
