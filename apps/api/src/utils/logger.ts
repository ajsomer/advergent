import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    : undefined,
  base: {
    env: process.env.NODE_ENV,
    platform: process.env.RENDER ? 'render' : 'local'
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers[\"set-cookie\"]',
      '*.password',
      '*.password_hash',
      '*.access_token',
      '*.refresh_token',
      '*.google_ads_refresh_token_encrypted',
      '*.search_console_refresh_token_encrypted',
      '*.apiKey'
    ],
    remove: true
  }
});

export const authLogger = logger.child({ module: 'auth' });
export const dbLogger = logger.child({ module: 'database' });
export const apiLogger = logger.child({ module: 'api' });
export const workerLogger = logger.child({ module: 'worker' });
export const syncLogger = logger.child({ module: 'sync' });
export const aiLogger = logger.child({ module: 'ai' });
