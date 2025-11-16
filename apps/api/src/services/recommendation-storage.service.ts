import { db, recommendations, queryOverlaps } from '@/db/index.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/utils/logger.js';
import { encryptToken } from './encryption.service.js';
import { config } from '@/config/index.js';
import type { QueryOverlap } from './query-matcher.service.js';
import type { Recommendation } from './ai-analyzer.service.js';

const storageLogger = logger.child({ module: 'recommendation-storage' });

/**
 * Snapshot data structure for audit trail
 */
interface RecommendationSnapshot {
  request: {
    query: string;
    googleAds: QueryOverlap['googleAds'];
    searchConsole: QueryOverlap['searchConsole'];
    timestamp: string;
  };
  response: Recommendation;
  provider: string;
  model: string;
}

/**
 * Find or create a query overlap record for a client and query hash
 */
async function getOrCreateQueryOverlap(
  clientId: string,
  searchQueryId: string
): Promise<string> {
  // Check if overlap already exists
  const existing = await db
    .select()
    .from(queryOverlaps)
    .where(
      and(
        eq(queryOverlaps.clientAccountId, clientId),
        eq(queryOverlaps.searchQueryId, searchQueryId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create new overlap record
  const [inserted] = await db
    .insert(queryOverlaps)
    .values({
      clientAccountId: clientId,
      searchQueryId,
      analysisStatus: 'pending',
    })
    .returning({ id: queryOverlaps.id });

  storageLogger.debug(
    { clientId, searchQueryId, overlapId: inserted.id },
    'Created new query overlap record'
  );

  return inserted.id;
}

/**
 * Save a recommendation with encrypted AI response snapshot
 * Returns the recommendation ID
 */
export async function saveRecommendation(
  clientId: string,
  searchQueryId: string,
  overlap: QueryOverlap,
  aiResponse: Recommendation
): Promise<string> {
  const startTime = Date.now();

  try {
    // Get or create query overlap record
    const queryOverlapId = await getOrCreateQueryOverlap(clientId, searchQueryId);

    // Create snapshot for audit trail
    const snapshot: RecommendationSnapshot = {
      request: {
        query: overlap.queryText,
        googleAds: overlap.googleAds,
        searchConsole: overlap.searchConsole,
        timestamp: new Date().toISOString(),
      },
      response: aiResponse,
      provider: config.aiProvider,
      model:
        config.aiProvider === 'anthropic'
          ? config.anthropicModel
          : config.openaiModel,
    };

    // Encrypt the snapshot
    const snapshotJson = JSON.stringify(snapshot);
    const { encrypted, keyVersion } = await encryptToken(snapshotJson);

    storageLogger.debug(
      {
        clientId,
        queryOverlapId,
        snapshotSize: snapshotJson.length,
        encryptedSize: encrypted.length,
      },
      'Encrypted recommendation snapshot'
    );

    // Insert recommendation into database
    const [inserted] = await db
      .insert(recommendations)
      .values({
        clientAccountId: clientId,
        queryOverlapId,
        recommendationType: aiResponse.recommendation_type,
        confidenceLevel: aiResponse.confidence_level,
        currentMonthlySpend: aiResponse.current_monthly_spend.toString(),
        recommendedMonthlySpend: aiResponse.recommended_monthly_spend.toString(),
        estimatedMonthlySavings: aiResponse.estimated_monthly_savings.toString(),
        reasoning: aiResponse.reasoning,
        keyFactors: aiResponse.key_factors,
        encryptedSnapshot: encrypted,
        encryptedSnapshotKeyVersion: keyVersion,
        status: 'pending',
      })
      .returning({ id: recommendations.id });

    // Update query overlap status
    await db
      .update(queryOverlaps)
      .set({
        lastAnalyzedAt: new Date(),
        analysisStatus: 'completed',
      })
      .where(eq(queryOverlaps.id, queryOverlapId));

    const duration = Date.now() - startTime;

    storageLogger.info(
      {
        recommendationId: inserted.id,
        clientId,
        queryOverlapId,
        recommendationType: aiResponse.recommendation_type,
        savings: aiResponse.estimated_monthly_savings,
        duration,
      },
      'Recommendation saved successfully'
    );

    return inserted.id;
  } catch (error) {
    storageLogger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        clientId,
        query: overlap.queryText,
      },
      'Failed to save recommendation'
    );
    throw error;
  }
}

/**
 * Retrieve a recommendation by ID
 */
export async function getRecommendation(recommendationId: string) {
  const result = await db
    .select()
    .from(recommendations)
    .where(eq(recommendations.id, recommendationId))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0];
}

