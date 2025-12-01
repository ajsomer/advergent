/**
 * Shared Report Types
 * Used by both frontend and backend for interplay report responses
 */

// ============================================================================
// REPORT STATUS & TRIGGER TYPES
// ============================================================================

export type ReportStatus = 'pending' | 'researching' | 'analyzing' | 'completed' | 'failed';
export type ReportTrigger = 'client_creation' | 'manual' | 'scheduled';

// ============================================================================
// RECOMMENDATION TYPES
// ============================================================================

export type RecommendationCategory = 'sem' | 'seo' | 'hybrid';
export type ImpactLevel = 'high' | 'medium' | 'low';
export type EffortLevel = 'high' | 'medium' | 'low';

export interface UnifiedRecommendation {
  title: string;
  description: string;
  type: RecommendationCategory;
  impact: ImpactLevel;
  effort: EffortLevel;
  actionItems: string[];
}

// ============================================================================
// EXECUTIVE SUMMARY TYPES
// ============================================================================

export interface ExecutiveSummary {
  summary: string;
  keyHighlights: string[];
}

// ============================================================================
// REPORT RESPONSE TYPES
// ============================================================================

export interface InterplayReportDateRange {
  start: string;
  end: string;
  days: number;
}

export interface InterplayReportMetadata {
  tokensUsed?: number;
  processingTimeMs?: number;
  createdAt: string;
  completedAt?: string;
}

export interface InterplayReportResponse {
  id: string;
  clientAccountId: string;
  status: ReportStatus;
  trigger: ReportTrigger;
  dateRange: InterplayReportDateRange;
  executiveSummary?: ExecutiveSummary;
  recommendations?: UnifiedRecommendation[];
  metadata: InterplayReportMetadata;
  error?: string;
}
