/**
 * D31337m3 API Server
 * Express + TypeScript entry point
 * Mounts all routers, middleware, and starts BullMQ workers
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import { paymentRouter } from './controllers/payment.controller';
import { ormRouter } from './controllers/orm.controller';
import { authRouter } from './controllers/auth.controller';
import { startWorkers } from './workers/scraper.worker';
import { startEngagementWorker } from './workers/engagement.worker';
import { logger } from './services/logger.service';

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Raw body needed for Stripe webhook signature verification
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', apiLimiter);

// Auth endpoints get tighter limits
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts.' },
});
app.use('/api/auth', authLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/orm', ormRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  logger.info(`🚀 D31337m3 API running on port ${PORT}`);
  await startWorkers();
  await startEngagementWorker();
  logger.info('🔧 BullMQ workers started');
});

export default app;
