import { Request, Response, NextFunction } from 'express';
import pinoHttp from 'pino-http';
import { logger } from '@/utils/logger';

export const requestLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req) => `${req.method} ${req.url} completed`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} failed: ${err?.message || res.statusCode}`,
  customProps: (req) => ({
    userId: (req as any).user?.id,
    agencyId: (req as any).user?.agency_id,
    sessionId: (req as any).sessionId
  }),
  autoLogging: {
    ignore: (req: Request) => req.url === '/health' || req.url === '/api/health'
  }
});

export function withRequestLogger(req: Request, res: Response, next: NextFunction) {
  requestLogger(req, res, next);
}
