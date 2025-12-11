/**
 * Interplay Report Orchestrator
 *
 * Coordinates the multi-agent pipeline:
 * Scout → Researcher → SEM Agent + SEO Agent (parallel) → Director
 *
 * All reports use skill-based agents for business-type-aware analysis.
 * When no businessType is provided, defaults to 'ecommerce'.
 */

import { logger } from '@/utils/logger.js';
import { db } from '@/db/index.js';
import { clientAccounts } from '@/db/schema.js';
import { eq } from 'drizzle-orm';

// Skill-based agent imports
import {
  runScout,
  runResearcher,
  runSEMAgent,
  runSEOAgent,
  runDirectorAgent,
} from './agents/index.js';

// Skill loader
import { loadSkillBundle, type BusinessType } from './skills/index.js';

import {
  createReport,
  updateReportStatus,
  updateScoutFindings,
  updateResearcherData,
  updateAgentOutputs,
  updateDirectorOutput,
  createRecommendationsFromReport,
  getLatestReport,
  getReportById,
  getReportCount,
  storeConstraintViolations,
} from './queries.js';

import { constructInterplayDataFromDb } from './utils/index.js';

import type {
  GenerateReportOptions,
  GenerateReportResult,
  InterplayReportResponse,
  DebugReportResponse,
  ScoutFindings,
  ResearcherData,
  SEMAgentOutput,
  SEOAgentOutput,
  DirectorOutput,
  ReportGenerationMetadata,
  SkillBundleMetadata,
  ReportPerformanceMetrics,
  ReportWarning,
} from './types.js';

const orchestratorLogger = logger.child({ module: 'interplay-orchestrator' });

// Default business type when none is provided
const DEFAULT_BUSINESS_TYPE: BusinessType = 'ecommerce';

// ============================================================================
// MAIN PUBLIC API
// ============================================================================

/**
 * Generate a new interplay report for a client using skill-based analysis.
 *
 * All reports use business-type-aware agents with appropriate thresholds,
 * prompts, and filtering rules. When no businessType is provided, defaults
 * to 'ecommerce' as the most common use case.
 *
 * Returns the report ID and comprehensive metadata including:
 * - Skill bundle version and fallback status
 * - Performance metrics for each pipeline phase
 * - Any warnings that occurred during generation
 */
export async function generateInterplayReport(
  clientAccountId: string,
  options: GenerateReportOptions
): Promise<GenerateReportResult> {
  const startTime = Date.now();
  const businessType = options.businessType ?? DEFAULT_BUSINESS_TYPE;
  const usedDefault = !options.businessType;

  return generateInterplayReportWithSkill(clientAccountId, options, businessType, startTime, usedDefault);
}

/**
 * Generate report using skill-based agents with comprehensive performance tracking.
 */
