/**
 * Phase 4: Interplay Report Database Operations
 * All database queries for interplay reports
 */

import { db } from '@/db/index.js';
import { interplayReports, recommendations, constraintViolations } from '@/db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import type { ConstraintViolation } from './utils/constraint-validation.js';
import type {
  ReportTrigger,
  ReportStatus,
  ScoutFindings,
  ResearcherData,
  SEMAgentOutput,
  SEOAgentOutput,
  DirectorOutput,
  UnifiedRecommendation,
  SkillBundleMetadata,
  ReportPerformanceMetrics,
  ReportWarning,
} from './types.js';

// ============================================================================
// CREATE OPERATIONS
// ============================================================================

export interface CreateReportParams {
  clientAccountId: string;
  triggerType: ReportTrigger;
  dateRangeStart: string;
  dateRangeEnd: string;
  dateRangeDays: number;
}

export async function createReport(params: CreateReportParams): Promise<string> {
  const [report] = await db
    .insert(interplayReports)
    .values({
      clientAccountId: params.clientAccountId,
      triggerType: params.triggerType,
      dateRangeStart: params.dateRangeStart,
      dateRangeEnd: params.dateRangeEnd,
      dateRangeDays: params.dateRangeDays,
      status: 'pending',
    })
    .returning({ id: interplayReports.id });

  return report.id;
}

// ============================================================================
// UPDATE OPERATIONS
// ============================================================================

export interface UpdateReportStatusParams {
  reportId: string;
  status: ReportStatus;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  tokensUsed?: number;
  processingTimeMs?: number;
}

export async function updateReportStatus(params: UpdateReportStatusParams): Promise<void> {
  await db
    .update(interplayReports)
    .set({
      status: params.status,
      startedAt: params.startedAt,
      completedAt: params.completedAt,
      errorMessage: params.errorMessage,
      tokensUsed: params.tokensUsed,
      processingTimeMs: params.processingTimeMs,
    })
    .where(eq(interplayReports.id, params.reportId));
}

export interface UpdateScoutFindingsParams {
  reportId: string;
  scoutFindings: ScoutFindings;
}

export async function updateScoutFindings(params: UpdateScoutFindingsParams): Promise<void> {
  // For MVP, store as plain JSON. In production, encrypt with KMS.
  await db
    .update(interplayReports)
    .set({
      scoutFindingsEncrypted: JSON.stringify(params.scoutFindings),
      status: 'researching',
    })
    .where(eq(interplayReports.id, params.reportId));
}

export interface UpdateResearcherDataParams {
  reportId: string;
  researcherData: ResearcherData;
}

export async function updateResearcherData(params: UpdateResearcherDataParams): Promise<void> {
  await db
    .update(interplayReports)
    .set({
      researcherDataEncrypted: JSON.stringify(params.researcherData),
      status: 'analyzing',
    })
    .where(eq(interplayReports.id, params.reportId));
}

export interface UpdateAgentOutputsParams {
  reportId: string;
  semAgentOutput: SEMAgentOutput;
  seoAgentOutput: SEOAgentOutput;
}

export async function updateAgentOutputs(params: UpdateAgentOutputsParams): Promise<void> {
  await db
    .update(interplayReports)
    .set({
      semAgentOutputEncrypted: JSON.stringify(params.semAgentOutput),
      seoAgentOutputEncrypted: JSON.stringify(params.seoAgentOutput),
    })
    .where(eq(interplayReports.id, params.reportId));
}

export interface UpdateDirectorOutputParams {
  reportId: string;
  directorOutput: DirectorOutput;
  tokensUsed: number;
  processingTimeMs: number;
  skillMetadata?: SkillBundleMetadata;
  performanceMetrics?: ReportPerformanceMetrics;
  warnings?: ReportWarning[];
}

