import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { apiLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';

// ─── Route imports ────────────────────────────────────────────────────────────
import authRoutes         from './routes/v1/auth.routes';
import tenantRoutes       from './routes/v1/tenant.routes';
import rentRoutes         from './routes/v1/rent.routes';
import paymentRoutes      from './routes/v1/payment.routes';
import electricityRoutes  from './routes/v1/electricity.routes';
import notificationRoutes from './routes/v1/notification.routes';
import propertyRoutes     from './routes/v1/property.routes';
import unitRoutes         from './routes/v1/unit.routes';
import deviceRoutes       from './routes/v1/device.routes';

const app = express();

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Global rate limit ────────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'development',
    },
  });
});

// ─── API v1 routes ────────────────────────────────────────────────────────────
const V1 = '/api/v1';
app.use(`${V1}/auth`,          authRoutes);
app.use(`${V1}/tenants`,       tenantRoutes);
app.use(`${V1}/rent`,          rentRoutes);
app.use(`${V1}/payments`,      paymentRoutes);
app.use(`${V1}/electricity`,   electricityRoutes);
app.use(`${V1}/notifications`, notificationRoutes);
app.use(`${V1}/properties`,    propertyRoutes);
app.use(`${V1}/units`,         unitRoutes);
app.use(`${V1}/devices`,       deviceRoutes);

// ─── 404 + error handlers ─────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
