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

      // Sync GA4 data if connected
      if (client.ga4RefreshTokenEncrypted) {
        syncLogger.info({ clientId }, 'Fetching GA4 data');

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30); // Last 30 days

        const { getGA4Analytics } = await import('@/services/ga4.service.js');
        const ga4Data = await getGA4Analytics(
          clientId,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        );

        syncLogger.info(
          { clientId, recordCount: ga4Data.length },
          'GA4 data fetched'
        );

        // Process and store GA4 data
        const { ga4Metrics } = await import('@/db/schema.js');
        for (const row of ga4Data) {
          await db
            .insert(ga4Metrics)
            .values({
              clientAccountId: clientId,
              date: row.date,
              sessions: row.sessions,
              engagementRate: row.engagementRate.toString(),
              viewsPerSession: row.viewsPerSession.toString(),
              conversions: row.conversions.toString(),
              totalRevenue: row.totalRevenue.toString(),
              averageSessionDuration: row.averageSessionDuration.toString(),
              bounceRate: row.bounceRate.toString(),
            })
            .onConflictDoNothing();

          recordsProcessed++;
        }

        syncLogger.info(
          { clientId, recordsProcessed },
          'GA4 data stored'
        );

        // Also sync GA4 landing page metrics
        syncLogger.info({ clientId }, 'Fetching GA4 landing page metrics');

        const { getGA4LandingPageMetrics } = await import('@/services/ga4.service.js');
        const ga4PageData = await getGA4LandingPageMetrics(
          clientId,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        );

        syncLogger.info(
          { clientId, recordCount: ga4PageData.length },
          'GA4 landing page metrics fetched'
        );

        // Process and store GA4 landing page data
        const { ga4LandingPageMetrics } = await import('@/db/schema.js');
        for (const row of ga4PageData) {
          await db
            .insert(ga4LandingPageMetrics)
            .values({
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
            })
            .onConflictDoNothing();

          recordsProcessed++;
        }

        syncLogger.info(
          { clientId, recordsProcessed },
          'GA4 landing page metrics stored'
        );
      }

      // Sync Google Ads data if connected
      if (client.googleAdsRefreshTokenEncrypted) {
        syncLogger.info({ clientId }, 'Fetching Google Ads data');

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30); // Last 30 days

        const { getSearchQueryReport } = await import('@/services/google-ads.service.js');
        const adsData = await getSearchQueryReport(
          clientId,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        );

        syncLogger.info(
          { clientId, recordCount: adsData.length },
          'Google Ads data fetched'
        );

        // Process and store Google Ads data
        const { googleAdsQueries } = await import('@/db/schema.js');
        for (const row of adsData) {
          // Normalize and hash the query
          const normalized = normalizeQuery(row.searchTerm);
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
                queryText: row.searchTerm,
                queryNormalized: normalized,
                queryHash: hash,
              })
              .returning();
          }

          // Insert Google Ads query data
          await db
            .insert(googleAdsQueries)
            .values({
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
            })
            .onConflictDoNothing(); // Skip if already exists

          recordsProcessed++;
        }

        syncLogger.info(
          { clientId, recordsProcessed },
          'Google Ads data stored'
        );
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
