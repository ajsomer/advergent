import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { clerkMiddleware } from '@clerk/express';
import { config } from './config/index.js';
import { requestLogger } from './middleware/logger.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import clerkWebhooksRoutes from './routes/clerk-webhooks.routes.js';
import agencyRoutes from './routes/agencies.routes.js';
import clientRoutes from './routes/clients.routes.js';
import recommendationRoutes from './routes/recommendations.routes.js';
import competitorRoutes from './routes/competitors.routes.js';
import googleOAuthRoutes from './routes/google-oauth.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import analysisRoutes from './routes/analysis.routes.js';
import { authenticate } from './middleware/auth.middleware.js';
import { logger } from './utils/logger.js';

const app = express();

// CORS configuration - allow multiple origins in development
const corsOrigins = config.isDevelopment
  ? ['http://localhost:5173', 'http://localhost:5174', config.frontendUrl]
  : config.frontendUrl;

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(helmet());
app.use(express.json());
app.use(cookieParser(config.cookieSecret));
app.use(requestLogger);

// Webhook routes BEFORE clerkMiddleware (no auth required)
app.use('/api', clerkWebhooksRoutes);

// Add Clerk middleware to parse and validate tokens
app.use(clerkMiddleware());

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Protected routes - use authenticate middleware
app.use('/api/agency', authenticate, agencyRoutes);
app.use('/api/clients', authenticate, clientRoutes);
app.use('/api/recommendations', authenticate, recommendationRoutes);
app.use('/api/competitors', authenticate, competitorRoutes);
app.use('/api/google', authenticate, googleOAuthRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/analysis', authenticate, analysisRoutes);

app.use(errorMiddleware);

if (!process.env.RENDER) {
  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'API server started');
  });
}

export default app;
