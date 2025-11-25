import dotenv from 'dotenv';

dotenv.config();

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseNumber(process.env.PORT, 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
};
