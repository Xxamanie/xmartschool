import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { env } from './core/env';
import { apiRouter } from './routes';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin / curl (no Origin header) and configured front-ends.
      if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);
// Public guest-facing endpoints are embeddable on the hotel's own website,
// so they get permissive (credential-less) CORS — applied before the staff CORS.
app.use('/api/public', cors({ origin: true, credentials: false }));

// Capture the raw body so payment webhooks can verify their HMAC signature.
app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { (req as Request & { rawBody?: Buffer }).rawBody = buf; } }));

// Basic abuse protection; auth and public write endpoints get tighter buckets.
app.use('/api', rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/login', rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false }));
app.use('/api/public', rateLimit({ windowMs: 60_000, max: 40, standardHeaders: true, legacyHeaders: false }));

app.use('/api', apiRouter);

// 404
app.use((_req, res) => res.status(404).json({ ok: false, data: null, message: 'Not found' }));

// Central error handler
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
  console.log(`XmartHotel API listening on :${env.port} (${env.nodeEnv})`);
});
