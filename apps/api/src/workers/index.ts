import './sync.worker';
import { startScheduler } from './scheduler';
import { workerLogger } from '@/utils/logger';

startScheduler();

process.on('SIGTERM', () => {
  workerLogger.info('worker shutting down');
  process.exit(0);
});
