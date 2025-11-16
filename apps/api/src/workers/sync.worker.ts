import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { syncLogger } from '@/utils/logger.js';
import { db } from '@/db/index.js';
import { clientAccounts, searchQueries, searchConsoleQueries, googleAdsQueries, syncJobs } from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getSearchAnalytics } from '@/services/search-console.service.js';
import { normalizeQuery, hashQuery } from '@/services/query-matcher.service.js';

// Parse Upstash Redis URL properly
const redisUrl = process.env.UPSTASH_REDIS_URL || '';
const redisHost = redisUrl.replace('https://', '').replace('http://', '');

const connection = new IORedis({
  host: redisHost,
  port: 6379,
  password: process.env.UPSTASH_REDIS_TOKEN,
  tls: {
    servername: redisHost, // SNI for TLS
  },
  family: 4, // Force IPv4
  lazyConnect: true,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: false,
});

export const syncQueue = new Queue('sync', { connection });

/**
 * Process a sync job to fetch data from Google Search Console and Google Ads
 */
async function processSyncJob(job: any) {
  const { clientId, type, trigger } = job.data;

  syncLogger.info(
    { jobId: job.id, clientId, type, trigger },
    'Starting sync job'
  );

  try {
    // Fetch client account
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.id, clientId))
      .limit(1);

    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    // Create sync job record
    const [syncJob] = await db
      .insert(syncJobs)
      .values({
        clientAccountId: clientId,
        jobType: 'full_sync',
        status: 'running',
        startedAt: new Date(),
      })
      .returning();

    let recordsProcessed = 0;

    try {
      // Sync Search Console data if connected
      if (client.searchConsoleRefreshTokenEncrypted) {
        syncLogger.info({ clientId }, 'Fetching Search Console data');

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30); // Last 30 days

        const scData = await getSearchAnalytics(
          clientId,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        );

        syncLogger.info(
          { clientId, recordCount: scData.length },
          'Search Console data fetched'
        );

        // Process and store Search Console data
        for (const row of scData) {
          // Normalize and hash the query
          const normalized = normalizeQuery(row.query);
          const hash = hashQuery(normalized);

          // Find or create search query
          let [searchQuery] = await db
            .select()
            .from(searchQueries)
            .where(
              and(
                eq(searchQueries.clientAccountId, clientId),
                eq(searchQueries.queryHash, hash)
              )
            )
            .limit(1);

          if (!searchQuery) {
            [searchQuery] = await db
              .insert(searchQueries)
              .values({
                clientAccountId: clientId,
                queryText: row.query,
                queryNormalized: normalized,
                queryHash: hash,
              })
              .returning();
          }

          // Insert Search Console query data
          await db
            .insert(searchConsoleQueries)
            .values({
              clientAccountId: clientId,
              searchQueryId: searchQuery.id,
              date: row.date,
              impressions: row.impressions,
              clicks: row.clicks,
              ctr: row.ctr.toString(),
              position: row.position.toString(),
              page: row.page,
              device: row.device,
              country: row.country,
              searchAppearance: row.searchAppearance,
              searchType: row.searchType,
            })
            .onConflictDoNothing(); // Skip if already exists

          recordsProcessed++;
        }

        syncLogger.info(
          { clientId, recordsProcessed },
          'Search Console data stored'
        );
      }

      // TODO: Sync Google Ads data if connected
      // This will be implemented similarly to Search Console sync

      // Mark sync job as completed
      await db
        .update(syncJobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          recordsProcessed,
        })
        .where(eq(syncJobs.id, syncJob.id));

      syncLogger.info(
        { jobId: job.id, clientId, recordsProcessed },
        'Sync job completed successfully'
      );

      return { success: true, recordsProcessed };
    } catch (error) {
      // Mark sync job as failed
      await db
        .update(syncJobs)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          recordsProcessed,
        })
        .where(eq(syncJobs.id, syncJob.id));

      throw error;
    }
  } catch (error) {
    syncLogger.error(
      { jobId: job.id, clientId, error },
      'Sync job failed'
    );
    throw error;
  }
}

export const syncWorker = new Worker(
  'sync',
  processSyncJob,
  { connection }
);
