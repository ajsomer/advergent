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
  debug: (msg: string, ...args: any[]) => logger.debug(msg, ...args),
  info: (msg: string, ...args: any[]) => logger.info(msg, ...args),
  warn: (msg: string, ...args: any[]) => logger.warn(msg, ...args),
  error: (msg: string, ...args: any[]) => logger.error(msg, ...args)
};
