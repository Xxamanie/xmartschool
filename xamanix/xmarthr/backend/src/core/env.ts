import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CORS_ORIGIN: z.string().optional(),
  // AI (optional — OpenAI-compatible). NL answers fall back to a deterministic
  // summary when unset; all analytics still work.
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  // Notifications (optional — when unset, messages are silently skipped).
  TERMII_API_KEY: z.string().optional(),
  TERMII_SENDER_ID: z.string().optional(),
  TERMII_CHANNEL: z.enum(['generic', 'dnd', 'whatsapp']).optional(),
  TERMII_BASE_URL: z.string().optional(),
  DEFAULT_COUNTRY_CODE: z.string().optional(),
  // Scheduler (in-process cron). Hours are local 0-23.
  SCHEDULER_ENABLED: z.string().optional(),
  REMINDER_HOUR: z.string().optional(),
  ABSENTEE_HOUR: z.string().optional(),
  // Document storage: "db" (base64 in DB, default) or "s3" (object storage).
  STORAGE_DRIVER: z.enum(['db', 's3']).optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(), // for S3-compatible (MinIO, R2, Spaces)
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PREFIX: z.string().optional(),
  // Public base URL (frontend origin) for e-sign links.
  PUBLIC_BASE_URL: z.string().optional(),
  // Email (optional HTTP provider) for e-sign requests. When unset, the sign link
  // is returned to HR and logged instead of emailed.
  EMAIL_API_URL: z.string().optional(),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
  throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
}

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  isProd: parsed.data.NODE_ENV === 'production',
  port: Number(parsed.data.PORT ?? 5060),
  databaseUrl: parsed.data.DATABASE_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  corsOrigins: (parsed.data.CORS_ORIGIN ?? 'http://localhost:5174')
    .split(',').map((s) => s.trim()).filter(Boolean),
  openaiApiKey: parsed.data.OPENAI_API_KEY ?? '',
  openaiModel: parsed.data.OPENAI_MODEL ?? 'gpt-4o-mini',
  openaiBaseUrl: parsed.data.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  termiiApiKey: parsed.data.TERMII_API_KEY ?? '',
  termiiSender: parsed.data.TERMII_SENDER_ID ?? 'XmartHR',
  termiiChannel: parsed.data.TERMII_CHANNEL ?? 'generic',
  termiiBaseUrl: parsed.data.TERMII_BASE_URL ?? 'https://api.ng.termii.com',
  defaultCountryCode: parsed.data.DEFAULT_COUNTRY_CODE ?? '234',
  schedulerEnabled: (parsed.data.SCHEDULER_ENABLED ?? 'true') !== 'false',
  reminderHour: Number(parsed.data.REMINDER_HOUR ?? 9),
  absenteeHour: Number(parsed.data.ABSENTEE_HOUR ?? 11),
  storageDriver: parsed.data.STORAGE_DRIVER ?? 'db',
  s3: {
    bucket: parsed.data.S3_BUCKET ?? '',
    region: parsed.data.S3_REGION ?? 'us-east-1',
    endpoint: parsed.data.S3_ENDPOINT ?? '',
    accessKeyId: parsed.data.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: parsed.data.S3_SECRET_ACCESS_KEY ?? '',
    prefix: parsed.data.S3_PREFIX ?? 'documents',
  },
  publicBaseUrl: parsed.data.PUBLIC_BASE_URL ?? 'http://localhost:5174',
  emailApiUrl: parsed.data.EMAIL_API_URL ?? '',
  emailApiKey: parsed.data.EMAIL_API_KEY ?? '',
  emailFrom: parsed.data.EMAIL_FROM ?? 'no-reply@xmarthr.local',
};
