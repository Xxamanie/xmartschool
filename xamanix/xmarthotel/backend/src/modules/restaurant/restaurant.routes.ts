import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';

const router = Router();
const propertyOf = (req: Request): string | null => req.auth?.propertyId ?? null;

// ── Menu ──────────────────────────────────────────────────────────────────--
router.get(
  '/menu',
  requireAuth,
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const items = await prisma.menuItem.findMany({ where: { propertyId }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    return ok(res, items);
  }),
);

router.post(
  '/menu',
  requireAuth,
  requireRole(), // manager+
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const body = z.object({
      name: z.string().min(1),
      category: z.string().optional(),
      priceMinor: z.number().int().min(0),
      available: z.boolean().optional(),
    }).parse(req.body);
    const item = await prisma.menuItem.create({
      data: { propertyId, name: body.name, category: body.category ?? 'Food', priceMinor: body.priceMinor, available: body.available ?? true },
    });
    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'CREATE_MENU_ITEM', entity: 'MenuItem', entityId: item.id });
    return ok(res, item, 'Menu item created');
  }),
);

// ── Kitchen orders ────────────────────────────────────────────────────────--
router.get(
  '/orders',
  requireAuth,
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const orders = await prisma.kitchenOrder.findMany({
      where: { propertyId },
      include: { items: { include: { menuItem: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return ok(res, orders);
  }),
);

router.post(
  '/orders',
  requireAuth,
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const body = z.object({
      reservationId: z.string().optional(),
      tableLabel: z.string().optional(),
      items: z.array(z.object({ menuItemId: z.string().min(1), quantity: z.number().int().min(1) })).min(1),
    }).parse(req.body);

    const menuItems = await prisma.menuItem.findMany({ where: { propertyId, id: { in: body.items.map((i) => i.menuItemId) } } });
    const priceById = new Map(menuItems.map((m) => [m.id, m.priceMinor]));
    if (priceById.size !== new Set(body.items.map((i) => i.menuItemId)).size) return fail(res, 400, 'One or more menu items not found');

    // Validate the reservation belongs to this property before attaching charges.
    if (body.reservationId) {
      const res_ = await prisma.reservation.findFirst({ where: { id: body.reservationId, propertyId } });
      if (!res_) return fail(res, 404, 'Reservation not found');
    }

    const order = await prisma.kitchenOrder.create({
      data: {
        propertyId,
        reservationId: body.reservationId,
        tableLabel: body.tableLabel,
        items: { create: body.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, priceMinor: priceById.get(i.menuItemId)! })) },
      },
      include: { items: true },
    });

    // Post the order total to the guest folio when tied to a reservation.
    if (body.reservationId) {
      const folio = await prisma.folio.findFirst({ where: { reservationId: body.reservationId, status: 'Open' } });
      if (folio) {
        const total = order.items.reduce((s, it) => s + it.priceMinor * it.quantity, 0);
        await prisma.folioCharge.create({ data: { folioId: folio.id, description: `Restaurant order #${order.id.slice(-6)}`, amountMinor: total, createdById: req.auth!.sub } });
      }
    }
    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'CREATE_KITCHEN_ORDER', entity: 'KitchenOrder', entityId: order.id });
    return ok(res, order, 'Order placed');
  }),
);

router.patch(
  '/orders/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const { status } = z.object({ status: z.enum(['Open', 'Preparing', 'Served', 'Cancelled']) }).parse(req.body);
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const existing = await prisma.kitchenOrder.findFirst({ where: { id, propertyId } });
    if (!existing) return fail(res, 404, 'Order not found');
    const order = await prisma.kitchenOrder.update({ where: { id }, data: { status } });
    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'UPDATE_KITCHEN_ORDER', entity: 'KitchenOrder', entityId: id, metadata: { status } });
    return ok(res, order, 'Order updated');
  }),
);

export const restaurantRouter = router;
