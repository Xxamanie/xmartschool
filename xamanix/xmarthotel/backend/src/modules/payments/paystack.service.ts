import crypto from 'crypto';
import { env } from '../../core/env';
import { prisma } from '../../core/prisma';
import { writeAudit } from '../../core/audit';
import { sendPaymentReceipt } from '../notifications/termii.service';

/**
 * Paystack integration — hosted-checkout flow only. We never see card data:
 * the guest pays on Paystack's page and returns with a reference we verify
 * server-side. All amounts are integer minor units (kobo), matching our folio.
 */
const PAYSTACK_BASE = 'https://api.paystack.co';

export const paystackEnabled = (): boolean => Boolean(env.paystackSecret);

interface InitParams {
  amountMinor: number;
  email: string;
  reference?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export async function initTransaction(params: InitParams): Promise<{ authorizationUrl: string; reference: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.paystackSecret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: params.amountMinor,
      email: params.email,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });
  const json: any = await res.json();
  if (!json.status) throw new Error(json.message || 'Paystack initialization failed');
  return { authorizationUrl: json.data.authorization_url, reference: json.data.reference };
}

interface VerifyResult {
  status: string; // 'success' | 'failed' | 'abandoned' | ...
  amountMinor: number;
  reference: string;
  metadata: Record<string, unknown> | null;
}

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${env.paystackSecret}` },
  });
  const json: any = await res.json();
  if (!json.status) throw new Error(json.message || 'Paystack verification failed');
  return {
    status: json.data.status,
    amountMinor: json.data.amount,
    reference: json.data.reference,
    metadata: json.data.metadata ?? null,
  };
}

/** Validate a Paystack webhook payload using the raw request body. */
export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature || !env.paystackSecret) return false;
  const hash = crypto.createHmac('sha512', env.paystackSecret).update(rawBody).digest('hex');
  // timing-safe compare
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Record a successful Paystack payment against a folio — idempotent on the
 * payment reference, so re-running (verify + webhook) never double-credits.
 */
export async function recordPaystackPayment(args: {
  folioId: string;
  amountMinor: number;
  reference: string;
}): Promise<{ recorded: boolean; alreadyRecorded: boolean }> {
  const existing = await prisma.payment.findFirst({ where: { reference: args.reference } });
  if (existing) return { recorded: false, alreadyRecorded: true };

  const folio = await prisma.folio.findUnique({
    where: { id: args.folioId },
    include: { reservation: { select: { propertyId: true, guest: { select: { phone: true } }, property: { select: { name: true, currency: true } } } } },
  });
  if (!folio) throw new Error('Folio not found for payment');

  await prisma.payment.create({
    data: { folioId: args.folioId, amountMinor: args.amountMinor, method: 'Card', reference: args.reference },
  });
  await writeAudit({
    propertyId: folio.reservation.propertyId,
    actorId: null,
    action: 'PAYSTACK_PAYMENT',
    entity: 'Payment',
    entityId: args.reference,
    metadata: { folioId: args.folioId, amountMinor: args.amountMinor },
  });

  // Receipt to the guest (non-blocking; no-op when Termii is unconfigured).
  sendPaymentReceipt({
    phone: folio.reservation.guest.phone,
    propertyName: folio.reservation.property.name,
    amountMinor: args.amountMinor,
    currency: folio.reservation.property.currency,
    reference: args.reference,
  });

  return { recorded: true, alreadyRecorded: false };
}
