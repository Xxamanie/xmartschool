import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CORS_ORIGIN: z.string().optional(),
  // Payments (optional — when unset, Paystack endpoints report "not configured").
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PUBLIC_BASE_URL: z.string().optional(), // e.g. http://localhost:5173 — where guests return after paying
  // Notifications (optional — when unset, messages are silently skipped).
  TERMII_API_KEY: z.string().optional(),
  TERMII_SENDER_ID: z.string().optional(),
  TERMII_CHANNEL: z.enum(['generic', 'dnd', 'whatsapp']).optional(),
  TERMII_BASE_URL: z.string().optional(),
  DEFAULT_COUNTRY_CODE: z.string().optional(), // for normalising local phone numbers, e.g. 234
  // AI (optional — OpenAI-compatible). When unset, natural-language answers fall
  // back to a deterministic templated summary; all analytics still work.
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
  throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
}

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  isProd: parsed.data.NODE_ENV === 'production',
  port: Number(parsed.data.PORT ?? 5050),
  databaseUrl: parsed.data.DATABASE_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  corsOrigins: (parsed.data.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',').map((s) => s.trim()).filter(Boolean),
  paystackSecret: parsed.data.PAYSTACK_SECRET_KEY ?? '',
  publicBaseUrl: parsed.data.PUBLIC_BASE_URL ?? 'http://localhost:5173',
  termiiApiKey: parsed.data.TERMII_API_KEY ?? '',
  termiiSender: parsed.data.TERMII_SENDER_ID ?? 'XmartHotel',
  termiiChannel: parsed.data.TERMII_CHANNEL ?? 'generic',
  termiiBaseUrl: parsed.data.TERMII_BASE_URL ?? 'https://api.ng.termii.com',
  defaultCountryCode: parsed.data.DEFAULT_COUNTRY_CODE ?? '234',
  openaiApiKey: parsed.data.OPENAI_API_KEY ?? '',
  openaiModel: parsed.data.OPENAI_MODEL ?? 'gpt-4o-mini',
  openaiBaseUrl: parsed.data.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
};
