/**
 * Phase 4: Interplay Report Types
 * All TypeScript interfaces for the multi-agent SEO/SEM report system
 */

// ============================================================================
// SCOUT AGENT TYPES
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
// RESEARCHER AGENT TYPES
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
// SEM AGENT TYPES
// ============================================================================

export type SEMActionLevel = 'campaign' | 'ad_group' | 'keyword';
export type ImpactLevel = 'high' | 'medium' | 'low';

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
// SEO AGENT TYPES
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
// DIRECTOR AGENT TYPES
// ============================================================================

export type RecommendationCategory = 'sem' | 'seo' | 'hybrid';
export type EffortLevel = 'high' | 'medium' | 'low';

export interface UnifiedRecommendation {
  title: string;
  description: string;
  type: RecommendationCategory;
  impact: ImpactLevel;
  effort: EffortLevel;
  actionItems: string[];
}

export interface ExecutiveSummary {
  summary: string;
  keyHighlights: string[];
}

export interface DirectorOutput {
  executiveSummary: ExecutiveSummary;
  unifiedRecommendations: UnifiedRecommendation[];
}

// ============================================================================
// ORCHESTRATOR TYPES
// ============================================================================

export type ReportTrigger = 'client_creation' | 'manual' | 'scheduled';
export type ReportStatus = 'pending' | 'researching' | 'analyzing' | 'completed' | 'failed';

export interface GenerateReportOptions {
  days?: number;
  trigger: ReportTrigger;
}

export interface InterplayReportResponse {
  id: string;
  clientAccountId: string;
  status: ReportStatus;
  dateRange: {
    start: string;
    end: string;
    days: number;
  };
  executiveSummary?: ExecutiveSummary;
  recommendations?: UnifiedRecommendation[];
  metadata: {
    tokensUsed?: number;
    processingTimeMs?: number;
    createdAt: string;
    completedAt?: string;
  };
  error?: string;
}

export interface DebugReportResponse extends InterplayReportResponse {
  scoutFindings?: ScoutFindings;
  researcherData?: ResearcherData;
  semAgentOutput?: SEMAgentOutput;
  seoAgentOutput?: SEOAgentOutput;
  directorOutput?: DirectorOutput;
}

// ============================================================================
// DATA CONSTRUCTOR TYPES
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
