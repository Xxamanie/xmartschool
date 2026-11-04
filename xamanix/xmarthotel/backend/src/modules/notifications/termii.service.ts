import { env } from '../../core/env';

/**
 * Termii SMS / WhatsApp notifications. Optional: when TERMII_API_KEY is unset,
 * every send is a silent no-op. Sends are fire-and-forget and never throw — a
 * messaging failure must never break a booking or a payment.
 */
export const termiiEnabled = (): boolean => Boolean(env.termiiApiKey);

/** Normalise a phone number to international digits (no +), e.g. 2348012345678. */
export function normalizePhone(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  const cc = env.defaultCountryCode;
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2); // 00<cc>... → <cc>...
  if (digits.startsWith('0')) digits = cc + digits.slice(1); // local 0xxx → ccxxx
  else if (!digits.startsWith(cc) && digits.length <= 10) digits = cc + digits; // bare local
  return digits;
}

const money = (amountMinor: number, currency = 'NGN') => `${currency} ${(amountMinor / 100).toLocaleString('en-NG')}`;
const shortDate = (v: string | Date) =>
  (typeof v === 'string' ? new Date(v) : v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/** Low-level send. Resolves to whether the message was accepted; never rejects. */
export async function sendSms(to: string, message: string): Promise<{ sent: boolean }> {
  if (!termiiEnabled()) return { sent: false };
  const phone = normalizePhone(to);
  if (!phone) return { sent: false };
  try {
    const res = await fetch(`${env.termiiBaseUrl}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phone,
        from: env.termiiSender,
        sms: message,
        type: 'plain',
        channel: env.termiiChannel, // 'generic' | 'dnd' | 'whatsapp'
        api_key: env.termiiApiKey,
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json?.code === 'error') {
      console.error('[termii] send failed:', json?.message ?? `HTTP ${res.status}`);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error('[termii] send error:', err);
    return { sent: false };
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────
export function sendBookingConfirmation(args: {
  phone?: string | null;
  guestName: string;
  propertyName: string;
  reference: string;
  checkIn: string | Date;
  checkOut: string | Date;
}): void {
  const msg =
    `Hi ${args.guestName}, your booking at ${args.propertyName} is confirmed. ` +
    `Ref ${args.reference}. ${shortDate(args.checkIn)} to ${shortDate(args.checkOut)}. ` +
    `Show this reference at check-in.`;
  void sendSms(args.phone ?? '', msg); // fire-and-forget
}

export function sendPaymentReceipt(args: {
  phone?: string | null;
  propertyName: string;
  amountMinor: number;
  currency?: string;
  reference: string;
}): void {
  const msg =
    `Payment received: ${money(args.amountMinor, args.currency)} at ${args.propertyName}. ` +
    `Ref ${args.reference}. Thank you!`;
  void sendSms(args.phone ?? '', msg); // fire-and-forget
}
