import pino from 'pino';

const isDevelopment = import.meta.env.DEV;

export const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
  browser: {
    asObject: true,
    serialize: true,
    transmit: !isDevelopment
      ? {
          level: 'error',
          send: (level, logEvent) => {
            fetch('/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                level,
                messages: logEvent.messages,
                timestamp: Date.now()
              })
            }).catch(() => {
              // noop
            });
          }
        }
      : undefined
  }
});

export const log = {
  debug: (...args: any[]) => logger.debug(...args),
  info: (...args: any[]) => logger.info(...args),
  warn: (...args: any[]) => logger.warn(...args),
  error: (...args: any[]) => logger.error(...args)
};
