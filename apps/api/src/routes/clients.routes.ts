import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '@/db/index.js';
import {
  clientAccounts,
  searchConsoleQueries,
  googleAdsQueries,
  searchQueries,
  queryOverlaps,
  recommendations
} from '@/db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from '@/utils/logger.js';
import { getClientRecommendations } from '@/services/recommendation-storage.service.js';

const router = Router();

// Validation schemas
const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(255),
});

const updateClientSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  googleAdsCustomerId: z.string().optional(),
  searchConsoleSiteUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

/**
 * POST /api/clients
 * Create a new client account
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = createClientSchema.parse(req.body);
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Create client account
    const [client] = await db
      .insert(clientAccounts)
      .values({
        agencyId: user.agencyId,
        name,
        isActive: true,
      })
      .returning();

    logger.info({ clientId: client.id, userId: user.id }, 'Client created');

    res.status(201).json({ id: client.id, name: client.name });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    logger.error({ error }, 'Failed to create client');
    res.status(500).json({ error: 'Failed to create client' });
  }
});

/**
 * GET /api/clients
 * List all clients for the authenticated user's agency
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const clients = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.agencyId, user.agencyId));

    res.json({ clients });
  } catch (error) {
    logger.error({ error }, 'Failed to list clients');
    res.status(500).json({ error: 'Failed to list clients' });
  }
});

/**
 * GET /api/clients/:id
 * Get a single client by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(
        and(
          eq(clientAccounts.id, id),
          eq(clientAccounts.agencyId, user.agencyId)
        )
      )
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    logger.error({ error }, 'Failed to get client');
    res.status(500).json({ error: 'Failed to get client' });
  }
});

/**
 * PATCH /api/clients/:id
 * Update a client
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = updateClientSchema.parse(req.body);
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify client exists and belongs to user's agency
    const [existingClient] = await db
      .select()
      .from(clientAccounts)
      .where(
        and(
          eq(clientAccounts.id, id),
          eq(clientAccounts.agencyId, user.agencyId)
        )
      )
      .limit(1);

    if (!existingClient) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Update client
    const [updatedClient] = await db
      .update(clientAccounts)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(clientAccounts.id, id))
      .returning();

    logger.info({ clientId: id, userId: user.id }, 'Client updated');

    res.json(updatedClient);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    logger.error({ error }, 'Failed to update client');
    res.status(500).json({ error: 'Failed to update client' });
  }
});

/**
 * DELETE /api/clients/:id
 * Delete a client
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify client exists and belongs to user's agency
    const [existingClient] = await db
      .select()
      .from(clientAccounts)
      .where(
        and(
          eq(clientAccounts.id, id),
          eq(clientAccounts.agencyId, user.agencyId)
        )
      )
      .limit(1);

    if (!existingClient) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Delete client (cascade will handle related records)
    await db
      .delete(clientAccounts)
      .where(eq(clientAccounts.id, id));

    logger.info({ clientId: id, userId: user.id }, 'Client deleted');

    res.json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    logger.error({ error }, 'Failed to delete client');
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

/**
 * GET /api/clients/:id/search-console-data
 * Fetch recent Search Console query data for a client
 */
router.get('/:id/search-console-data', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const days = parseInt(req.query.days as string) || 30;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify client exists and belongs to user's agency
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(and(eq(clientAccounts.id, id), eq(clientAccounts.agencyId, user.agencyId)))
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch and aggregate Search Console data
    const scData = await db
      .select({
        queryId: searchQueries.id,
        queryText: searchQueries.queryText,
        impressions: sql<number>`CAST(SUM(${searchConsoleQueries.impressions}) AS INTEGER)`,
        clicks: sql<number>`CAST(SUM(${searchConsoleQueries.clicks}) AS INTEGER)`,
        avgCtr: sql<number>`AVG(${searchConsoleQueries.ctr})`,
        avgPosition: sql<number>`AVG(${searchConsoleQueries.position})`,
        latestDate: sql<string>`MAX(${searchConsoleQueries.date})::text`,
      })
      .from(searchConsoleQueries)
      .innerJoin(searchQueries, eq(searchConsoleQueries.searchQueryId, searchQueries.id))
      .where(
        and(
          eq(searchConsoleQueries.clientAccountId, id),
          sql`${searchConsoleQueries.date} >= ${startDate.toISOString().split('T')[0]}`,
          sql`${searchConsoleQueries.date} <= ${endDate.toISOString().split('T')[0]}`
        )
      )
      .groupBy(searchQueries.id, searchQueries.queryText)
      .orderBy(desc(sql`SUM(${searchConsoleQueries.impressions})`))
      .limit(100);

    const queries = scData.map((row) => ({
      id: row.queryId,
      query: row.queryText,
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      ctr: parseFloat(row.avgCtr?.toString() || '0'),
      position: parseFloat(row.avgPosition?.toString() || '0'),
      date: row.latestDate,
    }));

    res.json({
      queries,
      totalQueries: queries.length,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch Search Console data');
    res.status(500).json({ error: 'Failed to fetch Search Console data' });
  }
});

