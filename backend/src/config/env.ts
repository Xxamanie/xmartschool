import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL').optional(),
  CORS_ORIGIN: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  WHEREBY_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  TERMII_API_KEY: z.string().optional(),
  TERMII_SENDER_ID: z.string().optional(),
  ENABLE_DEMO_AUTH: z.enum(['true', 'false']).optional(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL').optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
}).superRefine((config, ctx) => {
  if (config.NODE_ENV !== 'production') return;
  if (config.SESSION_SECRET.length < 64) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SESSION_SECRET'], message: 'SESSION_SECRET must be at least 64 characters in production' });
  }
  if (config.ENABLE_DEMO_AUTH === 'true') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ENABLE_DEMO_AUTH'], message: 'Demo authentication must be disabled in production' });
  }
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
}

const parsedPort = parseNumber(parsedEnv.data.PORT, 4000);

export const env = {
  nodeEnv: parsedEnv.data.NODE_ENV,
  port: parsedPort,
  corsOrigin: parsedEnv.data.CORS_ORIGIN ?? parsedEnv.data.FRONTEND_URL ?? 'http://localhost:5173',
  corsOrigins: (parsedEnv.data.CORS_ORIGIN ?? parsedEnv.data.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
  frontendUrl: parsedEnv.data.FRONTEND_URL ?? 'http://localhost:5173',
  geminiApiKey: parsedEnv.data.GEMINI_API_KEY ?? '',
  wherebyApiKey: parsedEnv.data.WHEREBY_API_KEY ?? '',
  smtpHost: parsedEnv.data.SMTP_HOST,
  smtpPort: parsedEnv.data.SMTP_PORT,
  smtpUser: parsedEnv.data.SMTP_USER,
  smtpPassword: parsedEnv.data.SMTP_PASSWORD,
  smtpFrom: parsedEnv.data.SMTP_FROM,
  paystackSecretKey: parsedEnv.data.PAYSTACK_SECRET_KEY ?? '',
  termiiApiKey: parsedEnv.data.TERMII_API_KEY ?? '',
  termiiSenderId: parsedEnv.data.TERMII_SENDER_ID ?? '',
  enableDemoAuth: parsedEnv.data.ENABLE_DEMO_AUTH === 'true',
  databaseUrl: parsedEnv.data.DATABASE_URL,
  sessionSecret: parsedEnv.data.SESSION_SECRET,
  supabaseUrl: parsedEnv.data.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: parsedEnv.data.SUPABASE_SERVICE_ROLE_KEY ?? '',
};
