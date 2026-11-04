import { env } from '../../core/env';

/**
 * Minimal email sender over a generic HTTP JSON provider (Resend/SendGrid-style:
 * POST { from, to, subject, html } with a Bearer key). When unconfigured, the
 * message is logged and the caller falls back to returning the link to HR.
 */
export const emailEnabled = (): boolean => Boolean(env.emailApiUrl && env.emailApiKey);

export async function sendEmail(to: string, subject: string, html: string): Promise<{ sent: boolean }> {
  if (!emailEnabled()) {
    console.log(`[email] (not configured) to=${to} subject="${subject}"`);
    return { sent: false };
  }
  try {
    const res = await fetch(env.emailApiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.emailApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.emailFrom, to, subject, html }),
    });
    if (!res.ok) { console.error('[email] HTTP', res.status); return { sent: false }; }
    return { sent: true };
  } catch (err) {
    console.error('[email] error', err);
    return { sent: false };
  }
}
