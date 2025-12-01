/**
 * Phase 4: Interplay Report Types
 *
 * Common types (InterplayReportResponse, UnifiedRecommendation, etc.) are imported
 * from @advergent/shared for single source of truth between frontend and backend.
 *
 * Backend-specific types (agent outputs, data constructors) are defined here.
 */

// ============================================================================
// SHARED TYPES - Re-export from @advergent/shared
// ============================================================================

export {
  ReportStatus,
  ReportTrigger,
  RecommendationCategory,
  ImpactLevel,
  EffortLevel,
  UnifiedRecommendation,
  ExecutiveSummary,
  InterplayReportDateRange,
  InterplayReportMetadata,
  InterplayReportResponse,
} from '@advergent/shared';

export type { UnifiedRecommendation as UnifiedRecommendationType } from '@advergent/shared';

// ============================================================================
// SCOUT AGENT TYPES (Backend-specific)
// ============================================================================

export type BattlegroundPriority = 'high' | 'medium' | 'low';
export type BattlegroundReason =
  | 'high_spend_low_roas'
  | 'cannibalization_risk'
  | 'growth_potential'
  | 'competitive_pressure';

export interface BattlegroundKeyword {
  query: string;
  priority: BattlegroundPriority;
  reason: BattlegroundReason;
  spend: number;
  roas: number;
  organicPosition: number | null;
  impressionShare: number | null;
  conversions: number;
}

export type CriticalPageReason =
  | 'high_spend_low_organic'
  | 'high_traffic_high_bounce'
  | 'high_impressions_low_ctr';

export interface CriticalPage {
  url: string;
  priority: BattlegroundPriority;
  reason: CriticalPageReason;
  paidSpend: number;
  organicPosition: number | null;
  bounceRate: number | null;
  impressions: number;
  ctr: number | null;
}

export interface ScoutFindings {
  battlegroundKeywords: BattlegroundKeyword[];
  criticalPages: CriticalPage[];
  summary: {
    totalKeywordsAnalyzed: number;
    totalPagesAnalyzed: number;
    highPriorityCount: number;
  };
}

// ============================================================================
// RESEARCHER AGENT TYPES (Backend-specific)
// ============================================================================

export type CompetitiveDataLevel = 'keyword' | 'account' | 'none';

export interface CompetitiveMetrics {
  impressionShare: number | null;
  lostImpressionShareRank: number | null;
  lostImpressionShareBudget: number | null;
  outrankingShare: number | null;
  overlapRate: number | null;
  topOfPageRate: number | null;
  positionAboveRate: number | null;
  absTopOfPageRate: number | null;
  dataLevel: CompetitiveDataLevel;
}

export interface EnrichedKeyword extends BattlegroundKeyword {
  competitiveMetrics?: CompetitiveMetrics;
}

export interface PageContent {
  wordCount: number;
  title: string | null;
  h1: string | null;
  metaDescription: string | null;
  contentPreview: string;
}

export interface EnrichedPage extends CriticalPage {
  content?: PageContent;
}

export interface ResearcherData {
  enrichedKeywords: EnrichedKeyword[];
  enrichedPages: EnrichedPage[];
  dataQuality: {
    keywordsWithCompetitiveData: number;
    pagesWithContent: number;
  };
}

// ============================================================================
// SEM AGENT TYPES (Backend-specific)
// ============================================================================

import type { ImpactLevel } from '@advergent/shared';

export type SEMActionLevel = 'campaign' | 'ad_group' | 'keyword';

export interface SEMAction {
  action: string;
  level: SEMActionLevel;
  expectedUplift: string;
  reasoning: string;
  impact: ImpactLevel;
  keyword?: string;
}

export interface SEMAgentOutput {
  semActions: SEMAction[];
}

// ============================================================================
// SEO AGENT TYPES (Backend-specific)
// ============================================================================

export interface SEOAction {
  condition: string;
  recommendation: string;
  specificActions: string[];
  impact: ImpactLevel;
  url?: string;
}

export interface SEOAgentOutput {
  seoActions: SEOAction[];
}

// ============================================================================
// DIRECTOR AGENT TYPES (Backend-specific)
// ============================================================================

import type { ExecutiveSummary, UnifiedRecommendation } from '@advergent/shared';

export interface DirectorOutput {
  executiveSummary: ExecutiveSummary;
  unifiedRecommendations: UnifiedRecommendation[];
}

// ============================================================================
// ORCHESTRATOR TYPES (Backend-specific)
// ============================================================================

import type { ReportTrigger, InterplayReportResponse } from '@advergent/shared';

export interface GenerateReportOptions {
  days?: number;
  trigger: ReportTrigger;
}

export interface DebugReportResponse extends InterplayReportResponse {
  scoutFindings?: ScoutFindings;
  researcherData?: ResearcherData;
  semAgentOutput?: SEMAgentOutput;
  seoAgentOutput?: SEOAgentOutput;
  directorOutput?: DirectorOutput;
}

// ============================================================================
// DATA CONSTRUCTOR TYPES (Backend-specific)
// ============================================================================

export interface InterplayQueryData {
  query: string;
  googleAds?: {
    spend: number;
    clicks: number;
    impressions: number;
    cpc: number;
    conversions: number;
    conversionValue: number;
    roas: number;
  };
  searchConsole?: {
    position: number;
    clicks: number;
    impressions: number;
    ctr: number;
    url?: string;
  };
  ga4Metrics?: {
    sessions: number;
    revenue: number;
    conversions: number;
    engagementRate: number;
    bounceRate: number;
    averageSessionDuration: number;
  };
}

export interface InterplayData {
  queries: InterplayQueryData[];
  summary: {
    totalSpend: number;
    totalRevenue: number;
    totalOrganicClicks: number;
  };
}
