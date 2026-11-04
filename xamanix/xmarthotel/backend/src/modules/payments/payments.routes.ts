import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { paystackEnabled, initTransaction, verifyTransaction, verifyWebhookSignature, recordPaystackPayment } from './paystack.service';
import { env } from '../../core/env';

const router = Router();

/** Outstanding balance (minor units) for a folio. */
async function folioBalanceMinor(folioId: string): Promise<number> {
  const folio = await prisma.folio.findUnique({ where: { id: folioId }, include: { charges: true, payments: true } });
  if (!folio) return 0;
  const charges = folio.charges.reduce((s, c) => s + c.amountMinor * c.quantity, 0);
  const paid = folio.payments.filter((p) => !p.refunded).reduce((s, p) => s + p.amountMinor, 0);
  return charges - paid;
}

/** Paystack requires an email; fall back to a synthetic one for phone-only guests. */
const guestEmail = (email?: string | null, phone?: string | null) =>
  email || `guest${(phone ?? '').replace(/\D/g, '') || 'anon'}@guest.xmarthotel`;

// ── Staff: start a card payment for a folio ───────────────────────────────────
router.post(
  '/folios/:folioId/init',
  requireAuth,
  requireRole('FRONT_DESK', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    if (!paystackEnabled()) return fail(res, 503, 'Payments are not configured (set PAYSTACK_SECRET_KEY)');
    const { folioId } = z.object({ folioId: z.string().min(1) }).parse(req.params);
    const { amountMinor } = z.object({ amountMinor: z.number().int().min(1).optional() }).parse(req.body);

    const folio = await prisma.folio.findUnique({
      where: { id: folioId },
      include: { reservation: { include: { guest: { select: { email: true, phone: true } }, } } },
    });
    if (!folio) return fail(res, 404, 'Folio not found');
    if (folio.reservation.propertyId !== req.auth!.propertyId) return fail(res, 403, 'Forbidden');

    const amount = amountMinor ?? (await folioBalanceMinor(folioId));
    if (amount <= 0) return fail(res, 400, 'Nothing to pay — folio balance is zero');

    const init = await initTransaction({
      amountMinor: amount,
      email: guestEmail(folio.reservation.guest.email, folio.reservation.guest.phone),
      callbackUrl: `${env.publicBaseUrl}/payment/callback`,
      metadata: { folioId, context: 'staff' },
    });
    return ok(res, init, 'Payment initialized');
  }),
);

// ── Verify a payment by reference (called after returning from Paystack) ───────
router.get(
  '/verify',
  requireAuth,
  requireRole('FRONT_DESK', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    if (!paystackEnabled()) return fail(res, 503, 'Payments are not configured');
    const { reference } = z.object({ reference: z.string().min(1) }).parse(req.query);
    const result = await verifyTransaction(reference);
    if (result.status !== 'success') return ok(res, { status: result.status, recorded: false }, 'Payment not successful');

    const folioId = (result.metadata as { folioId?: string } | null)?.folioId;
    if (!folioId) return fail(res, 400, 'Payment is missing folio metadata');
    const { recorded, alreadyRecorded } = await recordPaystackPayment({ folioId, amountMinor: result.amountMinor, reference: result.reference });
    return ok(res, { status: 'success', recorded, alreadyRecorded, folioId }, 'Payment verified');
  }),
);

// ── Webhook (server-to-server; signature-verified, no auth) ───────────────────
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (!raw || !verifyWebhookSignature(raw, req.headers['x-paystack-signature'] as string | undefined)) {
      return res.status(401).json({ ok: false, data: null, message: 'Invalid signature' });
    }
    const event = req.body as { event?: string; data?: { reference?: string; amount?: number; status?: string; metadata?: { folioId?: string } } };
    if (event.event === 'charge.success' && event.data?.status === 'success' && event.data.metadata?.folioId && event.data.reference && typeof event.data.amount === 'number') {
      await recordPaystackPayment({ folioId: event.data.metadata.folioId, amountMinor: event.data.amount, reference: event.data.reference });
    }
    // Always 200 so Paystack stops retrying.
    return res.json({ ok: true, data: { received: true } });
  }),
);

export const paymentsRouter = router;
