import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from '@/config';
import { requestLogger } from '@/middleware/logger.middleware';
import { errorMiddleware } from '@/middleware/error.middleware';
import authRoutes from '@/routes/auth.routes';
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

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
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
