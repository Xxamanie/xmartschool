import { env } from '../config/env';

// Termii (https://termii.com) — Nigeria-focused SMS + WhatsApp via one API key.
const TERMII_BASE = 'https://api.ng.termii.com/api';
const httpFetch: any = (globalThis as any).fetch;

export const messagingConfigured = (): boolean => !!env.termiiApiKey;

// Normalise a Nigerian/local number to international format without the '+'.
// 08031234567 → 2348031234567 ; +2348031234567 → 2348031234567
export const toMsisdn = (phone?: string): string | null => {
  if (!phone) return null;
  let p = phone.replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('234')) return p;
  if (p.startsWith('0')) return '234' + p.slice(1);
  if (p.length === 10) return '234' + p; // missing leading 0
  return p;
};

type Channel = 'sms' | 'whatsapp';

const send = async (to: string, message: string, channel: Channel): Promise<boolean> => {
  if (!messagingConfigured()) {
    console.log(`[messaging:${channel} not configured] would send to ${to}: ${message}`);
    return false;
  }
  const dest = toMsisdn(to);
  if (!dest) return false;
  try {
    const res = await httpFetch(`${TERMII_BASE}/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: dest,
        from: env.termiiSenderId || 'XmartSchool',
        sms: message,
        type: 'plain',
        channel: channel === 'whatsapp' ? 'whatsapp' : 'generic',
        api_key: env.termiiApiKey,
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    // Termii returns message_id on success.
    return !!(json && (json.message_id || json.code === 'ok'));
  } catch (err) {
    console.error(`[messaging:${channel}] send failed`, err);
    return false;
  }
};

export const sendSMS = (to: string, message: string) => send(to, message, 'sms');
export const sendWhatsApp = (to: string, message: string) => send(to, message, 'whatsapp');
