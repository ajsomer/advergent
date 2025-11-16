import './sync.worker.js';
import { startScheduler } from './scheduler.js';
import { workerLogger } from '@/utils/logger.js';

startScheduler();

process.on('SIGTERM', () => {
  workerLogger.info('worker shutting down');
  process.exit(0);
});
