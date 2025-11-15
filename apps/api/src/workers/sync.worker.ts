import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { syncLogger } from '@/utils/logger';

const connection = new IORedis(process.env.UPSTASH_REDIS_URL || '', {
  lazyConnect: true,
  password: process.env.UPSTASH_REDIS_TOKEN
});

export const syncQueue = new Queue('sync', { connection });

export const syncWorker = new Worker(
  'sync',
  async (job) => {
    syncLogger.info({ jobId: job.id }, 'Sync job placeholder');
  },
  { connection }
);