/**
 * GET /api/clients/:id/google-ads-data
 * Fetch recent Google Ads query data for a client
 */
router.get('/:id/google-ads-data', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const days = parseInt(req.query.days as string) || 30;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify client exists and belongs to user's agency
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(and(eq(clientAccounts.id, id), eq(clientAccounts.agencyId, user.agencyId)))
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch and aggregate Google Ads data
    const adsData = await db
      .select({
        queryId: searchQueries.id,
        queryText: searchQueries.queryText,
        spend: sql<number>`SUM(${googleAdsQueries.costMicros}) / 1000000.0`,
        clicks: sql<number>`CAST(SUM(${googleAdsQueries.clicks}) AS INTEGER)`,
        impressions: sql<number>`CAST(SUM(${googleAdsQueries.impressions}) AS INTEGER)`,
        avgCpc: sql<number>`AVG(${googleAdsQueries.avgCpcMicros}) / 1000000.0`,
        conversions: sql<number>`SUM(${googleAdsQueries.conversions})`,
        latestDate: sql<string>`MAX(${googleAdsQueries.date})::text`,
      })
      .from(googleAdsQueries)
      .innerJoin(searchQueries, eq(googleAdsQueries.searchQueryId, searchQueries.id))
      .where(
        and(
          eq(googleAdsQueries.clientAccountId, id),
          sql`${googleAdsQueries.date} >= ${startDate.toISOString().split('T')[0]}`,
          sql`${googleAdsQueries.date} <= ${endDate.toISOString().split('T')[0]}`
        )
      )
      .groupBy(searchQueries.id, searchQueries.queryText)
      .orderBy(desc(sql`SUM(${googleAdsQueries.costMicros})`))
      .limit(100);

    const totalSpend = adsData.reduce((sum, row) => sum + (parseFloat(row.spend?.toString() || '0') || 0), 0);

    const queries = adsData.map((row) => ({
      id: row.queryId,
      query: row.queryText,
      spend: parseFloat(row.spend?.toString() || '0'),
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      cpc: parseFloat(row.avgCpc?.toString() || '0'),
      conversions: parseFloat(row.conversions?.toString() || '0'),
      conversionValue: 0, // Could add this if we track it
      date: row.latestDate,
    }));

    res.json({
      queries,
      totalQueries: queries.length,
      totalSpend,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch Google Ads data');
    res.status(500).json({ error: 'Failed to fetch Google Ads data' });
  }
});

/**
 * GET /api/clients/:id/query-overlaps
 * Fetch queries that appear in both Google Ads and Search Console
 */
