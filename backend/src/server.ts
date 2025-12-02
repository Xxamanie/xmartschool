import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { registerRoutes } from './routes';

const app = express();

const allowedOrigins = [
  'https://xmartschool.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4000'
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);
app.options('*', cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

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
