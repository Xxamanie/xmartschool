import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { env } from './core/env';
import { apiRouter } from './routes';
import { startScheduler } from './core/scheduler';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);
// Document uploads (base64) need a larger body; parsed before the default 1mb.
app.use('/api/documents', express.json({ limit: '20mb' }));
app.use(express.json({ limit: '1mb' }));

app.use('/api', rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/login', rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false }));

app.use('/api', apiRouter);

app.use((_req, res) => res.status(404).json({ ok: false, data: null, message: 'Not found' }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ ok: false, data: null, message: 'Validation failed', errors: err.flatten() });
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  if (!env.isProd) console.error('[error]', err);
  const status = message === 'Not allowed by CORS' ? 403 : 500;
  return res.status(status).json({ ok: false, data: null, message: env.isProd && status === 500 ? 'Internal server error' : message });
});

app.listen(env.port, () => {
  console.log(`XmartHR API listening on :${env.port} (${env.nodeEnv})`);
  startScheduler();
});
