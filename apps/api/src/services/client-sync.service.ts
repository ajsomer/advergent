import { db } from '@/db/index.js';
import { clientAccounts, searchQueries, searchConsoleQueries, syncJobs } from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getSearchAnalytics } from '@/services/search-console.service.js';
import { normalizeQuery, hashQuery } from '@/services/query-matcher.service.js';
import { syncLogger } from '@/utils/logger.js';

/**
 * Run data sync for a client from Google Ads and Search Console
 *
 * @param clientId - Client account ID
 * @param trigger - What triggered the sync ('scheduled' | 'manual')
 * @param existingJobId - Optional sync_jobs.id to update (if already created)
 * @returns Object with success=true and recordsProcessed count
 * @throws Error if sync fails (caller must handle)
 *
 * Note: Creates sync_jobs DB record with status tracking.
 * On failure, DB record is marked 'failed' before throwing.
 */
export async function runClientSync(
  clientId: string,
  trigger: 'scheduled' | 'manual',
  existingJobId?: string
): Promise<{ success: true; recordsProcessed: number }> {
  syncLogger.info(
    { clientId, trigger },
    'Starting sync'
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

    // Create or use existing sync job record
    let syncJob;
    if (existingJobId) {
      // Manual sync: job already created, update to 'running'
      [syncJob] = await db
        .update(syncJobs)
        .set({
          status: 'running',
          startedAt: new Date(),
        })
        .where(eq(syncJobs.id, existingJobId))
        .returning();
    } else {
      // Scheduled sync: create new job
      [syncJob] = await db
        .insert(syncJobs)
        .values({
          clientAccountId: clientId,
          jobType: 'full_sync',
          status: 'running',
          startedAt: new Date(),
        })
        .returning();
    }

    let recordsProcessed = 0;

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Fetch all data sources in parallel for maximum performance
      syncLogger.info({ clientId }, 'Fetching all data sources in parallel');

      const [scData, ga4Data, ga4PageData, adsData] = await Promise.all([
        // Search Console data
        client.searchConsoleRefreshTokenEncrypted
          ? (async () => {
              syncLogger.info({ clientId }, 'Fetching Search Console data');
              const data = await getSearchAnalytics(clientId, startDateStr, endDateStr);
              syncLogger.info({ clientId, recordCount: data.length }, 'Search Console data fetched');
              return data;
            })()
          : Promise.resolve([]),

        // GA4 metrics data
        client.ga4RefreshTokenEncrypted
          ? (async () => {
              syncLogger.info({ clientId }, 'Fetching GA4 data');
              const { getGA4Analytics } = await import('@/services/ga4.service.js');
              const data = await getGA4Analytics(clientId, startDateStr, endDateStr);
              syncLogger.info({ clientId, recordCount: data.length }, 'GA4 data fetched');
              return data;
            })()
          : Promise.resolve([]),

        // GA4 landing page data
        client.ga4RefreshTokenEncrypted
          ? (async () => {
              syncLogger.info({ clientId }, 'Fetching GA4 landing page metrics');
              const { getGA4LandingPageMetrics } = await import('@/services/ga4.service.js');
              const data = await getGA4LandingPageMetrics(clientId, startDateStr, endDateStr);
              syncLogger.info({ clientId, recordCount: data.length }, 'GA4 landing page metrics fetched');
              return data;
            })()
          : Promise.resolve([]),

        // Google Ads data
        client.googleAdsRefreshTokenEncrypted
          ? (async () => {
              syncLogger.info({ clientId }, 'Fetching Google Ads data');
              const { getSearchQueryReport } = await import('@/services/google-ads.service.js');
              const data = await getSearchQueryReport(clientId, startDateStr, endDateStr);
              syncLogger.info({ clientId, recordCount: data.length }, 'Google Ads data fetched');
              return data;
            })()
          : Promise.resolve([]),
      ]);

      syncLogger.info(
        {
          clientId,
          scCount: scData.length,
          ga4Count: ga4Data.length,
          ga4PageCount: ga4PageData.length,
          adsCount: adsData.length
        },
        'All data sources fetched successfully'
      );

      // Process Search Console data with batch inserts
      if (scData.length > 0) {
        syncLogger.info({ clientId, recordCount: scData.length }, 'Processing Search Console data');

        // Build a map of query hashes to search query records
        const queryMap = new Map<string, any>();
        const uniqueQueries = new Map<string, { query: string; normalized: string; hash: string }>();

        // Collect all unique queries first
        for (const row of scData) {
          const normalized = normalizeQuery(row.query);
          const hash = hashQuery(normalized);
          if (!uniqueQueries.has(hash)) {
            uniqueQueries.set(hash, { query: row.query, normalized, hash });
          }
        }

        // Fetch existing queries in batch
        const existingQueries = await db
          .select()
          .from(searchQueries)
          .where(eq(searchQueries.clientAccountId, clientId));

        for (const q of existingQueries) {
          queryMap.set(q.queryHash, q);
        }

        // Insert new queries in batch
        const newQueries = Array.from(uniqueQueries.values()).filter(q => !queryMap.has(q.hash));
        if (newQueries.length > 0) {
          const BATCH_SIZE = 500;
          for (let i = 0; i < newQueries.length; i += BATCH_SIZE) {
            const batch = newQueries.slice(i, i + BATCH_SIZE);
            const inserted = await db
              .insert(searchQueries)
              .values(
                batch.map(q => ({
                  clientAccountId: clientId,
                  queryText: q.query,
                  queryNormalized: q.normalized,
                  queryHash: q.hash,
                }))
              )
              .returning();

            for (const q of inserted) {
              queryMap.set(q.queryHash, q);
            }
          }
          syncLogger.info({ clientId, newQueriesCount: newQueries.length }, 'New search queries created');
        }

        // Batch insert Search Console query records
        const BATCH_SIZE = 500;
        for (let i = 0; i < scData.length; i += BATCH_SIZE) {
          const batch = scData.slice(i, i + BATCH_SIZE);
          const values = batch.map(row => {
            const normalized = normalizeQuery(row.query);
            const hash = hashQuery(normalized);
            const searchQuery = queryMap.get(hash);

            return {
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
            };
          });

          await db.insert(searchConsoleQueries).values(values).onConflictDoNothing();
          recordsProcessed += batch.length;
        }

        syncLogger.info({ clientId, recordsProcessed }, 'Search Console data stored');
      }

      // Process GA4 metrics data with batch inserts
      if (ga4Data.length > 0) {
        syncLogger.info({ clientId, recordCount: ga4Data.length }, 'Processing GA4 data');

        const { ga4Metrics } = await import('@/db/schema.js');
        const BATCH_SIZE = 500;

        for (let i = 0; i < ga4Data.length; i += BATCH_SIZE) {
          const batch = ga4Data.slice(i, i + BATCH_SIZE);
          await db
            .insert(ga4Metrics)
            .values(
              batch.map(row => ({
                clientAccountId: clientId,
                date: row.date,
                sessions: row.sessions,
                engagementRate: row.engagementRate.toString(),
                viewsPerSession: row.viewsPerSession.toString(),
                conversions: row.conversions.toString(),
                totalRevenue: row.totalRevenue.toString(),
                averageSessionDuration: row.averageSessionDuration.toString(),
                bounceRate: row.bounceRate.toString(),
              }))
            )
            .onConflictDoNothing();

          recordsProcessed += batch.length;
        }

        syncLogger.info({ clientId, recordsProcessed }, 'GA4 data stored');
      }

      // Process GA4 landing page data with batch inserts
      if (ga4PageData.length > 0) {
        syncLogger.info({ clientId, recordCount: ga4PageData.length }, 'Processing GA4 landing page metrics');

        const { ga4LandingPageMetrics } = await import('@/db/schema.js');
        const BATCH_SIZE = 500;

        for (let i = 0; i < ga4PageData.length; i += BATCH_SIZE) {
          const batch = ga4PageData.slice(i, i + BATCH_SIZE);
          await db
            .insert(ga4LandingPageMetrics)
            .values(
              batch.map(row => ({
                clientAccountId: clientId,
                date: row.date,
                landingPage: row.landingPage,
                sessionSource: row.sessionSource,
                sessionMedium: row.sessionMedium,
                sessions: row.sessions,
                engagementRate: row.engagementRate.toString(),
                conversions: row.conversions.toString(),
                totalRevenue: row.totalRevenue.toString(),
                averageSessionDuration: row.averageSessionDuration.toString(),
                bounceRate: row.bounceRate.toString(),
              }))
            )
            .onConflictDoNothing();

          recordsProcessed += batch.length;
        }

        syncLogger.info({ clientId, recordsProcessed }, 'GA4 landing page metrics stored');
      }

      // Process Google Ads data with batch inserts
      if (adsData.length > 0) {
        syncLogger.info({ clientId, recordCount: adsData.length }, 'Processing Google Ads data');

        // Build a map of query hashes to search query records (might have new queries from ads)
        const queryMap = new Map<string, any>();
        const uniqueQueries = new Map<string, { query: string; normalized: string; hash: string }>();

        // Collect all unique queries from ads data
        for (const row of adsData) {
          const normalized = normalizeQuery(row.searchTerm);
          const hash = hashQuery(normalized);
          if (!uniqueQueries.has(hash)) {
            uniqueQueries.set(hash, { query: row.searchTerm, normalized, hash });
          }
        }

        // Fetch existing queries in batch
        const existingQueries = await db
          .select()
          .from(searchQueries)
          .where(eq(searchQueries.clientAccountId, clientId));

        for (const q of existingQueries) {
          queryMap.set(q.queryHash, q);
        }

        // Insert new queries in batch
        const newQueries = Array.from(uniqueQueries.values()).filter(q => !queryMap.has(q.hash));
        if (newQueries.length > 0) {
          const BATCH_SIZE = 500;
          for (let i = 0; i < newQueries.length; i += BATCH_SIZE) {
            const batch = newQueries.slice(i, i + BATCH_SIZE);
            const inserted = await db
              .insert(searchQueries)
              .values(
                batch.map(q => ({
                  clientAccountId: clientId,
                  queryText: q.query,
                  queryNormalized: q.normalized,
                  queryHash: q.hash,
                }))
              )
              .returning();

            for (const q of inserted) {
              queryMap.set(q.queryHash, q);
            }
          }
          syncLogger.info({ clientId, newQueriesCount: newQueries.length }, 'New search queries created from Google Ads');
        }

        // Batch insert Google Ads query records
        const { googleAdsQueries } = await import('@/db/schema.js');
        const BATCH_SIZE = 500;

        for (let i = 0; i < adsData.length; i += BATCH_SIZE) {
          const batch = adsData.slice(i, i + BATCH_SIZE);
          const values = batch.map(row => {
            const normalized = normalizeQuery(row.searchTerm);
            const hash = hashQuery(normalized);
            const searchQuery = queryMap.get(hash);

            return {
              clientAccountId: clientId,
              searchQueryId: searchQuery.id,
              date: row.date,
              impressions: row.impressions,
              clicks: row.clicks,
              costMicros: row.costMicros,
              conversions: row.conversions.toString(),
              ctr: row.ctr.toString(),
              avgCpcMicros: Math.round(row.averageCpc),
              campaignId: row.campaignId,
              campaignName: row.campaignName,
              adGroupId: row.adGroupId,
              adGroupName: row.adGroupName,
            };
          });

          await db.insert(googleAdsQueries).values(values).onConflictDoNothing();
          recordsProcessed += batch.length;
        }

        syncLogger.info({ clientId, recordsProcessed }, 'Google Ads data stored');
      }

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
        { clientId, recordsProcessed, trigger },
        'Sync completed successfully'
      );

      return { success: true, recordsProcessed };
    } catch (error) {
      // Mark sync job as failed in DB
      await db
        .update(syncJobs)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          recordsProcessed,
        })
        .where(eq(syncJobs.id, syncJob.id));

      // Re-throw so caller knows sync failed
      throw error;
    }
  } catch (error) {
    syncLogger.error(
      { clientId, trigger, error },
      'Sync failed'
    );
    // Re-throw to caller
    throw error;
  }
}
