import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { clerkMiddleware } from '@clerk/express';
import { config } from '@/config';
import { requestLogger } from '@/middleware/logger.middleware';
import { errorMiddleware } from '@/middleware/error.middleware';
import clerkWebhooksRoutes from '@/routes/clerk-webhooks.routes';
import agencyRoutes from '@/routes/agencies.routes';
import clientRoutes from '@/routes/clients.routes';
import recommendationRoutes from '@/routes/recommendations.routes';
import competitorRoutes from '@/routes/competitors.routes';
import googleOAuthRoutes from '@/routes/google-oauth.routes';
import { authenticate } from '@/middleware/auth.middleware';
import { logger } from '@/utils/logger';

const app = express();

app.use(cors({
  origin: config.frontendUrl,
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

app.use(errorMiddleware);

if (!process.env.RENDER) {
  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'API server started');
  });
}

export default app;
