import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';

const router = Router();
const propertyOf = (req: Request): string | null => req.auth?.propertyId ?? null;

router.get(
  '/items',
  requireAuth,
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const items = await prisma.inventoryItem.findMany({ where: { propertyId }, orderBy: { name: 'asc' } });
    // Flag items at/below reorder level.
    return ok(res, items.map((i) => ({ ...i, lowStock: i.quantity <= i.reorderLevel })));
  }),
);

router.post(
  '/items',
  requireAuth,
  requireRole(), // manager+
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const body = z.object({
      name: z.string().min(1),
      category: z.string().optional(),
      unit: z.string().optional(),
      quantity: z.number().int().min(0).optional(),
      reorderLevel: z.number().int().min(0).optional(),
    }).parse(req.body);
    const item = await prisma.inventoryItem.create({
      data: { propertyId, name: body.name, category: body.category ?? 'Consumable', unit: body.unit ?? 'unit', quantity: body.quantity ?? 0, reorderLevel: body.reorderLevel ?? 0 },
    });
    await writeAudit({ propertyId, actorId: req.auth!.sub, action: 'CREATE_INVENTORY_ITEM', entity: 'InventoryItem', entityId: item.id });
    return ok(res, item, 'Inventory item created');
  }),
);

router.post(
  '/items/:id/movement',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = z.object({
      change: z.number().int().refine((n) => n !== 0, 'change cannot be zero'), // +received / -consumed
      reason: z.string().optional(),
    }).parse(req.body);

    const item = await prisma.inventoryItem.findFirst({ where: { id, propertyId: propertyOf(req) ?? undefined } });
    if (!item) return fail(res, 404, 'Item not found');
    if (item.quantity + body.change < 0) return fail(res, 400, 'Insufficient stock');

    const [, updated] = await prisma.$transaction([
      prisma.stockMovement.create({ data: { itemId: id, change: body.change, reason: body.reason ?? '', createdById: req.auth!.sub } }),
      prisma.inventoryItem.update({ where: { id }, data: { quantity: { increment: body.change } } }),
    ]);
    await writeAudit({ propertyId: item.propertyId, actorId: req.auth!.sub, action: 'STOCK_MOVEMENT', entity: 'InventoryItem', entityId: id, metadata: { change: body.change } });
    return ok(res, updated, 'Stock updated');
  }),
);

export const inventoryRouter = router;
