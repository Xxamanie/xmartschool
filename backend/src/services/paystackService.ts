import crypto from 'crypto';
import { env } from '../config/env';

const BASE = 'https://api.paystack.co';
// Use the global fetch (Node 18+) without depending on DOM lib types.
const httpFetch: any = (globalThis as any).fetch;

export const paystackConfigured = (): boolean => !!env.paystackSecretKey;

const authHeaders = () => ({
  Authorization: `Bearer ${env.paystackSecretKey}`,
  'Content-Type': 'application/json',
});

/** Create a Paystack checkout session; returns the URL to redirect the payer to. */
export const initializeTransaction = async (params: {
  email: string;
  amountKobo: number;
  reference: string;
  metadata: Record<string, unknown>;
  callbackUrl?: string;
}): Promise<{ authorizationUrl: string; reference: string; accessCode: string }> => {
  const res = await httpFetch(`${BASE}/transaction/initialize`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      metadata: params.metadata,
      ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
    }),
  });
  const json: any = await res.json();
  if (!json?.status) throw new Error(json?.message || 'Paystack initialize failed');
  return {
    authorizationUrl: json.data.authorization_url,
    reference: json.data.reference,
    accessCode: json.data.access_code,
  };
};

/** Verify a transaction with Paystack (the source of truth before crediting a ledger). */
export const verifyTransaction = async (reference: string): Promise<{
  status: string;
  amountKobo: number;
  metadata: any;
  currency: string;
  channel?: string;
  paidAt?: string;
}> => {
  const res = await httpFetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: authHeaders(),
  });
  const json: any = await res.json();
  if (!json?.status) throw new Error(json?.message || 'Paystack verify failed');
  const d = json.data;
  return {
    status: d.status,
    amountKobo: d.amount,
    metadata: d.metadata,
    currency: d.currency,
    channel: d.channel,
    paidAt: d.paid_at,
  };
};

/** Validate the x-paystack-signature header (HMAC-SHA512 of the raw body). */
export const verifyWebhookSignature = (rawBody: Buffer | string, signature?: string): boolean => {
  if (!signature || !env.paystackSecretKey) return false;
  const hash = crypto.createHmac('sha512', env.paystackSecretKey).update(rawBody).digest('hex');
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
