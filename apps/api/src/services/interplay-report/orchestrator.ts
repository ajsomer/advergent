/**
 * Interplay Report Orchestrator
 *
 * Coordinates the multi-agent pipeline:
 * Scout → Researcher → SEM Agent + SEO Agent (parallel) → Director
 */

import { logger } from '@/utils/logger.js';
import { db } from '@/db/index.js';
import { clientAccounts } from '@/db/schema.js';
import { eq } from 'drizzle-orm';

import {
  runScout,
  runResearcher,
  runSEMAgent,
  runSEOAgent,
  runDirectorAgent,
} from './agents/index.js';

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
} from './queries.js';

import { constructInterplayDataFromDb } from './utils/index.js';

import type {
  GenerateReportOptions,
  InterplayReportResponse,
  DebugReportResponse,
  ScoutFindings,
  ResearcherData,
  SEMAgentOutput,
  SEOAgentOutput,
  DirectorOutput,
} from './types.js';

const orchestratorLogger = logger.child({ module: 'interplay-orchestrator' });

// ============================================================================
// MAIN PUBLIC API
// ============================================================================

/**
 * Generate a new interplay report for a client
 */
export async function generateInterplayReport(
  clientAccountId: string,
  options: GenerateReportOptions
): Promise<string> {
  const startTime = Date.now();
  const days = options.days || 30;

  orchestratorLogger.info(
    { clientAccountId, trigger: options.trigger, days },
    'Starting interplay report generation'
  );

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

  orchestratorLogger.info({ reportId }, 'Report record created');

  try {
    // Update status to started
    await updateReportStatus({
      reportId,
      status: 'pending',
      startedAt: new Date(),
    });

    // Fetch client context for agent prompts
    const clientContext = await getClientContext(clientAccountId);

    // Phase 1: Gather data
    const interplayData = await constructInterplayDataFromDb(clientAccountId, dateRange);

    if (interplayData.queries.length === 0) {
      throw new Error('No data available for analysis');
    }

    // Phase 2: Scout (data triage)
    const scoutFindings = runScout(interplayData);
    await updateScoutFindings({ reportId, scoutFindings });

    // Phase 3: Researcher (data enrichment)
    const researcherData = await runResearcher(clientAccountId, scoutFindings, dateRange);
    await updateResearcherData({ reportId, researcherData });

    // Phase 4: SEM + SEO Agents (parallel)
    const [semOutput, seoOutput] = await Promise.all([
      runSEMAgent(researcherData.enrichedKeywords, clientContext),
      runSEOAgent(researcherData.enrichedPages, clientContext),
    ]);
    await updateAgentOutputs({ reportId, semAgentOutput: semOutput, seoAgentOutput: seoOutput });

    // Phase 5: Director (synthesis)
    const directorOutput = await runDirectorAgent(semOutput, seoOutput, clientContext);

    const processingTimeMs = Date.now() - startTime;

    // Store final output
    await updateDirectorOutput({
      reportId,
      directorOutput,
      tokensUsed: 0, // TODO: Track actual token usage
      processingTimeMs,
    });

    // Create recommendations in database
    await createRecommendationsFromReport(
      clientAccountId,
      reportId,
      directorOutput.unifiedRecommendations
    );

    orchestratorLogger.info(
      {
        reportId,
        processingTimeMs,
        recommendationCount: directorOutput.unifiedRecommendations.length,
      },
      'Interplay report generation complete'
    );

    return reportId;
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