async function generateInterplayReportWithSkill(
  clientAccountId: string,
  options: GenerateReportOptions,
  businessType: BusinessType,
  startTime: number,
  usedDefault: boolean
): Promise<GenerateReportResult> {
  const days = options.days || 30;
  const warnings: ReportWarning[] = [];

  // Initialize performance metrics
  const performance: Partial<ReportPerformanceMetrics> = {};

  // 1. Load skill bundle for the business type
  const skillLoadStart = Date.now();
  const skillResult = loadSkillBundle(businessType);
  performance.skillLoadTimeMs = Date.now() - skillLoadStart;

  // Build skill metadata
  const skillMetadata: SkillBundleMetadata = {
    businessType,
    version: skillResult.bundle.version,
    usingFallback: skillResult.usingFallback,
    fallbackFrom: skillResult.fallbackFrom,
  };

  orchestratorLogger.info(
    {
      clientAccountId,
      trigger: options.trigger,
      days,
      businessType,
      usedDefaultBusinessType: usedDefault,
      usingFallback: skillResult.usingFallback,
      skillVersion: skillResult.bundle.version,
      skillLoadTimeMs: performance.skillLoadTimeMs,
    },
    'Loaded skill bundle for report generation'
  );

  // Surface fallback warning if applicable
  if (skillResult.usingFallback && skillResult.warning) {
    warnings.push({
      type: 'skill-fallback',
      message: skillResult.warning,
    });
    orchestratorLogger.warn({ warning: skillResult.warning }, 'Skill loading warning');
  }

  // Add warning if using default business type
  if (usedDefault) {
    warnings.push({
      type: 'default-business-type',
      message: `No business type specified, using default: ${DEFAULT_BUSINESS_TYPE}`,
    });
  }

  const skillBundle = skillResult.bundle;

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  const dateRange = {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  };

  // Create report record
  const reportId = await createReport({
    clientAccountId,
    triggerType: options.trigger,
    dateRangeStart: dateRange.start,
    dateRangeEnd: dateRange.end,
    dateRangeDays: days,
  });

  orchestratorLogger.info({ reportId, businessType }, 'Report record created');

  try {
    // Update status to started
    await updateReportStatus({
      reportId,
      status: 'pending',
      startedAt: new Date(),
    });

    // Fetch client context for agent prompts
    const clientContext = await getClientContext(clientAccountId);

    // 2. Fetch raw data
    const dataFetchStart = Date.now();
    const interplayData = await constructInterplayDataFromDb(clientAccountId, dateRange);
    performance.dataFetchTimeMs = Date.now() - dataFetchStart;

    if (interplayData.queries.length === 0) {
      throw new Error('No data available for analysis');
    }

    orchestratorLogger.debug(
      { queryCount: interplayData.queries.length, dataFetchTimeMs: performance.dataFetchTimeMs },
      'Data fetch complete'
    );

    // 3. Scout (data triage with skill-based thresholds)
    const scoutStart = Date.now();
    const scoutOutput = runScout({
      data: interplayData,
      skill: skillBundle.scout,
    });
    performance.scoutDurationMs = Date.now() - scoutStart;
    await updateScoutFindings({ reportId, scoutFindings: scoutOutput });

    orchestratorLogger.debug(
      {
        battlegroundKeywords: scoutOutput.battlegroundKeywords.length,
        criticalPages: scoutOutput.criticalPages.length,
        scoutDurationMs: performance.scoutDurationMs,
      },
      'Scout phase complete'
    );

    // 4. Researcher (data enrichment with skill-based content extraction)
    const researcherStart = Date.now();
    const researcherOutput = await runResearcher({
      clientAccountId,
      scoutFindings: scoutOutput,
      dateRange,
      skill: skillBundle.researcher,
    });
    performance.researcherDurationMs = Date.now() - researcherStart;
    await updateResearcherData({ reportId, researcherData: researcherOutput });

    orchestratorLogger.debug(
      {
        enrichedKeywords: researcherOutput.enrichedKeywords.length,
        enrichedPages: researcherOutput.enrichedPages.length,
        dataQuality: researcherOutput.dataQuality,
        researcherDurationMs: performance.researcherDurationMs,
      },
      'Researcher phase complete'
    );

    // 5. SEM + SEO Agents (parallel, skill-based prompts)
    const [semResult, seoResult] = await Promise.all([
      (async () => {
        const start = Date.now();
        const result = await runSEMAgent({
          enrichedKeywords: researcherOutput.enrichedKeywords,
          skill: skillBundle.sem,
          clientContext,
        });
        performance.semDurationMs = Date.now() - start;
        return result;
      })(),
      (async () => {
        const start = Date.now();
        const result = await runSEOAgent({
          enrichedPages: researcherOutput.enrichedPages,
          skill: skillBundle.seo,
          clientContext,
        });
        performance.seoDurationMs = Date.now() - start;
        return result;
      })(),
    ]);
    await updateAgentOutputs({ reportId, semAgentOutput: semResult, seoAgentOutput: seoResult });

    orchestratorLogger.debug(
      {
        semRecommendations: semResult.semActions.length,
        seoRecommendations: seoResult.seoActions.length,
        semDurationMs: performance.semDurationMs,
        seoDurationMs: performance.seoDurationMs,
      },
      'SEM and SEO agents complete'
    );

    // 6. Director (synthesis with skill-based filtering and constraint validation)
    const directorStart = Date.now();
    const directorOutput = await runDirectorAgent({
      semOutput: semResult,
      seoOutput: seoResult,
      skill: skillBundle.director,
      clientContext: {
        ...clientContext,
        clientId: clientAccountId,
        businessType,
      },
    });
    performance.directorDurationMs = Date.now() - directorStart;

    // Phase 6: Store constraint violations if any were detected
    if (directorOutput.validationResult && directorOutput.validationResult.violations.length > 0) {
      await storeConstraintViolations({
        reportId,
        clientAccountId,
        businessType,
        violations: directorOutput.validationResult.violations,
        skillVersion: skillBundle.version,
      });

      // Add warning about constraint violations
      warnings.push({
        type: 'constraint-violations',
        message: `${directorOutput.validationResult.violations.length} upstream constraint violations detected and filtered`,
      });

      orchestratorLogger.warn(
        {
          reportId,
          clientAccountId,
          businessType,
          violationCount: directorOutput.validationResult.violations.length,
        },
        'Constraint violations stored for debugging'
      );
    }

    orchestratorLogger.debug(
      {
        unifiedRecommendations: directorOutput.unifiedRecommendations.length,
        highlights: directorOutput.executiveSummary.keyHighlights?.length ?? 0,
        directorDurationMs: performance.directorDurationMs,
        constraintViolations: directorOutput.constraintValidation?.violationCount ?? 0,
      },
      'Director phase complete'
    );

    // Calculate total duration
    performance.totalDurationMs = Date.now() - startTime;

    // Build final performance metrics
    const finalPerformance: ReportPerformanceMetrics = {
      totalDurationMs: performance.totalDurationMs,
      skillLoadTimeMs: performance.skillLoadTimeMs ?? 0,
      dataFetchTimeMs: performance.dataFetchTimeMs ?? 0,
      scoutDurationMs: performance.scoutDurationMs ?? 0,
      researcherDurationMs: performance.researcherDurationMs ?? 0,
      semDurationMs: performance.semDurationMs ?? 0,
      seoDurationMs: performance.seoDurationMs ?? 0,
      directorDurationMs: performance.directorDurationMs ?? 0,
    };

    // Store final output with metadata
    await updateDirectorOutput({
      reportId,
      directorOutput,
      tokensUsed: 0, // TODO: Track actual token usage
      processingTimeMs: finalPerformance.totalDurationMs,
      skillMetadata,
      performanceMetrics: finalPerformance,
      warnings,
    });

    // Create recommendations in database
    await createRecommendationsFromReport(
      clientAccountId,
      reportId,
      directorOutput.unifiedRecommendations
    );

    // Build final metadata
    const metadata: ReportGenerationMetadata = {
      reportId,
      clientAccountId,
      generatedAt: new Date().toISOString(),
      skillBundle: skillMetadata,
      warnings,
      performance: finalPerformance,
    };

    orchestratorLogger.info(
      {
        reportId,
        clientAccountId,
        businessType,
        skillVersion: skillBundle.version,
        usingFallback: skillResult.usingFallback,
        recommendationCount: directorOutput.unifiedRecommendations.length,
        warningCount: warnings.length,
        ...finalPerformance,
      },
      'Report generation complete'
    );

    return { reportId, metadata };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    orchestratorLogger.error({ reportId, error: errorMessage }, 'Report generation failed');

    await updateReportStatus({
      reportId,
      status: 'failed',
      errorMessage,
    });

    throw error;
  }
}

