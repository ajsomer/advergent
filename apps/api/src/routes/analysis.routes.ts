import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db, clientAccounts, googleAdsQueries, searchConsoleQueries, searchQueries } from '@/db/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '@/utils/logger.js';
import { findOverlappingQueries, sortBySpend, filterBySpendThreshold } from '@/services/query-matcher.service.js';
import { analyzeQueryOverlap, analyzeBatchQueryOverlaps } from '@/services/ai-analyzer.service.js';
import { saveRecommendation, getRecommendationStats } from '@/services/recommendation-storage.service.js';
import { getOrCreateQuery } from '@/services/query-matcher.service.js';
import type { GoogleAdsQuery, SearchConsoleQuery } from '@/services/query-matcher.service.js';

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
        query: googleAdsQueries.query,
        cpc: googleAdsQueries.avgCpc,
        spend: googleAdsQueries.cost,
        clicks: googleAdsQueries.clicks,
        conversions: googleAdsQueries.conversions,
        conversionValue: googleAdsQueries.conversionValue,
      })
      .from(googleAdsQueries)
      .where(eq(googleAdsQueries.clientAccountId, clientId))
      .orderBy(desc(googleAdsQueries.date))
      .limit(1000);

    // Fetch recent Search Console queries (last 30 days)
    const scData = await db
      .select({
        query: searchConsoleQueries.query,
        position: searchConsoleQueries.position,
        ctr: searchConsoleQueries.ctr,
        impressions: searchConsoleQueries.impressions,
        clicks: searchConsoleQueries.clicks,
      })
      .from(searchConsoleQueries)
      .where(eq(searchConsoleQueries.clientAccountId, clientId))
      .orderBy(desc(searchConsoleQueries.date))
      .limit(1000);

    analysisLogger.info(
      {
        clientId,
        adsQueries: adsData.length,
        scQueries: scData.length,
      },
      'Fetched query data'
    );

    if (adsData.length === 0) {
      return res.status(400).json({
        error: 'No Google Ads data available for analysis',
        message: 'Please ensure Google Ads sync has completed',
      });
    }

    if (scData.length === 0) {
      return res.status(400).json({
        error: 'No Search Console data available for analysis',
        message: 'Please ensure Search Console sync has completed',
      });
    }

    // Convert to GoogleAdsQuery and SearchConsoleQuery format
    const googleAdsQueries: GoogleAdsQuery[] = adsData.map((row) => ({
      query: row.query,
      cpc: parseFloat(row.cpc?.toString() || '0'),
      spend: parseFloat(row.spend?.toString() || '0'),
      clicks: row.clicks || 0,
      conversions: row.conversions || 0,
      conversionValue: parseFloat(row.conversionValue?.toString() || '0'),
    }));

    const searchConsoleQueries: SearchConsoleQuery[] = scData.map((row) => ({
      query: row.query,
      position: parseFloat(row.position?.toString() || '0'),
      ctr: parseFloat(row.ctr?.toString() || '0'),
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
    }));

    // Find overlapping queries
    let overlaps = findOverlappingQueries(googleAdsQueries, searchConsoleQueries);

    analysisLogger.info(
      { clientId, overlapCount: overlaps.length },
      'Found query overlaps'
    );

    if (overlaps.length === 0) {
      return res.json({
        success: true,
        clientId,
        analyzedQueries: 0,
        recommendationsCreated: 0,
        estimatedTotalSavings: 0,
        processingTime: Date.now() - startTime,
        message: 'No overlapping queries found between Google Ads and Search Console',
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

    // Analyze overlaps using AI (batch processing with rate limiting)
    const batchSize = parseInt(req.body.batchSize || '5');
    const delayMs = parseInt(req.body.delayMs || '1000');

    const analysisResults = await analyzeBatchQueryOverlaps(overlaps, undefined, {
      batchSize,
      delayMs,
    });

    // Save successful recommendations to database
    let recommendationsCreated = 0;
    let totalSavings = 0;

    for (const overlap of overlaps) {
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
