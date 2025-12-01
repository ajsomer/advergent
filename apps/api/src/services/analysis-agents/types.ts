import { z } from 'zod';

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface AgentContext {
    clientId: string;
    industry?: string;
    targetMarket?: string;
    competitors?: string[];
}

export interface CompetitiveMetrics {
    impressionShare: number;
    lostIsRank: number;
    lostIsBudget: number;
}

export interface GA4PageMetrics {
    engagementRate: number;
    bounceRate: number;
    revenue: number;
    sessions: number;
    conversions: number;
    averageSessionDuration: number;
}

export interface QueryData {
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
    // Enriched Data (Added by Researchers)
    competitiveMetrics?: CompetitiveMetrics;
    pageContent?: string; // HTML/Text content for specific pages
    ga4Metrics?: GA4PageMetrics; // Associated with the landing page
}

export interface InterplayData {
    queries: QueryData[];
    summary: {
        totalSpend: number;
        totalRevenue: number;
        totalOrganicClicks: number;
    };
}

// ============================================================================
// OUTPUT SCHEMAS (Zod)
// ============================================================================

// --- SEM Agent Output ---
export const semActionSchema = z.object({
    action: z.string(),
    level: z.enum(['campaign', 'keyword', 'ad_group']),
    expectedUplift: z.string(),
    reasoning: z.string(),
    impact: z.enum(['high', 'medium', 'low']),
});

export const semAnalysisSchema = z.object({
    semActions: z.array(semActionSchema),
});

export type SemAnalysis = z.infer<typeof semAnalysisSchema>;

// --- SEO Agent Output ---
export const seoActionSchema = z.object({
    condition: z.string(),
    recommendation: z.string(),
    specificActions: z.array(z.string()),
    impact: z.enum(['high', 'medium', 'low']),
});

export const seoAnalysisSchema = z.object({
    seoActions: z.array(seoActionSchema),
});

export type SeoAnalysis = z.infer<typeof seoAnalysisSchema>;

// --- Strategy Agent Output ---
export const unifiedRecommendationSchema = z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(['sem', 'seo', 'hybrid']),
    impact: z.enum(['high', 'medium', 'low']),
    effort: z.enum(['high', 'medium', 'low']),
    actionItems: z.array(z.string()),
});

export const executiveSummarySchema = z.object({
    summary: z.string(),
    keyHighlights: z.array(z.string()),
});

export const strategyAnalysisSchema = z.object({
    executiveSummary: executiveSummarySchema,
    unifiedRecommendations: z.array(unifiedRecommendationSchema),
});

export type StrategyAnalysis = z.infer<typeof strategyAnalysisSchema>;