router.get('/:id/query-overlaps', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const days = parseInt(req.query.days as string) || 30;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify client exists and belongs to user's agency
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(and(eq(clientAccounts.id, id), eq(clientAccounts.agencyId, user.agencyId)))
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // For now, return empty overlaps since we don't have Google Ads data yet
    // TODO: Remove this once Google Ads API access is available
    return res.json({
      overlaps: [],
      totalOverlaps: 0,
      potentialSavings: 0,
      message: 'Query overlaps require both Google Ads and Search Console data. Connect Google Ads to see overlaps.',
    });

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Check if we have any overlaps first
    const [overlapCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(queryOverlaps)
      .where(eq(queryOverlaps.clientAccountId, id));

    // If no overlaps exist, return empty result early
    if (!overlapCount || overlapCount.count === 0) {
      return res.json({
        overlaps: [],
        totalOverlaps: 0,
        potentialSavings: 0,
      });
    }

    // Fetch overlaps with aggregated metrics
    const overlapData = await db
      .select({
        overlapId: queryOverlaps.id,
        queryId: searchQueries.id,
        queryText: searchQueries.queryText,
        adsSpend: sql<number>`SUM(${googleAdsQueries.costMicros}) / 1000000.0`,
        adsClicks: sql<number>`SUM(${googleAdsQueries.clicks})`,
        adsCpc: sql<number>`AVG(${googleAdsQueries.avgCpcMicros}) / 1000000.0`,
        adsConversions: sql<number>`SUM(${googleAdsQueries.conversions})`,
        scPosition: sql<number>`AVG(${searchConsoleQueries.position})`,
        scCtr: sql<number>`AVG(${searchConsoleQueries.ctr})`,
        scImpressions: sql<number>`SUM(${searchConsoleQueries.impressions})`,
        scClicks: sql<number>`SUM(${searchConsoleQueries.clicks})`,
        hasRecommendation: sql<boolean>`CASE WHEN COUNT(${recommendations.id}) > 0 THEN true ELSE false END`,
        recommendationId: sql<string>`MAX(${recommendations.id})`,
      })
      .from(queryOverlaps)
      .innerJoin(searchQueries, eq(queryOverlaps.searchQueryId, searchQueries.id))
      .innerJoin(
        googleAdsQueries,
        and(
          eq(googleAdsQueries.searchQueryId, searchQueries.id),
          sql`${googleAdsQueries.date} >= ${startDate.toISOString().split('T')[0]}`,
          sql`${googleAdsQueries.date} <= ${endDate.toISOString().split('T')[0]}`
        )
      )
      .innerJoin(
        searchConsoleQueries,
        and(
          eq(searchConsoleQueries.searchQueryId, searchQueries.id),
          sql`${searchConsoleQueries.date} >= ${startDate.toISOString().split('T')[0]}`,
          sql`${searchConsoleQueries.date} <= ${endDate.toISOString().split('T')[0]}`
        )
      )
      .leftJoin(
        recommendations,
        and(
          eq(recommendations.queryOverlapId, queryOverlaps.id),
          eq(recommendations.status, 'pending')
        )
      )
      .where(eq(queryOverlaps.clientAccountId, id))
      .groupBy(queryOverlaps.id, searchQueries.id, searchQueries.queryText)
      .orderBy(desc(sql`SUM(${googleAdsQueries.costMicros})`))
      .limit(100);

    const overlaps = overlapData.map((row) => ({
      queryId: row.queryId,
      queryText: row.queryText,
      googleAds: {
        spend: parseFloat(row.adsSpend?.toString() || '0'),
        clicks: row.adsClicks || 0,
        cpc: parseFloat(row.adsCpc?.toString() || '0'),
        conversions: parseFloat(row.adsConversions?.toString() || '0'),
      },
      searchConsole: {
        position: parseFloat(row.scPosition?.toString() || '0'),
        ctr: parseFloat(row.scCtr?.toString() || '0'),
        impressions: row.scImpressions || 0,
        clicks: row.scClicks || 0,
      },
      hasRecommendation: row.hasRecommendation || false,
      recommendationId: row.recommendationId || undefined,
    }));

    // Calculate potential savings (queries with good organic position < 5)
    const potentialSavings = overlaps
      .filter((o) => o.searchConsole.position < 5)
      .reduce((sum, o) => sum + o.googleAds.spend, 0);

    res.json({
      overlaps,
      totalOverlaps: overlaps.length,
      potentialSavings,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch query overlaps');
    res.status(500).json({ error: 'Failed to fetch query overlaps' });
  }
});

/**
 * GET /api/clients/:id/recommendations
 * Get recommendations for a client with detailed analysis
 */
router.get('/:id/recommendations', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify client exists and belongs to user's agency
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(and(eq(clientAccounts.id, id), eq(clientAccounts.agencyId, user.agencyId)))
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Build filter object from query params
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.recommendationType) filters.recommendationType = req.query.recommendationType;
    if (req.query.confidenceLevel) filters.confidenceLevel = req.query.confidenceLevel;

    // Fetch recommendations with query text
    const recs = await getClientRecommendations(id, filters);

    // Enrich with query text
    const enrichedRecs = await Promise.all(
      recs.map(async (rec) => {
        const [overlap] = await db
          .select({ queryText: searchQueries.queryText })
          .from(queryOverlaps)
          .innerJoin(searchQueries, eq(queryOverlaps.searchQueryId, searchQueries.id))
          .where(eq(queryOverlaps.id, rec.queryOverlapId))
          .limit(1);

        return {
          id: rec.id,
          queryText: overlap?.queryText || 'Unknown query',
          recommendationType: rec.recommendationType,
          confidenceLevel: rec.confidenceLevel,
          currentMonthlySpend: parseFloat(rec.currentMonthlySpend?.toString() || '0'),
          recommendedMonthlySpend: parseFloat(rec.recommendedMonthlySpend?.toString() || '0'),
          estimatedMonthlySavings: parseFloat(rec.estimatedMonthlySavings?.toString() || '0'),
          reasoning: rec.reasoning,
          keyFactors: rec.keyFactors || [],
          status: rec.status,
          createdAt: rec.createdAt?.toISOString() || '',
        };
      })
    );

    // Calculate summary statistics
    const summary = {
      total: enrichedRecs.length,
      byType: {
        reduce: enrichedRecs.filter((r) => r.recommendationType === 'reduce').length,
        pause: enrichedRecs.filter((r) => r.recommendationType === 'pause').length,
        increase: enrichedRecs.filter((r) => r.recommendationType === 'increase').length,
        maintain: enrichedRecs.filter((r) => r.recommendationType === 'maintain').length,
      },
      byStatus: {
        pending: enrichedRecs.filter((r) => r.status === 'pending').length,
        approved: enrichedRecs.filter((r) => r.status === 'approved').length,
        rejected: enrichedRecs.filter((r) => r.status === 'rejected').length,
        applied: enrichedRecs.filter((r) => r.status === 'applied').length,
      },
      totalPotentialSavings: enrichedRecs.reduce((sum, r) => sum + r.estimatedMonthlySavings, 0),
    };

    res.json({
      recommendations: enrichedRecs,
      summary,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch recommendations');
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

/**
 * POST /api/clients/:id/analyze
 * Trigger AI analysis for a specific client (moved from analysis routes)
 */
router.post('/:id/analyze', async (req: Request, res: Response) => {
  // Import analysis handler from analysis routes
  const analysisRoutes = await import('./analysis.routes.js');
  const analysisHandler = analysisRoutes.default.stack.find(
    (layer: any) => layer.route?.path === '/run/:clientId' && layer.route?.methods.post
  )?.route?.stack[0].handle;

  if (analysisHandler) {
    // Rewrite params to match analysis route format
    req.params.clientId = req.params.id;
    return analysisHandler(req, res, () => {});
  }

  res.status(500).json({ error: 'Analysis handler not found' });
});

/**
 * GET /api/clients/:id/competitors
 * Get competitors for a client (Phase 2 - placeholder)
 */
router.get('/:id/competitors', (_req, res) => {
  res.json({ message: 'client competitors placeholder' });
});

/**
 * POST /api/clients/:id/sync
 * Trigger manual data sync for a client from Google Ads and Search Console
 */
router.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify client exists and belongs to user's agency
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(and(eq(clientAccounts.id, id), eq(clientAccounts.agencyId, user.agencyId)))
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Queue sync job for this client
    const { syncQueue } = await import('@/workers/sync.worker.js');

    const job = await syncQueue.add('manual-sync', {
      clientId: id,
      type: 'manual',
      trigger: 'user_refresh',
    });

    logger.info(
      { clientId: id, jobId: job.id, userId: user.id },
      'Manual sync job queued'
    );

    res.json({
      success: true,
      message: 'Data sync initiated',
      jobId: job.id,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to initiate manual sync');
    res.status(500).json({ error: 'Failed to initiate data sync' });
  }
});

export default router;