/**
 * Get the latest interplay report for a client
 */
export async function getLatestInterplayReport(
  clientAccountId: string
): Promise<InterplayReportResponse | null> {
  const report = await getLatestReport(clientAccountId);

  if (!report) {
    return null;
  }

  return formatReportResponse(report);
}

/**
 * Get a specific report by ID
 */
export async function getInterplayReportById(
  reportId: string
): Promise<InterplayReportResponse | null> {
  const report = await getReportById(reportId);

  if (!report) {
    return null;
  }

  return formatReportResponse(report);
}

/**
 * Get a report with full debug data (all agent outputs)
 */
export async function getInterplayReportDebug(
  reportId: string
): Promise<DebugReportResponse | null> {
  const report = await getReportById(reportId);

  if (!report) {
    return null;
  }

  const baseResponse = formatReportResponse(report);

  return {
    ...baseResponse,
    scoutFindings: parseEncrypted<ScoutFindings>(report.scoutFindingsEncrypted),
    researcherData: parseEncrypted<ResearcherData>(report.researcherDataEncrypted),
    semAgentOutput: parseEncrypted<SEMAgentOutput>(report.semAgentOutputEncrypted),
    seoAgentOutput: parseEncrypted<SEOAgentOutput>(report.seoAgentOutputEncrypted),
    directorOutput: parseEncrypted<DirectorOutput>(report.directorOutputEncrypted),
  };
}

/**
 * Check if a client has any existing reports
 */
export async function hasExistingReports(clientAccountId: string): Promise<boolean> {
  const count = await getReportCount(clientAccountId);
  return count > 0;
}

// ============================================================================
// HELPERS
// ============================================================================

async function getClientContext(clientAccountId: string) {
  const [client] = await db
    .select({
      name: clientAccounts.name,
    })
    .from(clientAccounts)
    .where(eq(clientAccounts.id, clientAccountId))
    .limit(1);

  return {
    clientName: client?.name,
    industry: undefined, // Could be added to client_accounts table
    targetMarket: undefined, // Could be added to client_accounts table
  };
}

function formatReportResponse(report: any): InterplayReportResponse {
  return {
    id: report.id,
    clientAccountId: report.clientAccountId,
    status: report.status,
    trigger: report.triggerType,
    dateRange: {
      start: report.dateRangeStart,
      end: report.dateRangeEnd,
      days: report.dateRangeDays,
    },
    executiveSummary: parseEncrypted(report.executiveSummaryEncrypted),
    recommendations: parseEncrypted(report.unifiedRecommendationsEncrypted),
    metadata: {
      tokensUsed: report.tokensUsed,
      processingTimeMs: report.processingTimeMs,
      createdAt: report.createdAt?.toISOString(),
      completedAt: report.completedAt?.toISOString(),
    },
    error: report.errorMessage,
  };
}

function parseEncrypted<T>(encrypted: string | null): T | undefined {
  if (!encrypted) return undefined;
  try {
    // For MVP, stored as plain JSON. In production, decrypt first.
    return JSON.parse(encrypted) as T;
  } catch {
    return undefined;
  }
}
