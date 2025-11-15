import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

export function errorMiddleware(error: any, _req: Request, res: Response, _next: NextFunction) {
  logger.error({ error: error.message, stack: error.stack }, 'request failed');

  const status = error.status || 500;
  const message = status === 500 ? 'Internal server error' : error.message;

  res.status(status).json({ error: message });
}
