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
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL').optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
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
  databaseUrl: parsedEnv.data.DATABASE_URL,
  sessionSecret: parsedEnv.data.SESSION_SECRET,
  supabaseUrl: parsedEnv.data.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: parsedEnv.data.SUPABASE_SERVICE_ROLE_KEY ?? '',
};
