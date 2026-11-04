import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password1', 10);

  // ── Property ────────────────────────────────────────────────────────────--
  let property = await prisma.property.findFirst({ where: { name: 'XmartHotel Demo' } });
  if (!property) {
    property = await prisma.property.create({
      data: { name: 'XmartHotel Demo', address: '1 Marina Road', city: 'Lagos', country: 'Nigeria', currency: 'NGN', taxRate: 5 },
    });
  }
  const propertyId = property.id;

  // ── Users (one per role) ────────────────────────────────────────────────--
  const users: { name: string; email: string; role: any }[] = [
    { name: 'Hotel Owner', email: 'admin@xmarthotel.demo', role: 'OWNER' },
    { name: 'Grace Manager', email: 'manager@xmarthotel.demo', role: 'MANAGER' },
    { name: 'Frank Desk', email: 'frontdesk@xmarthotel.demo', role: 'FRONT_DESK' },
    { name: 'Helen Keeper', email: 'housekeeping@xmarthotel.demo', role: 'HOUSEKEEPING' },
    { name: 'Andy Counts', email: 'accountant@xmarthotel.demo', role: 'ACCOUNTANT' },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, propertyId, active: true },
      create: { name: u.name, email: u.email, role: u.role, propertyId, passwordHash },
    });
  }

  // ── Room types ──────────────────────────────────────────────────────────--
  const typeDefs = [
    { name: 'Standard', basePriceMinor: 2_500_000, capacity: 2, amenities: ['WiFi', 'AC', 'TV'] },
    { name: 'Deluxe', basePriceMinor: 4_500_000, capacity: 3, amenities: ['WiFi', 'AC', 'TV', 'Minibar'] },
    { name: 'Suite', basePriceMinor: 8_000_000, capacity: 4, amenities: ['WiFi', 'AC', 'TV', 'Minibar', 'Lounge'] },
  ];
  const roomTypes: Record<string, string> = {};
  for (const t of typeDefs) {
    const rt = await prisma.roomType.upsert({
      where: { propertyId_name: { propertyId, name: t.name } },
      update: { basePriceMinor: t.basePriceMinor, capacity: t.capacity, amenities: t.amenities },
      create: { propertyId, name: t.name, basePriceMinor: t.basePriceMinor, capacity: t.capacity, amenities: t.amenities },
    });
    roomTypes[t.name] = rt.id;
  }

  // ── Rooms ───────────────────────────────────────────────────────────────--
  const roomDefs = [
    ...['101', '102', '103', '104'].map((n) => ({ number: n, type: 'Standard', floor: '1' })),
    ...['201', '202', '203'].map((n) => ({ number: n, type: 'Deluxe', floor: '2' })),
    ...['301', '302'].map((n) => ({ number: n, type: 'Suite', floor: '3' })),
  ];
  const rooms: Record<string, string> = {};
  for (const r of roomDefs) {
    const room = await prisma.room.upsert({
      where: { propertyId_number: { propertyId, number: r.number } },
      update: { roomTypeId: roomTypes[r.type], floor: r.floor },
      create: { propertyId, number: r.number, roomTypeId: roomTypes[r.type], floor: r.floor },
    });
    rooms[r.number] = room.id;
  }

  // ── Sample demand (only seed once) ──────────────────────────────────────--
  const existingReservations = await prisma.reservation.count({ where: { propertyId } });
  if (existingReservations === 0) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 2);

    // In-house guest occupying room 201
    const guest1 = await prisma.guest.create({
      data: { propertyId, firstName: 'Amaka', lastName: 'Obi', phone: '+2348030000001', loyaltyTier: 'Gold' },
    });
    const res1 = await prisma.reservation.create({
      data: {
        propertyId, guestId: guest1.id, roomTypeId: roomTypes['Deluxe'], roomId: rooms['201'],
        status: 'CheckedIn', checkIn: today, checkOut: tomorrow, ratePerNightMinor: 4_500_000, source: 'Online',
        folio: { create: { charges: { create: { description: 'Room — 2 nights', amountMinor: 9_000_000, quantity: 1 } } } },
      },
      include: { folio: true },
    });
    await prisma.room.update({ where: { id: rooms['201'] }, data: { status: 'Occupied' } });
    if (res1.folio) {
      await prisma.payment.create({ data: { folioId: res1.folio.id, amountMinor: 5_000_000, method: 'Card', reference: 'DEMO-DEPOSIT' } });
    }

    // Upcoming arrival
    const guest2 = await prisma.guest.create({
      data: { propertyId, firstName: 'Tunde', lastName: 'Bello', phone: '+2348030000002' },
    });
    await prisma.reservation.create({
      data: {
        propertyId, guestId: guest2.id, roomTypeId: roomTypes['Standard'],
        status: 'Booked', checkIn: today, checkOut: tomorrow, ratePerNightMinor: 2_500_000, source: 'Phone',
        folio: { create: {} },
      },
    });

    // Dirty room awaiting housekeeping
    await prisma.room.update({ where: { id: rooms['102'] }, data: { status: 'Dirty' } });
    await prisma.housekeepingTask.create({ data: { propertyId, roomId: rooms['102'], type: 'Cleaning' } });
  }

  // ── Reference data ──────────────────────────────────────────────────────--
  const dept = await prisma.department.findFirst({ where: { propertyId, name: 'Front Office' } });
  if (!dept) await prisma.department.create({ data: { propertyId, name: 'Front Office' } });

  const menuCount = await prisma.menuItem.count({ where: { propertyId } });
  if (menuCount === 0) {
    await prisma.menuItem.createMany({
      data: [
        { propertyId, name: 'Jollof Rice & Chicken', category: 'Food', priceMinor: 450_000 },
        { propertyId, name: 'Club Sandwich', category: 'Food', priceMinor: 350_000 },
        { propertyId, name: 'Bottled Water', category: 'Drink', priceMinor: 50_000 },
      ],
    });
  }

  const invCount = await prisma.inventoryItem.count({ where: { propertyId } });
  if (invCount === 0) {
    await prisma.inventoryItem.createMany({
      data: [
        { propertyId, name: 'Bath Towel', category: 'Linen', unit: 'pcs', quantity: 120, reorderLevel: 40 },
        { propertyId, name: 'Toilet Roll', category: 'Consumable', unit: 'pcs', quantity: 30, reorderLevel: 50 },
        { propertyId, name: 'Shampoo Sachet', category: 'Amenity', unit: 'pcs', quantity: 200, reorderLevel: 60 },
      ],
    });
  }

  console.log('✅ Seed complete. Login: admin@xmarthotel.demo / Password1');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
