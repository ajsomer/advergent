/**
 * Phase 9: Metrics Collection Service
 *
 * Collects and stores metrics for tracking skill effectiveness,
 * constraint violations, and report quality over time.
 */

import { db } from '@/db/index.js';
import { reportMetrics } from '@/db/schema.js';
import { logger } from '@/utils/logger.js';
import type { BusinessType } from '../skills/types.js';

const metricsLogger = logger.child({ module: 'report-metrics' });

// ============================================================================
// TYPES
// ============================================================================

export interface ReportMetricsData {
  reportId: string;
  clientAccountId: string;
  businessType: BusinessType;
  skillVersion: string;
  usingFallback: boolean;

  // Constraint violations
  constraintViolations: number;
  violationsByRule: Record<string, number>;

  // Content analysis
  roasMentions: number;
  productSchemaRecommended: boolean;
  invalidMetricsDetected: string[];

  // Performance
  skillLoadTimeMs?: number;
  scoutDurationMs?: number;
  researcherDurationMs?: number;
  semDurationMs?: number;
  seoDurationMs?: number;
  directorDurationMs?: number;
  totalDurationMs?: number;

  // Token budget
  serializationMode?: 'full' | 'compact';
  truncationApplied: boolean;
  keywordsDropped: number;
  pagesDropped: number;
}

// ============================================================================
// SAVE METRICS
// ============================================================================

/**
 * Saves report metrics to the database.
 * This is a fire-and-forget operation - failures are logged but don't block report generation.
 */
export async function saveReportMetrics(data: ReportMetricsData): Promise<void> {
  try {
    await db.insert(reportMetrics).values({
      reportId: data.reportId,
      clientAccountId: data.clientAccountId,
      businessType: data.businessType,
      skillVersion: data.skillVersion,
      usingFallback: data.usingFallback,
      constraintViolations: data.constraintViolations,
      violationsByRule: JSON.stringify(data.violationsByRule),
      roasMentions: data.roasMentions,
      productSchemaRecommended: data.productSchemaRecommended,
      invalidMetricsDetected: data.invalidMetricsDetected,
      skillLoadTimeMs: data.skillLoadTimeMs,
      scoutDurationMs: data.scoutDurationMs,
      researcherDurationMs: data.researcherDurationMs,
      semDurationMs: data.semDurationMs,
      seoDurationMs: data.seoDurationMs,
      directorDurationMs: data.directorDurationMs,
      totalDurationMs: data.totalDurationMs,
      serializationMode: data.serializationMode,
      truncationApplied: data.truncationApplied,
      keywordsDropped: data.keywordsDropped,
      pagesDropped: data.pagesDropped,
    });

    metricsLogger.debug(
      {
        reportId: data.reportId,
        businessType: data.businessType,
        constraintViolations: data.constraintViolations,
        totalDurationMs: data.totalDurationMs,
      },
      'Report metrics saved'
    );
  } catch (error) {
    // Don't throw - metrics collection should not break report generation
    metricsLogger.error(
      { error, reportId: data.reportId },
      'Failed to save report metrics'
    );
  }
}

// ============================================================================
// METRICS BUILDER HELPER
// ============================================================================

/**
 * Helper class to build metrics incrementally during report generation.
 */
export class MetricsBuilder {
  private data: Partial<ReportMetricsData> = {
    constraintViolations: 0,
    violationsByRule: {},
    roasMentions: 0,
    productSchemaRecommended: false,
    invalidMetricsDetected: [],
    truncationApplied: false,
    keywordsDropped: 0,
    pagesDropped: 0,
  };

  setReportContext(
    reportId: string,
    clientAccountId: string,
    businessType: BusinessType
  ): this {
    this.data.reportId = reportId;
    this.data.clientAccountId = clientAccountId;
    this.data.businessType = businessType;
    return this;
  }

  setSkillInfo(skillVersion: string, usingFallback: boolean): this {
    this.data.skillVersion = skillVersion;
    this.data.usingFallback = usingFallback;
    return this;
  }

  setConstraintViolations(
    count: number,
    byRule: Record<string, number>
  ): this {
    this.data.constraintViolations = count;
    this.data.violationsByRule = byRule;
    return this;
  }

  setContentAnalysis(
    roasMentions: number,
    productSchemaRecommended: boolean,
    invalidMetrics: string[]
  ): this {
    this.data.roasMentions = roasMentions;
    this.data.productSchemaRecommended = productSchemaRecommended;
    this.data.invalidMetricsDetected = invalidMetrics;
    return this;
  }

  setPerformance(metrics: {
    skillLoadTimeMs?: number;
    scoutDurationMs?: number;
    researcherDurationMs?: number;
    semDurationMs?: number;
    seoDurationMs?: number;
    directorDurationMs?: number;
    totalDurationMs?: number;
  }): this {
    Object.assign(this.data, metrics);
    return this;
  }

  setTokenBudget(budget: {
    serializationMode?: 'full' | 'compact';
    truncationApplied: boolean;
    keywordsDropped: number;
    pagesDropped: number;
  }): this {
    Object.assign(this.data, budget);
    return this;
  }

  build(): ReportMetricsData {
    // Validate required fields
    if (!this.data.reportId) {
      throw new Error('reportId is required');
    }
    if (!this.data.clientAccountId) {
      throw new Error('clientAccountId is required');
    }
    if (!this.data.businessType) {
      throw new Error('businessType is required');
    }
    if (!this.data.skillVersion) {
      throw new Error('skillVersion is required');
    }

    return this.data as ReportMetricsData;
  }
}

/**
 * Creates a new MetricsBuilder instance.
 */
export function createMetricsBuilder(): MetricsBuilder {
  return new MetricsBuilder();
}
