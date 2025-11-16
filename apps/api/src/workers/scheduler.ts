import IORedis from 'ioredis';
import cron from 'node-cron';
import { syncQueue } from './sync.worker';
import { workerLogger } from '@/utils/logger.js';

const redis = new IORedis({
  host: process.env.UPSTASH_REDIS_URL?.replace('https://', ''),
  port: 6379,
  password: process.env.UPSTASH_REDIS_TOKEN,
  tls: {},
  lazyConnect: true,
  maxRetriesPerRequest: null
});

const LEADER_KEY = 'scheduler:leader';
const LEADER_TTL = 30;
const processId = `${process.pid}-${Date.now()}`;

async function acquireLeadership() {
  const result = await redis.set(LEADER_KEY, processId, 'EX', LEADER_TTL, 'NX');
  return result === 'OK';
}

async function refreshLeadership() {
  const current = await redis.get(LEADER_KEY);
  if (current === processId) {
    await redis.expire(LEADER_KEY, LEADER_TTL);
    return true;
  }
  return false;
}

async function enqueueDailySyncs() {
  workerLogger.info('enqueue daily sync placeholder');
  await syncQueue.add('sync-client', { clientId: 'demo' });
}

export function startScheduler() {
  if (process.env.RUN_SCHEDULER === 'false') {
    workerLogger.info('scheduler disabled');
    return;
  }

  cron.schedule('*/5 * * * *', async () => {
    const leader = (await acquireLeadership()) || (await refreshLeadership());
    if (!leader) return;
    await enqueueDailySyncs();
  });

  workerLogger.info({ processId }, 'scheduler started');
}
