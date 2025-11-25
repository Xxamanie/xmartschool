import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { registerRoutes } from './routes';

const app = express();

app.use(
  cors({
    origin: env.corsOrigin === '*' ? undefined : env.corsOrigin,
    credentials: true,
  }),
);
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
