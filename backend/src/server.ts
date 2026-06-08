import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import hpp from 'hpp';
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

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[UnhandledError]', err);
  res.status(500).json({ ok: false, data: null, message: err.message || 'Internal Server Error' });
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
