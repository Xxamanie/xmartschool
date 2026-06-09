import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import hpp from 'hpp';
import { ZodError } from 'zod';
import { env } from './config/env';
import { registerRoutes } from './routes';
import { apiRateLimiter } from './middleware/rateLimit';
import { sanitizeRequest } from './middleware/sanitize';

const app = express();

const allowedOrigins = new Set([
  ...env.corsOrigins,
  ...(env.nodeEnv !== 'production'
    ? ['http://localhost:3000', 'http://localhost:4000', 'http://localhost:5173']
    : []),
]);

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cookieParser(env.sessionSecret));
app.use(hpp());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
    credentials: true,
    optionsSuccessStatus: 200,
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeRequest);
app.use('/api', apiRateLimiter);

registerRoutes(app);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // ZodError → 400 with field-level messages
  if (err instanceof ZodError) {
    const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    res.status(400).json({ ok: false, data: null, message });
    return;
  }

  // Safe logging — avoid crashing util.inspect on complex error objects (e.g. Prisma errors)
  const errMessage = err instanceof Error ? err.message : String(err);
  const errStack   = err instanceof Error ? err.stack  : undefined;
  console.error('[UnhandledError]', errMessage, errStack);

  const message = env.nodeEnv === 'production'
    ? 'Internal Server Error'
    : (errMessage || 'Internal Server Error');
  res.status(500).json({ ok: false, data: null, message });
});

app.use('*', (_req, res) => {
  res.status(404).json({ ok: false, data: null, message: 'Route not found' });
});

if (env.nodeEnv !== 'test') {
  app.listen(env.port, () => {
    console.log(`Smart School backend listening on port ${env.port}`);
  });
}

export default app;
