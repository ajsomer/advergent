import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '@/db/index.js';
import { recommendations, queryOverlaps, clientAccounts, searchQueries } from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/utils/logger.js';
import { updateRecommendationStatus } from '@/services/recommendation-storage.service.js';

const router = Router();

// Validation schema
const updateStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'applied']),
});

/**
 * PATCH /api/recommendations/:id/status
 * Update recommendation status (approve/reject/apply)
 */
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = updateStatusSchema.parse(req.body);
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Fetch recommendation and verify user has access
    const [recommendation] = await db
      .select({
        recId: recommendations.id,
        clientAccountId: recommendations.clientAccountId,
        agencyId: clientAccounts.agencyId,
      })
      .from(recommendations)
      .innerJoin(clientAccounts, eq(recommendations.clientAccountId, clientAccounts.id))
      .where(eq(recommendations.id, id))
      .limit(1);

    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    if (recommendation.agencyId !== user.agencyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update status
    const updated = await updateRecommendationStatus(id, status, user.id);

    logger.info(
      {
        recommendationId: id,
        userId: user.id,
        newStatus: status,
      },
      'Recommendation status updated'
    );

    res.json({
      id: updated.id,
      status: updated.status,
      approvedBy: updated.approvedBy || undefined,
      approvedAt: updated.approvedAt?.toISOString() || undefined,
      appliedAt: updated.appliedAt?.toISOString() || undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    logger.error({ error }, 'Failed to update recommendation status');
    res.status(500).json({ error: 'Failed to update recommendation status' });
  }
});

/**
 * GET /api/recommendations/:id
 * Get a single recommendation by ID with query details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Fetch recommendation with access verification and query text
    const [rec] = await db
      .select({
        recommendation: recommendations,
        queryText: searchQueries.queryText,
      })
      .from(recommendations)
      .innerJoin(clientAccounts, eq(recommendations.clientAccountId, clientAccounts.id))
      .innerJoin(queryOverlaps, eq(recommendations.queryOverlapId, queryOverlaps.id))
      .innerJoin(searchQueries, eq(queryOverlaps.searchQueryId, searchQueries.id))
      .where(
        and(
          eq(recommendations.id, id),
          eq(clientAccounts.agencyId, user.agencyId)
        )
      )
      .limit(1);

    if (!rec) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    res.json({
      ...rec.recommendation,
      queryText: rec.queryText,
      currentMonthlySpend: parseFloat(rec.recommendation.currentMonthlySpend?.toString() || '0'),
      recommendedMonthlySpend: parseFloat(rec.recommendation.recommendedMonthlySpend?.toString() || '0'),
      estimatedMonthlySavings: parseFloat(rec.recommendation.estimatedMonthlySavings?.toString() || '0'),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch recommendation');
    res.status(500).json({ error: 'Failed to fetch recommendation' });
  }
});

export default router;
