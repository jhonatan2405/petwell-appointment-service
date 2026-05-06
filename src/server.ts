import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import client from 'prom-client';
import { env } from './config/env';
import router from './routes/index';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';

// ─── Prometheus: recolección de métricas por defecto (CPU, RAM, etc.) ─────────
client.collectDefaultMetrics({ prefix: 'appointment_service_' });

const httpRequestCounter = new client.Counter({
    name: 'appointment_service_http_requests_total',
    help: 'Total de peticiones HTTP al Appointment Service',
    labelNames: ['method', 'route', 'status_code'],
});

const app = express();

// ─── Security & Logging ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.ALLOWED_ORIGINS.split(','),
  credentials: true,
}));
app.use(morgan('dev'));

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Prometheus: contador de peticiones HTTP ────────────────────────────────────
app.use((req, _res, next) => {
  _res.on('finish', () => {
    httpRequestCounter.inc({
      method: req.method,
      route: req.path,
      status_code: _res.statusCode,
    });
  });
  next();
});

// ─── Metrics endpoint (Prometheus scrape) ────────────────────────────────────
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// ─── Health ────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'appointment-service' });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1', router);

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`✅ Appointment Service running on port ${env.PORT} [${env.NODE_ENV}]`);
});

export default app;
