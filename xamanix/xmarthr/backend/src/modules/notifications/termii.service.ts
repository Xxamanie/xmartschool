import { env } from '../../core/env';

/**
 * Termii SMS / WhatsApp notifications. Optional: when TERMII_API_KEY is unset,
 * every send is a silent no-op. Sends are fire-and-forget and never throw — a
 * messaging failure must never break payroll, leave, or any HR action.
 */
export const termiiEnabled = (): boolean => Boolean(env.termiiApiKey);

export function normalizePhone(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  const cc = env.defaultCountryCode;
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = cc + digits.slice(1);
  else if (!digits.startsWith(cc) && digits.length <= 10) digits = cc + digits;
  return digits;
}

const money = (amountMinor: number, currency = 'NGN') => `${currency} ${(amountMinor / 100).toLocaleString('en-NG')}`;

/** Low-level send. Resolves to whether it was accepted; never rejects. */
export async function sendSms(to: string, message: string, channelOverride?: string): Promise<{ sent: boolean }> {
  if (!termiiEnabled()) return { sent: false };
  const phone = normalizePhone(to);
  if (!phone) return { sent: false };
  try {
    const res = await fetch(`${env.termiiBaseUrl}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, from: env.termiiSender, sms: message, type: 'plain', channel: channelOverride || env.termiiChannel, api_key: env.termiiApiKey }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json?.code === 'error') { console.error('[termii] send failed:', json?.message ?? `HTTP ${res.status}`); return { sent: false }; }
    return { sent: true };
  } catch (err) {
    console.error('[termii] send error:', err);
    return { sent: false };
  }
}

/** Send the same message to many recipients; returns how many were accepted. */
export async function sendBulk(recipients: (string | null | undefined)[], message: string, channelOverride?: string): Promise<number> {
  if (!termiiEnabled()) return 0;
  const results = await Promise.all(recipients.map((r) => sendSms(r ?? '', message, channelOverride)));
  return results.filter((r) => r.sent).length;
}

// ── Templates (fire-and-forget) ───────────────────────────────────────────────
export function notifyPayslipReady(phone: string | null | undefined, name: string, period: string, netMinor: number, currency: string): void {
  void sendSms(phone ?? '', `Hi ${name}, your payslip for ${period} is ready. Net pay: ${money(netMinor, currency)}. View it in the XmartHR portal.`);
}

export function notifyLeaveDecision(phone: string | null | undefined, name: string, leaveType: string, status: string): void {
  void sendSms(phone ?? '', `Hi ${name}, your ${leaveType} leave request was ${status.toLowerCase()}.`);
}

export function notifyManagerLeaveRequest(phone: string | null | undefined, managerName: string, employeeName: string, days: number): void {
  void sendSms(phone ?? '', `Hi ${managerName}, ${employeeName} has requested ${days} day(s) of leave. Review it in XmartHR.`);
}

export function notifyReviewSubmitted(phone: string | null | undefined, name: string, cycle: string): void {
  void sendSms(phone ?? '', `Hi ${name}, your performance review for ${cycle} has been submitted. View it in XmartHR.`);
}