export async function updateDirectorOutput(params: UpdateDirectorOutputParams): Promise<void> {
  await db
    .update(interplayReports)
    .set({
      directorOutputEncrypted: JSON.stringify(params.directorOutput),
      executiveSummaryEncrypted: JSON.stringify(params.directorOutput.executiveSummary),
      unifiedRecommendationsEncrypted: JSON.stringify(params.directorOutput.unifiedRecommendations),
      status: 'completed',
      completedAt: new Date(),
      tokensUsed: params.tokensUsed,
      processingTimeMs: params.processingTimeMs,
      skillMetadataJson: params.skillMetadata ? JSON.stringify(params.skillMetadata) : null,
      performanceMetricsJson: params.performanceMetrics ? JSON.stringify(params.performanceMetrics) : null,
      warningsJson: params.warnings && params.warnings.length > 0 ? JSON.stringify(params.warnings) : null,
    })
    .where(eq(interplayReports.id, params.reportId));
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

export async function getLatestReport(clientAccountId: string) {
  const [report] = await db
    .select()
    .from(interplayReports)
    .where(eq(interplayReports.clientAccountId, clientAccountId))
    .orderBy(desc(interplayReports.createdAt))
    .limit(1);

  return report || null;
}

export async function getReportById(reportId: string) {
  const [report] = await db
    .select()
    .from(interplayReports)
    .where(eq(interplayReports.id, reportId))
    .limit(1);

  return report || null;
}

export async function getReportCount(clientAccountId: string): Promise<number> {
  const result = await db
    .select({ id: interplayReports.id })
    .from(interplayReports)
    .where(eq(interplayReports.clientAccountId, clientAccountId));

  return result.length;
}

// ============================================================================
// RECOMMENDATION OPERATIONS
// ============================================================================

export interface CreateInterplayRecommendationParams {
  clientAccountId: string;
  interplayReportId: string;
  recommendation: UnifiedRecommendation;
}

export async function createInterplayRecommendation(
  params: CreateInterplayRecommendationParams
): Promise<void> {
  // Map unified recommendation to database columns
  // recommendationType maps impact to recommendation_type enum (reduce/pause/increase/maintain)
  const typeMapping: Record<string, 'reduce' | 'pause' | 'increase' | 'maintain'> = {
    sem: 'reduce', // SEM recommendations often aim to optimize spend
    seo: 'maintain', // SEO recommendations are about organic improvements
    hybrid: 'increase', // Hybrid often suggests expansion
  };

  await db.insert(recommendations).values({
    clientAccountId: params.clientAccountId,
    // queryOverlapId is now nullable for interplay recommendations
    recommendationType: typeMapping[params.recommendation.type] || 'maintain',
    // Per spec: interplay recommendations always default to 'high' confidence
    // since they are AI-generated from comprehensive multi-agent analysis
    confidenceLevel: 'high',
    reasoning: params.recommendation.description,
    keyFactors: params.recommendation.actionItems,
    source: 'interplay_report',
    interplayReportId: params.interplayReportId,
    recommendationCategory: params.recommendation.type,
    title: params.recommendation.title,
    impactLevel: params.recommendation.impact,
    effortLevel: params.recommendation.effort,
    actionItems: params.recommendation.actionItems,
    status: 'pending',
  });
}

export async function createRecommendationsFromReport(
  clientAccountId: string,
  reportId: string,
  unifiedRecommendations: UnifiedRecommendation[]
): Promise<void> {
  for (const rec of unifiedRecommendations) {
    await createInterplayRecommendation({
      clientAccountId,
      interplayReportId: reportId,
      recommendation: rec,
    });
  }
}

export async function getInterplayRecommendations(reportId: string) {
  return db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.interplayReportId, reportId),
        eq(recommendations.source, 'interplay_report')
      )
    );
}

// ============================================================================
// CONSTRAINT VIOLATION OPERATIONS (PHASE 6)
// ============================================================================

export interface StoreConstraintViolationsParams {
  reportId: string;
  clientAccountId: string;
  businessType: string;
  violations: ConstraintViolation[];
  skillVersion: string;
}

/**
 * Stores constraint violations detected during report generation.
 * Used for debugging prompt quality and monitoring system health.
 */
export async function storeConstraintViolations(
  params: StoreConstraintViolationsParams
): Promise<void> {
  if (params.violations.length === 0) {
    return;
  }

  const values = params.violations.map((violation) => ({
    reportId: params.reportId,
    clientAccountId: params.clientAccountId,
    businessType: params.businessType,
    source: violation.source as 'sem' | 'seo',
    constraintId: violation.ruleId,
    violatingContent: violation.matchedContent.slice(0, 1000), // Truncate to 1000 chars
    skillVersion: params.skillVersion,
  }));

  await db.insert(constraintViolations).values(values);
}

/**
 * Gets constraint violations for a specific report.
 */
export async function getConstraintViolationsForReport(reportId: string) {
  return db
    .select()
    .from(constraintViolations)
    .where(eq(constraintViolations.reportId, reportId));
}

/**
 * Gets constraint violation statistics by business type.
 * Useful for identifying which business types have prompt quality issues.
 */
export async function getConstraintViolationsByBusinessType(businessType: string) {
  return db
    .select()
    .from(constraintViolations)
    .where(eq(constraintViolations.businessType, businessType))
    .orderBy(desc(constraintViolations.createdAt));
}
