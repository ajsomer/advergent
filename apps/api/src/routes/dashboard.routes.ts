import { Router, Request, Response } from 'express';
import { db } from '@/db/index.js';
import { agencies, clientAccounts, recommendations, syncJobs } from '@/db/schema.js';
import { eq, and, sql, count, sum } from 'drizzle-orm';
import { logger } from '@/utils/logger.js';

const router = Router();

/**
 * GET /api/dashboard/stats
 * Returns aggregate statistics for the agency dashboard
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    const clerkOrgId = req.auth?.orgId;

    if (!userId || !clerkOrgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get agency by Clerk org ID
    const [agency] = await db
      .select()
      .from(agencies)
      .where(eq(agencies.clerkOrgId, clerkOrgId))
      .limit(1);

    if (!agency) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    // Get total clients for this agency
    const clientsResult = await db
      .select({ count: count() })
      .from(clientAccounts)
      .where(eq(clientAccounts.agencyId, agency.id));

    const totalClients = clientsResult[0]?.count || 0;

    // Get aggregate spend and savings from recommendations
    const statsResult = await db
      .select({
        totalMonthlySpend: sum(recommendations.currentMonthlySpend),
        totalEstimatedSavings: sum(recommendations.estimatedMonthlySavings),
        activeRecommendations: count(),
      })
      .from(recommendations)
      .innerJoin(clientAccounts, eq(recommendations.clientAccountId, clientAccounts.id))
      .where(
        and(
          eq(clientAccounts.agencyId, agency.id),
          eq(recommendations.status, 'pending')
        )
      );

    const stats = statsResult[0] || {
      totalMonthlySpend: '0',
      totalEstimatedSavings: '0',
      activeRecommendations: 0,
    };

    logger.info({ agencyId: agency.id, userId }, 'Dashboard stats fetched successfully');

    res.json({
      totalClients,
      totalMonthlySpend: Number(stats.totalMonthlySpend || 0),
      totalEstimatedSavings: Number(stats.totalEstimatedSavings || 0),
      activeRecommendations: stats.activeRecommendations,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching dashboard stats');
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

/**
 * GET /api/dashboard/clients
 * Returns list of all clients with metrics for the agency
 */
router.get('/clients', async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    const clerkOrgId = req.auth?.orgId;

    if (!userId || !clerkOrgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get agency by Clerk org ID
    const [agency] = await db
      .select()
      .from(agencies)
      .where(eq(agencies.clerkOrgId, clerkOrgId))
      .limit(1);

    if (!agency) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    // Fetch all clients for this agency
    const clients = await db
      .select({
        id: clientAccounts.id,
        name: clientAccounts.name,
        googleAdsCustomerId: clientAccounts.googleAdsCustomerId,
        googleAdsRefreshToken: clientAccounts.googleAdsRefreshTokenEncrypted,
        searchConsoleSiteUrl: clientAccounts.searchConsoleSiteUrl,
        searchConsoleRefreshToken: clientAccounts.searchConsoleRefreshTokenEncrypted,
        createdAt: clientAccounts.createdAt,
      })
      .from(clientAccounts)
      .where(eq(clientAccounts.agencyId, agency.id));

    // For each client, fetch additional metrics
    const clientsWithMetrics = await Promise.all(
      clients.map(async (client) => {
        // Get latest sync job
        const [latestSync] = await db
          .select({ completedAt: syncJobs.completedAt })
          .from(syncJobs)
          .where(
            and(
              eq(syncJobs.clientAccountId, client.id),
              eq(syncJobs.status, 'completed')
            )
          )
          .orderBy(sql`${syncJobs.completedAt} DESC`)
          .limit(1);

        // Get recommendations metrics for this client
        const [recommendationsData] = await db
          .select({
            monthlySpend: sum(recommendations.currentMonthlySpend),
            estimatedSavings: sum(recommendations.estimatedMonthlySavings),
            recommendationsCount: count(),
          })
          .from(recommendations)
          .where(
            and(
              eq(recommendations.clientAccountId, client.id),
              eq(recommendations.status, 'pending')
            )
          );

        return {
          id: client.id,
          name: client.name,
          googleAdsConnected: !!client.googleAdsRefreshToken,
          searchConsoleConnected: !!client.searchConsoleRefreshToken,
          monthlySpend: Number(recommendationsData?.monthlySpend || 0),
          estimatedSavings: Number(recommendationsData?.estimatedSavings || 0),
          recommendationsCount: recommendationsData?.recommendationsCount || 0,
          lastSyncAt: latestSync?.completedAt || null,
          createdAt: client.createdAt,
        };
      })
    );

    logger.info({ agencyId: agency.id, userId, clientCount: clients.length }, 'Dashboard clients fetched successfully');

    res.json({ clients: clientsWithMetrics });
  } catch (error) {
    logger.error({ error }, 'Error fetching dashboard clients');
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

export default router;
