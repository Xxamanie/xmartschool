import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';

const router = Router();

/** Folio balance in minor units: charges − non-refunded payments. */
const computeBalance = (
  charges: { amountMinor: number; quantity: number }[],
  payments: { amountMinor: number; refunded: boolean }[],
) => {
  const chargesTotal = charges.reduce((sum, c) => sum + c.amountMinor * c.quantity, 0);
  const paymentsTotal = payments.filter((p) => !p.refunded).reduce((sum, p) => sum + p.amountMinor, 0);
  return { chargesTotal, paymentsTotal, balanceMinor: chargesTotal - paymentsTotal };
};

router.get(
  '/folios/:folioId',
  requireAuth,
  requireRole('FRONT_DESK', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const { folioId } = z.object({ folioId: z.string().min(1) }).parse(req.params);
    const folio = await prisma.folio.findUnique({
      where: { id: folioId },
      include: {
        charges: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { createdAt: 'asc' } },
        reservation: { include: { guest: { select: { firstName: true, lastName: true } }, room: { select: { number: true } } } },
      },
    });
    if (!folio) return fail(res, 404, 'Folio not found');
    if (folio.reservation.propertyId !== req.auth!.propertyId) return fail(res, 403, 'Forbidden');
    return ok(res, { ...folio, ...computeBalance(folio.charges, folio.payments) });
  }),
);

router.post(
  '/folios/:folioId/charges',
  requireAuth,
  requireRole('FRONT_DESK', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const { folioId } = z.object({ folioId: z.string().min(1) }).parse(req.params);
    const body = z.object({
      description: z.string().min(1),
      amountMinor: z.number().int(), // negative allowed for discounts
      quantity: z.number().int().min(1).optional(),
    }).parse(req.body);

    const folio = await prisma.folio.findUnique({ where: { id: folioId }, include: { reservation: { select: { propertyId: true } } } });
    if (!folio) return fail(res, 404, 'Folio not found');
    if (folio.reservation.propertyId !== req.auth!.propertyId) return fail(res, 403, 'Forbidden');
    if (folio.status === 'Closed') return fail(res, 400, 'Folio is closed');

    const charge = await prisma.folioCharge.create({
      data: { folioId, description: body.description, amountMinor: body.amountMinor, quantity: body.quantity ?? 1, createdById: req.auth!.sub },
    });
    await writeAudit({ propertyId: folio.reservation.propertyId, actorId: req.auth!.sub, action: 'ADD_CHARGE', entity: 'FolioCharge', entityId: charge.id, metadata: { folioId, amountMinor: body.amountMinor } });
    return ok(res, charge, 'Charge added');
  }),
);

router.post(
  '/folios/:folioId/payments',
  requireAuth,
  requireRole('FRONT_DESK', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const { folioId } = z.object({ folioId: z.string().min(1) }).parse(req.params);
    const body = z.object({
      amountMinor: z.number().int().min(1),
      method: z.enum(['Cash', 'Card', 'Transfer', 'POS', 'Wallet']).optional(),
      reference: z.string().optional(),
    }).parse(req.body);

    const folio = await prisma.folio.findUnique({ where: { id: folioId }, include: { reservation: { select: { propertyId: true } } } });
    if (!folio) return fail(res, 404, 'Folio not found');
    if (folio.reservation.propertyId !== req.auth!.propertyId) return fail(res, 403, 'Forbidden');
    if (folio.status === 'Closed') return fail(res, 400, 'Folio is closed');

    const payment = await prisma.payment.create({
      data: { folioId, amountMinor: body.amountMinor, method: body.method ?? 'Cash', reference: body.reference, createdById: req.auth!.sub },
    });
    await writeAudit({ propertyId: folio.reservation.propertyId, actorId: req.auth!.sub, action: 'RECORD_PAYMENT', entity: 'Payment', entityId: payment.id, metadata: { folioId, amountMinor: body.amountMinor, method: payment.method } });
    return ok(res, payment, 'Payment recorded');
  }),
);

router.post(
  '/payments/:id/refund',
  requireAuth,
  requireRole('ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const existing = await prisma.payment.findUnique({ where: { id }, include: { folio: { include: { reservation: { select: { propertyId: true } } } } } });
    if (!existing) return fail(res, 404, 'Payment not found');
    if (existing.folio.reservation.propertyId !== req.auth!.propertyId) return fail(res, 403, 'Forbidden');
    if (existing.refunded) return fail(res, 400, 'Payment already refunded');

    const payment = await prisma.payment.update({ where: { id }, data: { refunded: true } });
    await writeAudit({ propertyId: existing.folio.reservation.propertyId, actorId: req.auth!.sub, action: 'REFUND_PAYMENT', entity: 'Payment', entityId: id });
    return ok(res, payment, 'Payment refunded');
  }),
);

export const billingRouter = router;
