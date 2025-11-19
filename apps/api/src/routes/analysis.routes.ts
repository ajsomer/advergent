import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  db,
  clientAccounts,
  googleAdsQueries as googleAdsQueriesTable,
  searchConsoleQueries as searchConsoleQueriesTable,
  searchQueries
} from '@/db/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '@/utils/logger.js';
import {
  findOverlappingQueries,
  filterBySpendThreshold,
  sortBySpend,
  type GoogleAdsQuery,
  type SearchConsoleQuery,
  type QueryOverlap,
} from '@/services/query-matcher.service.js';
import { analyzeQueryOverlap, analyzeBatchQueryOverlaps } from '@/services/ai-analyzer.service.js';
import { saveRecommendation, getRecommendationStats } from '@/services/recommendation-storage.service.js';
import { getOrCreateQuery } from '@/services/query-matcher.service.js';

const router = Router();
const analysisLogger = logger.child({ module: 'analysis-routes' });

/**
 * POST /api/analysis/run/:clientId
 * Run AI analysis on query overlaps for a specific client
 */
router.post('/run/:clientId', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { clientId } = req.params;
  const user = (req as any).user;

  try {
    analysisLogger.info({ clientId, userId: user?.id }, 'Starting analysis');

    // Verify client exists and user has access
    const client = await db
      .select()
      .from(clientAccounts)
      .where(
        and(
          eq(clientAccounts.id, clientId),
          eq(clientAccounts.agencyId, user.agencyId)
        )
      )
      .limit(1);

    if (!client.length) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Fetch recent Google Ads queries (last 30 days)
    const adsData = await db
      .select({
        query: searchQueries.queryText,
        cpc: googleAdsQueriesTable.avgCpcMicros,
        spend: googleAdsQueriesTable.costMicros,
        clicks: googleAdsQueriesTable.clicks,
        conversions: googleAdsQueriesTable.conversions,
        impressions: googleAdsQueriesTable.impressions,
      })
      .from(googleAdsQueriesTable)
      .innerJoin(searchQueries, eq(googleAdsQueriesTable.searchQueryId, searchQueries.id))
      .where(eq(googleAdsQueriesTable.clientAccountId, clientId))
      .orderBy(desc(googleAdsQueriesTable.date))
      .limit(1000);

    // Fetch recent Search Console queries (last 30 days)
    const scData = await db
      .select({
        query: searchQueries.queryText,
        position: searchConsoleQueriesTable.position,
        ctr: searchConsoleQueriesTable.ctr,
        impressions: searchConsoleQueriesTable.impressions,
        clicks: searchConsoleQueriesTable.clicks,
        page: searchConsoleQueriesTable.page,
      })
      .from(searchConsoleQueriesTable)
      .innerJoin(searchQueries, eq(searchConsoleQueriesTable.searchQueryId, searchQueries.id))
      .where(eq(searchConsoleQueriesTable.clientAccountId, clientId))
      .orderBy(desc(searchConsoleQueriesTable.date))
      .limit(1000);

    analysisLogger.info(
      {
        clientId,
        adsQueries: adsData.length,
        scQueries: scData.length,
      },
      'Fetched query data'
    );

    // Check if we have at least some data to work with
    if (scData.length === 0 && adsData.length === 0) {
      return res.status(400).json({
        error: 'No data available for analysis',
        message: 'Please ensure at least Search Console or Google Ads sync has completed',
      });
    }

    // Warning if only partial data
    if (adsData.length === 0) {
      analysisLogger.warn({ clientId }, 'No Google Ads data - analysis will focus on organic performance only');
    }

    if (scData.length === 0) {
      analysisLogger.warn({ clientId }, 'No Search Console data - analysis will focus on paid performance only');
    }

    // Convert to GoogleAdsQuery and SearchConsoleQuery format
    const googleAdsQueries: GoogleAdsQuery[] = adsData.map((row) => ({
      query: row.query,
      cpc: parseFloat(row.cpc?.toString() || '0') / 1000000, // Convert micros to currency
      spend: parseFloat(row.spend?.toString() || '0') / 1000000, // Convert micros to currency
      clicks: row.clicks || 0,
      conversions: parseFloat(row.conversions?.toString() || '0'),
      conversionValue: 0, // Not stored in database yet, placeholder for future
    }));

    const searchConsoleQueries: SearchConsoleQuery[] = scData.map((row) => ({
      query: row.query,
      position: parseFloat(row.position?.toString() || '0'),
      ctr: parseFloat(row.ctr?.toString() || '0'),
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
    }));

    // Find overlapping queries (or analyze all SC queries if no Ads data)
    let overlaps: QueryOverlap[] = adsData.length > 0
      ? findOverlappingQueries(googleAdsQueries, searchConsoleQueries)
      : searchConsoleQueries.map(scQuery => ({
        queryText: scQuery.query,
        queryHash: scQuery.query.toLowerCase().replace(/\s+/g, '-'),
        googleAds: null as any, // No ads data available
        searchConsole: scQuery,
      }));

    analysisLogger.info(
      { clientId, overlapCount: overlaps.length, hasAdsData: adsData.length > 0 },
      adsData.length > 0 ? 'Found query overlaps' : 'Analyzing organic queries only'
    );

    if (overlaps.length === 0) {
      return res.json({
        success: true,
        clientId,
        analyzedQueries: 0,
        recommendationsCreated: 0,
        estimatedTotalSavings: 0,
        processingTime: Date.now() - startTime,
        message: adsData.length === 0
          ? 'No Search Console queries to analyze'
          : 'No overlapping queries found between Google Ads and Search Console',
      });
    }

    // Filter by minimum spend threshold ($10)
    const minSpendThreshold = parseFloat(req.body.minSpend || '10');
    overlaps = filterBySpendThreshold(overlaps, minSpendThreshold);

    // Sort by spend (highest first) and limit to top queries
    overlaps = sortBySpend(overlaps).slice(0, parseInt(req.body.maxQueries || '50'));

    analysisLogger.info(
      {
        clientId,
        filteredOverlapCount: overlaps.length,
        minSpendThreshold,
      },
      'Filtered and sorted overlaps'
    );

    // Fetch GA4 landing page metrics for correlation
    const { ga4LandingPageMetrics } = await import('@/db/schema.js');
    const ga4PageData = await db
      .select()
      .from(ga4LandingPageMetrics)
      .where(eq(ga4LandingPageMetrics.clientAccountId, clientId))
      .orderBy(desc(ga4LandingPageMetrics.date))
      .limit(1000);

    analysisLogger.info(
      { clientId, ga4PageCount: ga4PageData.length },
      'Fetched GA4 landing page metrics for correlation'
    );

    // Build page -> metrics mapping for quick lookup
    const pageMetricsMap = new Map<string, typeof ga4PageData>();
    for (const metric of ga4PageData) {
      const key = metric.landingPage;
      if (!pageMetricsMap.has(key)) {
        pageMetricsMap.set(key, []);
      }
      pageMetricsMap.get(key)!.push(metric);
    }

    // Enrich overlaps with landing page data from Search Console
    const enrichedOverlaps = overlaps.map(overlap => {
      // Find Search Console entries for this query that have page data
      const scEntries = scData.filter(row => row.query === overlap.queryText && row.page);

      // For each unique page, find corresponding GA4 metrics
      const landingPageInsights = scEntries
        .map(scRow => {
          const ga4Metrics = pageMetricsMap.get(scRow.page || '') || [];
          return {
            page: scRow.page || '',
            scMetrics: {
              position: parseFloat(scRow.position?.toString() || '0'),
              ctr: parseFloat(scRow.ctr?.toString() || '0'),
              impressions: scRow.impressions || 0,
              clicks: scRow.clicks || 0,
            },
            ga4Metrics: ga4Metrics.map(m => ({
              sessions: m.sessions || 0,
              engagementRate: parseFloat(m.engagementRate?.toString() || '0'),
              bounceRate: parseFloat(m.bounceRate?.toString() || '0'),
              conversions: parseFloat(m.conversions?.toString() || '0'),
              revenue: parseFloat(m.totalRevenue?.toString() || '0'),
              avgSessionDuration: parseFloat(m.averageSessionDuration?.toString() || '0'),
            })),
          };
        })
        .filter(insight => insight.page && insight.ga4Metrics.length > 0);

      return {
        ...overlap,
        landingPageInsights,
      };
    });

    // Analyze overlaps using AI (batch processing with rate limiting)
    const batchSize = parseInt(req.body.batchSize || '5');
    const delayMs = parseInt(req.body.delayMs || '1000');

    const analysisResults = await analyzeBatchQueryOverlaps(enrichedOverlaps, undefined, {
      batchSize,
      delayMs,
    });

    // Save successful recommendations to database
    let recommendationsCreated = 0;
    let totalSavings = 0;

    for (const overlap of enrichedOverlaps) {
      const result = analysisResults.get(overlap.queryHash);

      if (result && !(result instanceof Error)) {
        try {
          // Get or create search query record
          const searchQuery = await getOrCreateQuery(clientId, overlap.queryText);

          // Save recommendation
          await saveRecommendation(clientId, searchQuery.id, overlap, result);

          recommendationsCreated++;
          totalSavings += result.estimated_monthly_savings;

          analysisLogger.debug(
            {
              query: overlap.queryText,
              recommendationType: result.recommendation_type,
              savings: result.estimated_monthly_savings,
            },
            'Recommendation saved'
          );
        } catch (error) {
          analysisLogger.error(
            {
              error: error instanceof Error ? error.message : 'Unknown error',
              query: overlap.queryText,
            },
            'Failed to save recommendation'
          );
        }
      }
    }

    const processingTime = Date.now() - startTime;

    analysisLogger.info(
      {
        clientId,
        analyzedQueries: overlaps.length,
        recommendationsCreated,
        totalSavings,
        processingTime,
      },
      'Analysis complete'
    );

    res.json({
      success: true,
      clientId,
      analyzedQueries: overlaps.length,
      recommendationsCreated,
      estimatedTotalSavings: totalSavings,
      processingTime,
    });
  } catch (error) {
    analysisLogger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        clientId,
        userId: user?.id,
      },
      'Analysis failed'
    );

    res.status(500).json({
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/analysis/stats/:clientId
 * Get recommendation statistics for a client
 */
router.get('/stats/:clientId', async (req: Request, res: Response) => {
  const { clientId } = req.params;
  const user = (req as any).user;

  try {
    // Verify client exists and user has access
    const client = await db
      .select()
      .from(clientAccounts)
      .where(
        and(
          eq(clientAccounts.id, clientId),
          eq(clientAccounts.agencyId, user.agencyId)
        )
      )
      .limit(1);

    if (!client.length) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const stats = await getRecommendationStats(clientId);

    res.json(stats);
  } catch (error) {
    analysisLogger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        clientId,
      },
      'Failed to get recommendation stats'
    );

    res.status(500).json({
      error: 'Failed to get recommendation stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