/**
 * Get all recommendations for a client
 */
export async function getClientRecommendations(
  clientId: string,
  filters?: {
    status?: 'pending' | 'approved' | 'rejected' | 'applied';
    recommendationType?: 'reduce' | 'pause' | 'increase' | 'maintain';
    confidenceLevel?: 'high' | 'medium' | 'low';
  }
) {
  let query = db
    .select()
    .from(recommendations)
    .where(eq(recommendations.clientAccountId, clientId));

  // Note: Drizzle doesn't support dynamic where clauses easily,
  // so we'll filter in memory for now. For production, consider
  // building the query conditionally or using raw SQL.

  const results = await query;

  // Apply filters
  let filtered = results;

  if (filters?.status) {
    filtered = filtered.filter((r) => r.status === filters.status);
  }

  if (filters?.recommendationType) {
    filtered = filtered.filter(
      (r) => r.recommendationType === filters.recommendationType
    );
  }

  if (filters?.confidenceLevel) {
    filtered = filtered.filter(
      (r) => r.confidenceLevel === filters.confidenceLevel
    );
  }

  storageLogger.debug(
    {
      clientId,
      total: results.length,
      filtered: filtered.length,
      filters,
    },
    'Retrieved client recommendations'
  );

  return filtered;
}

/**
 * Update recommendation status (approve, reject, apply)
 */
export async function updateRecommendationStatus(
  recommendationId: string,
  status: 'pending' | 'approved' | 'rejected' | 'applied',
  userId?: string
) {
  const updates: any = { status };

  if (status === 'approved' && userId) {
    updates.approvedBy = userId;
    updates.approvedAt = new Date();
  }

  if (status === 'applied') {
    updates.appliedAt = new Date();
  }

  const [updated] = await db
    .update(recommendations)
    .set(updates)
    .where(eq(recommendations.id, recommendationId))
    .returning();

  storageLogger.info(
    {
      recommendationId,
      status,
      userId,
    },
    'Recommendation status updated'
  );

  return updated;
}

/**
 * Calculate aggregate recommendation statistics for a client
 */
export async function getRecommendationStats(clientId: string) {
  const allRecommendations = await getClientRecommendations(clientId);

  const stats = {
    total: allRecommendations.length,
    byStatus: {
      pending: allRecommendations.filter((r) => r.status === 'pending').length,
      approved: allRecommendations.filter((r) => r.status === 'approved').length,
      rejected: allRecommendations.filter((r) => r.status === 'rejected').length,
      applied: allRecommendations.filter((r) => r.status === 'applied').length,
    },
    byType: {
      reduce: allRecommendations.filter((r) => r.recommendationType === 'reduce')
        .length,
      pause: allRecommendations.filter((r) => r.recommendationType === 'pause')
        .length,
      increase: allRecommendations.filter(
        (r) => r.recommendationType === 'increase'
      ).length,
      maintain: allRecommendations.filter(
        (r) => r.recommendationType === 'maintain'
      ).length,
    },
    totalPotentialSavings: allRecommendations.reduce(
      (sum, r) => sum + (parseFloat(r.estimatedMonthlySavings || '0') || 0),
      0
    ),
    approvedSavings: allRecommendations
      .filter((r) => r.status === 'approved' || r.status === 'applied')
      .reduce(
        (sum, r) => sum + (parseFloat(r.estimatedMonthlySavings || '0') || 0),
        0
      ),
  };

  storageLogger.debug({ clientId, stats }, 'Calculated recommendation stats');

  return stats;
}
