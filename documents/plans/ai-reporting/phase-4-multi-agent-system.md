# Phase 4: SEO/SEM Interplay Report (Multi-Agent System)

## Objective

Build the backend multi-agent AI system that generates the SEO/SEM Interplay Report. This is the core MVP functionality that produces actionable recommendations by analyzing the interplay between paid (Google Ads) and organic (Search Console) data.

## Prerequisites

- **Required**: Phase 0 (Prerequisites) must be completed first. It creates:
  - `csv_uploads` table for tracking uploads
  - `auction_insights` table for competitor data (CSV-sourced)
  - `campaign_metrics`, `device_metrics`, `daily_account_metrics` tables
  - Extended `google_ads_queries` with `data_source` column
- Database schema is set up with existing tables for `client_accounts`, `search_queries`, `google_ads_queries`, `search_console_queries`, `query_overlaps`, `recommendations`
- Data is available from either OAuth API sync OR CSV upload (both are first-class citizens)
- Anthropic Claude API is configured
- Existing analysis agents exist in `apps/api/src/services/analysis-agents/`

> **Note**: The recommended implementation order is: `Phase 0 → Phase 4 → Phase 1 → Phase 2 → Phase 3 → Phase 5`
> Phase 0 is required before Phase 4. See `/documents/plans/ai-reporting/README.md` for details.

## Context

### Current State
- Analysis agents exist: `sem-agent.ts`, `seo-agent.ts`, `strategy-agent.ts`
- Agent types defined in `analysis-agents/types.ts`
- `ai-analyzer.service.ts` has Claude integration
- `client-sync.service.ts` handles data synchronization
- **Phase 0 tables exist**: `csv_uploads`, `auction_insights`, `campaign_metrics`, etc.
- Data can come from OAuth API sync OR CSV upload (identified by `data_source` column)

### Target State
- New `interplay_reports` table stores generated reports
- Extended `recommendations` table supports interplay report recommendations
- Multi-agent pipeline: Scout → Researcher → SEM Agent → SEO Agent → Director
- Auto-trigger report generation after first sync OR first CSV upload
- API endpoint to fetch stored reports
- Scout and Researcher utilize `auction_insights` data for competitive analysis

## Agent Architecture Reference

The prompts and data flows in this document are based on the **SEO/SEM Interplay Report: Agent Architecture** specification. Key design principles:

| Agent | Role | Input | Output |
|-------|------|-------|--------|
| **Scout** | Data Triage | Raw query/page data | Battleground Keywords + Critical Pages |
| **Researcher** | Active Research | Scout findings | Enriched data with competitive metrics + page content |
| **SEM Agent** | Paid Search Specialist | Enriched keywords | `semActions[]` with bid/budget recommendations |
| **SEO Agent** | Organic Growth Specialist | Enriched pages | `seoActions[]` with content/technical recommendations |
| **Director** | Strategy Synthesis | Both agent outputs | Executive Summary + Unified Recommendations (max 10) |

### Phase 1: Research Layer (Scout + Researcher)

**The Scout (Data Triage)** - Non-AI, pure data analysis:

| Track | Goal | Triage Criteria |
|-------|------|-----------------|
| **SEM** | Identify "Battleground Keywords" | 1. High Spend + Low ROAS<br>2. High Organic Rank (#1-3) + High Ad Spend (Cannibalization)<br>3. High Conversions + Low Impression Share (Growth) |
| **SEO** | Identify "Critical Pages" | 1. High Paid Spend + Low Organic Rank<br>2. High Organic Traffic + High Bounce Rate<br>3. High Impressions + Low CTR |

**The Researcher (Active Research)** - Fetches additional context:

| Track | Action | Data Fetched |
|-------|--------|--------------|
| **SEM** | Enrich Battleground Keywords | Search Impression Share, Lost IS (Rank), Lost IS (Budget) per keyword |
| **SEO** | Fetch Critical Page Content | Live HTML → word count, H1, title tag, meta description |

**SEM Data Granularity** (important for accuracy):

| Data Level | Source | Accuracy | Notes |
|------------|--------|----------|-------|
| **Keyword** | CSV with keyword segment | ✅ Best | Each keyword gets its own competitive metrics |
| **Account** | CSV without segments | ⚠️ Fallback | Same metrics applied to all keywords |

The `dataLevel` field in `CompetitiveMetrics` indicates which level was used. For accurate
per-keyword analysis, users should export Auction Insights at **keyword level** from Google Ads.

### Phase 2: Analysis Layer (SEM + SEO Agents)

Claude-powered specialist analysis running in parallel:
- **SEM Agent**: Analyzes enriched keywords, generates bid/budget recommendations
- **SEO Agent**: Analyzes enriched pages + content, generates content/technical recommendations

### Phase 3: Strategy Layer (Director)

Claude-powered synthesis:
- Resolves conflicts between SEM and SEO recommendations
- Prioritizes by business impact
- Filters to max 10 recommendations
- Generates executive summary

### Key Design Decisions

- **Auction Insights** are primary source for competitive metrics (CSV upload via Phase 0)
- **Page content fetching** enabled by default for MVP (can be disabled via `fetchPageContent: false` option)
- **Filtering logic** is applied server-side after Claude returns recommendations (not in prompt)
- **All outputs** are validated with Zod schemas before storage
- **Encrypted snapshots** stored for audit trail

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SEO/SEM INTERPLAY REPORT                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 1: RESEARCH LAYER                                        │
│  ┌──────────────┐    ┌──────────────┐                           │
│  │   The Scout  │───▶│ The Researcher│                          │
│  │ (Data Triage)│    │(Fetch Details)│                          │
│  └──────────────┘    └──────────────┘                           │
│         │                    │                                   │
│         ▼                    ▼                                   │
│  • Battleground Keywords    • Competitive Metrics                │
│  • Critical Pages           • Page HTML Content                  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 2: ANALYSIS LAYER                                        │
│  ┌──────────────┐    ┌──────────────┐                           │
│  │  SEM Agent   │    │  SEO Agent   │                           │
│  │(Paid Search) │    │  (Organic)   │                           │
│  └──────────────┘    └──────────────┘                           │
│         │                    │                                   │
│         ▼                    ▼                                   │
│  • semActions[]             • seoActions[]                       │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 3: STRATEGY LAYER                                        │
│  ┌──────────────────────────────────┐                           │
│  │           The Director           │                           │
│  │  (Synthesize & Prioritize)       │                           │
│  └──────────────────────────────────┘                           │
│                      │                                           │
│                      ▼                                           │
│  • executiveSummary                                              │
│  • unifiedRecommendations[] (max 10, sorted by impact)          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Tasks

### Task 1: Create Database Migration

Create a new migration file for the `interplay_reports` table and `recommendations` table extensions.

**File**: `apps/api/drizzle/XXXX_interplay_reports.sql`

```sql
-- Create report trigger enum
CREATE TYPE report_trigger AS ENUM ('client_creation', 'manual', 'scheduled');

-- Create report status enum
CREATE TYPE report_status AS ENUM ('pending', 'researching', 'analyzing', 'completed', 'failed');

-- Create recommendation source enum
CREATE TYPE recommendation_source AS ENUM ('legacy', 'interplay_report');

-- Create recommendation category enum
CREATE TYPE recommendation_category AS ENUM ('sem', 'seo', 'hybrid');

-- Create impact level enum
CREATE TYPE impact_level AS ENUM ('high', 'medium', 'low');

-- Create effort level enum
CREATE TYPE effort_level AS ENUM ('high', 'medium', 'low');

-- Create interplay_reports table
CREATE TABLE interplay_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  trigger_type report_trigger NOT NULL,
  status report_status NOT NULL DEFAULT 'pending',

  -- Date range analyzed
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  date_range_days INTEGER NOT NULL DEFAULT 30,

  -- Phase outputs (stored as encrypted JSON)
  scout_findings_encrypted TEXT,
  researcher_data_encrypted TEXT,
  sem_agent_output_encrypted TEXT,
  seo_agent_output_encrypted TEXT,
  director_output_encrypted TEXT,

  -- Final output (also encrypted but easier to query)
  executive_summary_encrypted TEXT,
  unified_recommendations_encrypted TEXT,

  -- Metadata
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes
CREATE INDEX idx_interplay_reports_client ON interplay_reports(client_account_id);
CREATE INDEX idx_interplay_reports_status ON interplay_reports(status);
CREATE INDEX idx_interplay_reports_created ON interplay_reports(created_at);

-- Extend recommendations table
ALTER TABLE recommendations
  ADD COLUMN source recommendation_source DEFAULT 'legacy',
  ADD COLUMN interplay_report_id UUID REFERENCES interplay_reports(id) ON DELETE SET NULL,
  ADD COLUMN recommendation_category recommendation_category,
  ADD COLUMN title VARCHAR(255),
  ADD COLUMN impact_level impact_level,
  ADD COLUMN effort_level effort_level,
  ADD COLUMN action_items TEXT[];

-- Make query_overlap_id nullable for interplay recommendations
ALTER TABLE recommendations
  ALTER COLUMN query_overlap_id DROP NOT NULL;

-- Add index for interplay report recommendations
CREATE INDEX idx_recommendations_interplay_report ON recommendations(interplay_report_id);
CREATE INDEX idx_recommendations_source ON recommendations(source);
```

### Task 2: Update Database Schema (Drizzle)

**File**: `apps/api/src/db/schema.ts`

Add the following after existing enums:

```typescript
// Add new enums
export const reportTriggerEnum = pgEnum('report_trigger', ['client_creation', 'manual', 'scheduled']);
export const reportStatusEnum = pgEnum('report_status', ['pending', 'researching', 'analyzing', 'completed', 'failed']);
export const recommendationSourceEnum = pgEnum('recommendation_source', ['legacy', 'interplay_report']);
export const recommendationCategoryEnum = pgEnum('recommendation_category', ['sem', 'seo', 'hybrid']);
export const impactLevelEnum = pgEnum('impact_level', ['high', 'medium', 'low']);
export const effortLevelEnum = pgEnum('effort_level', ['high', 'medium', 'low']);

// Add interplay_reports table
export const interplayReports = pgTable('interplay_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  triggerType: reportTriggerEnum('trigger_type').notNull(),
  status: reportStatusEnum('status').default('pending'),

  // Date range analyzed
  dateRangeStart: date('date_range_start').notNull(),
  dateRangeEnd: date('date_range_end').notNull(),
  dateRangeDays: integer('date_range_days').default(30),

  // Phase outputs (encrypted JSON)
  scoutFindingsEncrypted: text('scout_findings_encrypted'),
  researcherDataEncrypted: text('researcher_data_encrypted'),
  semAgentOutputEncrypted: text('sem_agent_output_encrypted'),
  seoAgentOutputEncrypted: text('seo_agent_output_encrypted'),
  directorOutputEncrypted: text('director_output_encrypted'),

  // Final output (encrypted)
  executiveSummaryEncrypted: text('executive_summary_encrypted'),
  unifiedRecommendationsEncrypted: text('unified_recommendations_encrypted'),

  // Metadata
  tokensUsed: integer('tokens_used'),
  processingTimeMs: integer('processing_time_ms'),
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  clientIdx: index('idx_interplay_reports_client').on(table.clientAccountId),
  statusIdx: index('idx_interplay_reports_status').on(table.status),
  createdIdx: index('idx_interplay_reports_created').on(table.createdAt),
}));

// Update recommendations table - add new columns
// Note: The actual column additions are handled by migration
// This shows the final schema shape

// Add relations
export const interplayReportsRelations = relations(interplayReports, ({ one, many }) => ({
  clientAccount: one(clientAccounts, {
    fields: [interplayReports.clientAccountId],
    references: [clientAccounts.id],
  }),
  recommendations: many(recommendations),
}));
```

### Task 3: Create Scout Agent

The Scout analyzes raw data to identify areas requiring deeper investigation.

**File**: `apps/api/src/services/analysis-agents/scout.agent.ts`

```typescript
import { QueryData, InterplayData } from './types';
import { logger } from '@/utils/logger';

export interface ScoutFindings {
  battlegroundKeywords: BattlegroundKeyword[];
  criticalPages: CriticalPage[];
  summary: {
    totalQueriesAnalyzed: number;
    battlegroundCount: number;
    criticalPagesCount: number;
  };
}

export interface BattlegroundKeyword {
  query: string;
  reason: 'high_spend_low_roas' | 'cannibalization_risk' | 'growth_potential' | 'high_competitor_overlap';
  metrics: {
    spend?: number;
    roas?: number;
    organicPosition?: number;
    conversionRate?: number;
    impressionShare?: number;
    competitorOverlapRate?: number;  // From auction_insights table (CSV upload)
  };
  priority: 'high' | 'medium' | 'low';
}

export interface CriticalPage {
  url: string;
  reason: 'high_spend_low_rank' | 'high_traffic_high_bounce' | 'high_impressions_low_ctr';
  metrics: {
    spend?: number;
    organicPosition?: number;
    bounceRate?: number;
    impressions?: number;
    ctr?: number;
  };
  priority: 'high' | 'medium' | 'low';
}

/**
 * The Scout - Data Triage Agent
 *
 * Per spec: "Before any AI analysis begins, the system (acting as 'The Scout')
 * performs a Data Triage to identify areas requiring deeper investigation."
 *
 * SEM Research Track (Battleground Keywords):
 * 1. High Spend (> $X) AND Low ROAS
 * 2. High Organic Rank (#1-3) AND High Ad Spend (Cannibalization risk)
 * 3. High Conversions AND Low Impression Share (Growth potential)
 *
 * SEO Research Track (Critical Pages):
 * 1. High Paid Spend (> $X) AND Low Organic Rank
 * 2. High Organic Traffic AND High Bounce Rate (> X%)
 * 3. High Impressions AND Low CTR
 */
export function runScout(data: InterplayData): ScoutFindings {
  logger.info({ queriesCount: data.queries.length }, 'Scout: Starting data triage');

  const battlegroundKeywords: BattlegroundKeyword[] = [];
  const criticalPages: CriticalPage[] = [];
  const seenPages = new Set<string>();

  for (const query of data.queries) {
    // Skip queries without both paid and organic data
    if (!query.googleAds && !query.searchConsole) continue;

    // === SEM TRACK: Battleground Keywords ===

    // 1. High Spend + Low ROAS
    if (query.googleAds && query.googleAds.spend > 100 && query.googleAds.roas < 2) {
      battlegroundKeywords.push({
        query: query.query,
        reason: 'high_spend_low_roas',
        metrics: {
          spend: query.googleAds.spend,
          roas: query.googleAds.roas,
        },
        priority: query.googleAds.spend > 500 ? 'high' : 'medium',
      });
    }

    // 2. Cannibalization Risk: High Organic Rank (#1-3) + High Ad Spend
    if (
      query.searchConsole &&
      query.googleAds &&
      query.searchConsole.position <= 3 &&
      query.googleAds.spend > 50
    ) {
      battlegroundKeywords.push({
        query: query.query,
        reason: 'cannibalization_risk',
        metrics: {
          spend: query.googleAds.spend,
          organicPosition: query.searchConsole.position,
        },
        priority: query.searchConsole.position === 1 ? 'high' : 'medium',
      });
    }

    // 3. Growth Potential: High Conversions + Low Impression Share
    if (
      query.googleAds &&
      query.competitiveMetrics &&
      query.googleAds.conversions > 5 &&
      query.competitiveMetrics.impressionShare < 50
    ) {
      battlegroundKeywords.push({
        query: query.query,
        reason: 'growth_potential',
        metrics: {
          conversionRate: query.googleAds.conversions / (query.googleAds.clicks || 1),
          impressionShare: query.competitiveMetrics.impressionShare,
        },
        priority: query.competitiveMetrics.impressionShare < 30 ? 'high' : 'medium',
      });
    }

    // === SEO TRACK: Critical Pages ===

    const pageUrl = query.searchConsole?.url;
    if (pageUrl && !seenPages.has(pageUrl)) {
      seenPages.add(pageUrl);

      // 1. High Paid Spend + Low Organic Rank
      if (
        query.googleAds &&
        query.searchConsole &&
        query.googleAds.spend > 100 &&
        query.searchConsole.position > 10
      ) {
        criticalPages.push({
          url: pageUrl,
          reason: 'high_spend_low_rank',
          metrics: {
            spend: query.googleAds.spend,
            organicPosition: query.searchConsole.position,
          },
          priority: query.googleAds.spend > 300 ? 'high' : 'medium',
        });
      }

      // 2. High Organic Traffic + High Bounce Rate (from GA4 data if available)
      if (query.ga4Metrics && query.ga4Metrics.sessions > 100 && query.ga4Metrics.bounceRate > 70) {
        criticalPages.push({
          url: pageUrl,
          reason: 'high_traffic_high_bounce',
          metrics: {
            bounceRate: query.ga4Metrics.bounceRate,
          },
          priority: query.ga4Metrics.bounceRate > 80 ? 'high' : 'medium',
        });
      }

      // 3. High Impressions + Low CTR
      if (
        query.searchConsole &&
        query.searchConsole.impressions > 1000 &&
        query.searchConsole.ctr < 0.02
      ) {
        criticalPages.push({
          url: pageUrl,
          reason: 'high_impressions_low_ctr',
          metrics: {
            impressions: query.searchConsole.impressions,
            ctr: query.searchConsole.ctr,
          },
          priority: query.searchConsole.impressions > 5000 ? 'high' : 'medium',
        });
      }
    }
  }

  // Deduplicate and sort by priority
  const uniqueBattlegrounds = deduplicateByQuery(battlegroundKeywords);
  const uniquePages = deduplicateByUrl(criticalPages);

  const findings: ScoutFindings = {
    battlegroundKeywords: sortByPriority(uniqueBattlegrounds).slice(0, 20),
    criticalPages: sortByPriority(uniquePages).slice(0, 10),
    summary: {
      totalQueriesAnalyzed: data.queries.length,
      battlegroundCount: uniqueBattlegrounds.length,
      criticalPagesCount: uniquePages.length,
    },
  };

  logger.info(
    {
      battlegroundKeywords: findings.battlegroundKeywords.length,
      criticalPages: findings.criticalPages.length,
    },
    'Scout: Triage complete'
  );

  return findings;
}

function deduplicateByQuery(keywords: BattlegroundKeyword[]): BattlegroundKeyword[] {
  const seen = new Map<string, BattlegroundKeyword>();
  for (const kw of keywords) {
    const existing = seen.get(kw.query);
    if (!existing || priorityValue(kw.priority) > priorityValue(existing.priority)) {
      seen.set(kw.query, kw);
    }
  }
  return Array.from(seen.values());
}

function deduplicateByUrl(pages: CriticalPage[]): CriticalPage[] {
  const seen = new Map<string, CriticalPage>();
  for (const page of pages) {
    const existing = seen.get(page.url);
    if (!existing || priorityValue(page.priority) > priorityValue(existing.priority)) {
      seen.set(page.url, page);
    }
  }
  return Array.from(seen.values());
}

function sortByPriority<T extends { priority: 'high' | 'medium' | 'low' }>(items: T[]): T[] {
  return items.sort((a, b) => priorityValue(b.priority) - priorityValue(a.priority));
}

function priorityValue(priority: 'high' | 'medium' | 'low'): number {
  return { high: 3, medium: 2, low: 1 }[priority];
}
```

### Task 4: Create Researcher Agent

The Researcher fetches additional data for items flagged by the Scout.

**File**: `apps/api/src/services/analysis-agents/researcher.agent.ts`

```typescript
import { ScoutFindings, BattlegroundKeyword, CriticalPage } from './scout.agent';
import { CompetitiveMetrics } from './types';
import { logger } from '@/utils/logger';
import { db } from '@/db';
import { auctionInsights } from '@/db/schema';  // From Phase 0
import { eq, desc, and, isNull, isNotNull, sql } from 'drizzle-orm';

export interface ResearcherData {
  enrichedKeywords: EnrichedKeyword[];
  enrichedPages: EnrichedPage[];
  researchSummary: {
    keywordsEnriched: number;
    pagesEnriched: number;
    competitiveDataAvailable: boolean;
  };
}

export interface EnrichedKeyword extends BattlegroundKeyword {
  competitiveMetrics?: CompetitiveMetrics;
}

/**
 * CompetitiveMetrics structure aligned with spec:
 * - Search Impression Share
 * - Search Lost IS (Rank) - Lost due to ad rank
 * - Search Lost IS (Budget) - Lost due to budget constraints
 *
 * The `dataLevel` field indicates data granularity:
 * - 'keyword': Data is specific to this keyword (most accurate)
 * - 'account': Account-level fallback (less accurate, same for all keywords)
 */
export interface CompetitiveMetrics {
  dataLevel?: 'keyword' | 'account';  // Indicates data granularity for transparency
  impressionShare?: number;           // Search Impression Share (0-100)
  lostImpressionShareRank?: number;   // Search Lost IS (Rank) (0-100)
  lostImpressionShareBudget?: number; // Search Lost IS (Budget) (0-100)
  topCompetitors?: Array<{
    domain: string;
    overlapRate?: number;
    outrankingShare?: number;
    positionAboveRate?: number;
  }>;
}

export interface EnrichedPage extends CriticalPage {
  pageContent?: string;  // Live HTML content fetched by Researcher
  contentAnalysis?: {
    wordCount?: number;
    hasH1?: boolean;
    metaDescriptionLength?: number;
    titleTag?: string;
    h1Text?: string;
  };
}

/**
 * The Researcher - Active Research Agent
 *
 * Per spec: "This 'Active Research' ensures the agents have the specific context they need."
 *
 * SEM Research Track:
 * - Fetches Competitive Metrics FOR EACH SPECIFIC BATTLEGROUND KEYWORD:
 *   - Search Impression Share
 *   - Search Lost IS (Rank)
 *   - Search Lost IS (Budget)
 *
 * Data sources (in priority order):
 * 1. Keyword-level auction insights (most accurate - requires keyword-level CSV export)
 * 2. Account-level auction insights (fallback - same data for all keywords)
 * 3. Google Ads API (Post-MVP)
 *
 * IMPORTANT: For accurate per-keyword analysis, users should export Auction Insights
 * at KEYWORD level from Google Ads UI, not account level. The `dataLevel` field in
 * CompetitiveMetrics indicates which level of data was used.
 *
 * SEO Research Track:
 * - Fetches the Live HTML Content for Critical Pages to enable content quality analysis
 * - Extracts: word count, H1, title tag, meta description
 */
export async function runResearcher(
  scoutFindings: ScoutFindings,
  clientId: string,
  options?: {
    fetchCompetitiveMetrics?: boolean;
    fetchPageContent?: boolean;
  }
): Promise<ResearcherData> {
  // Both enabled by default for MVP per spec
  const { fetchCompetitiveMetrics = true, fetchPageContent = true } = options || {};

  logger.info(
    {
      battlegroundKeywords: scoutFindings.battlegroundKeywords.length,
      criticalPages: scoutFindings.criticalPages.length,
      fetchCompetitiveMetrics,
      fetchPageContent,
    },
    'Researcher: Starting research phase'
  );

  // Enrich battleground keywords with competitive metrics
  const enrichedKeywords: EnrichedKeyword[] = await Promise.all(
    scoutFindings.battlegroundKeywords.map(async (keyword) => {
      if (fetchCompetitiveMetrics) {
        try {
          // TODO: Implement actual Google Ads API call for competitive metrics
          // For MVP, we'll use the metrics already available in the query data
          const competitiveMetrics = await fetchKeywordCompetitiveMetrics(clientId, keyword.query);
          return { ...keyword, competitiveMetrics };
        } catch (error) {
          logger.warn({ query: keyword.query, error }, 'Failed to fetch competitive metrics');
          return keyword;
        }
      }
      return keyword;
    })
  );

  // Enrich critical pages with content analysis (per spec: fetch Live HTML Content)
  const enrichedPages: EnrichedPage[] = await Promise.all(
    scoutFindings.criticalPages.map(async (page) => {
      if (fetchPageContent) {
        try {
          const result = await fetchAndAnalyzePageContent(page.url);
          if (result) {
            return {
              ...page,
              pageContent: result.pageContent,
              contentAnalysis: result.contentAnalysis,
            };
          }
          return page;
        } catch (error) {
          logger.warn({ url: page.url, error }, 'Failed to fetch page content');
          return page;
        }
      }
      return page;
    })
  );

  const researcherData: ResearcherData = {
    enrichedKeywords,
    enrichedPages,
    researchSummary: {
      keywordsEnriched: enrichedKeywords.filter((k) => k.competitiveMetrics).length,
      pagesEnriched: enrichedPages.filter((p) => p.contentAnalysis).length,
      competitiveDataAvailable: fetchCompetitiveMetrics,
    },
  };

  logger.info(
    {
      keywordsEnriched: researcherData.researchSummary.keywordsEnriched,
      pagesEnriched: researcherData.researchSummary.pagesEnriched,
    },
    'Researcher: Research phase complete'
  );

  return researcherData;
}

/**
 * Fetch competitive metrics for enriching keywords
 *
 * Per spec, fetches FOR EACH SPECIFIC KEYWORD:
 * - Search Impression Share
 * - Search Lost IS (Rank)
 * - Search Lost IS (Budget)
 *
 * Data sources (in order of preference):
 * 1. Keyword-level auction insights (most granular, preferred)
 * 2. Account-level auction insights (fallback if no keyword-level data)
 * 3. Google Ads API (Post-MVP)
 *
 * IMPORTANT: For accurate per-keyword analysis, users should export
 * Auction Insights at KEYWORD level from Google Ads, not account level.
 */
async function fetchKeywordCompetitiveMetrics(
  clientId: string,
  query: string
): Promise<CompetitiveMetrics | undefined> {
  // Normalize query for matching (lowercase, trim)
  const normalizedQuery = query.toLowerCase().trim();

  // STEP 1: Try to find KEYWORD-LEVEL auction insights for this specific query
  const keywordLevelData = await db
    .select()
    .from(auctionInsights)
    .where(
      and(
        eq(auctionInsights.clientAccountId, clientId),
        isNotNull(auctionInsights.keyword), // Must have keyword populated
        sql`LOWER(TRIM(${auctionInsights.keyword})) = ${normalizedQuery}`
      )
    )
    .orderBy(desc(auctionInsights.dateRangeEnd))
    .limit(20);

  if (keywordLevelData.length > 0) {
    // We have keyword-specific competitive data - use it
    const competitors = keywordLevelData.filter(a => !a.isOwnAccount);
    const ownData = keywordLevelData.find(a => a.isOwnAccount);

    logger.debug(
      { query, matchCount: keywordLevelData.length },
      'Researcher: Found keyword-level auction insights'
    );

    return {
      dataLevel: 'keyword', // Indicates this is keyword-specific data
      impressionShare: ownData?.impressionShare ? Number(ownData.impressionShare) : undefined,
      lostImpressionShareRank: ownData?.lostImpressionShareRank ? Number(ownData.lostImpressionShareRank) : undefined,
      lostImpressionShareBudget: ownData?.lostImpressionShareBudget ? Number(ownData.lostImpressionShareBudget) : undefined,
      topCompetitors: competitors.slice(0, 5).map(c => ({
        domain: c.competitorDomain,
        overlapRate: c.overlapRate ? Number(c.overlapRate) : undefined,
        outrankingShare: c.outrankingShare ? Number(c.outrankingShare) : undefined,
        positionAboveRate: c.positionAboveRate ? Number(c.positionAboveRate) : undefined,
      })),
    };
  }

  // STEP 2: FALLBACK - Use account-level auction insights
  // This is less accurate but better than nothing
  const accountLevelData = await db
    .select()
    .from(auctionInsights)
    .where(
      and(
        eq(auctionInsights.clientAccountId, clientId),
        isNull(auctionInsights.keyword), // Account-level = no keyword segment
        isNull(auctionInsights.campaignName) // Account-level = no campaign segment
      )
    )
    .orderBy(desc(auctionInsights.dateRangeEnd))
    .limit(10);

  if (accountLevelData.length > 0) {
    const competitors = accountLevelData.filter(a => !a.isOwnAccount);
    const ownData = accountLevelData.find(a => a.isOwnAccount);

    logger.warn(
      { query, clientId },
      'Researcher: No keyword-level auction insights found, using account-level fallback. ' +
      'For more accurate analysis, export Auction Insights at keyword level from Google Ads.'
    );

    return {
      dataLevel: 'account', // Indicates this is account-level fallback
      impressionShare: ownData?.impressionShare ? Number(ownData.impressionShare) : undefined,
      lostImpressionShareRank: ownData?.lostImpressionShareRank ? Number(ownData.lostImpressionShareRank) : undefined,
      lostImpressionShareBudget: ownData?.lostImpressionShareBudget ? Number(ownData.lostImpressionShareBudget) : undefined,
      topCompetitors: competitors.slice(0, 5).map(c => ({
        domain: c.competitorDomain,
        overlapRate: c.overlapRate ? Number(c.overlapRate) : undefined,
        outrankingShare: c.outrankingShare ? Number(c.outrankingShare) : undefined,
        positionAboveRate: c.positionAboveRate ? Number(c.positionAboveRate) : undefined,
      })),
    };
  }

  // STEP 3: No auction insights data at all
  logger.info({ query, clientId }, 'Researcher: No auction insights data available for keyword');

  // Post-MVP: Call Google Ads API for real-time competitive metrics
  return undefined;
}

/**
 * Fetch and analyze page content for critical pages
 *
 * Per spec: "The Researcher (Action): Fetches the Live HTML Content
 * for these specific pages to enable content quality analysis."
 *
 * MVP: Basic implementation with timeout and error handling
 * Post-MVP: More sophisticated content analysis
 */
async function fetchAndAnalyzePageContent(
  url: string
): Promise<{ pageContent: string; contentAnalysis: EnrichedPage['contentAnalysis'] } | undefined> {
  try {
    // Fetch the page with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Advergent-SEO-Analyzer/1.0',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      logger.warn({ url, status: response.status }, 'Failed to fetch page content');
      return undefined;
    }

    const html = await response.text();

    // Basic content analysis
    const contentAnalysis = analyzeHtmlContent(html);

    return {
      pageContent: html.slice(0, 50000), // Limit to 50KB for AI context
      contentAnalysis,
    };
  } catch (error) {
    logger.warn({ url, error }, 'Error fetching page content');
    return undefined;
  }
}

/**
 * Analyze HTML content for SEO-relevant metrics
 */
function analyzeHtmlContent(html: string): EnrichedPage['contentAnalysis'] {
  // Extract text content (strip HTML tags)
  const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = textContent.split(/\s+/).length;

  // Extract title tag
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const titleTag = titleMatch ? titleMatch[1].trim() : undefined;

  // Extract H1
  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  const h1Text = h1Match ? h1Match[1].trim() : undefined;
  const hasH1 = !!h1Text;

  // Extract meta description
  const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const metaDescription = metaMatch ? metaMatch[1] : undefined;
  const metaDescriptionLength = metaDescription?.length || 0;

  return {
    wordCount,
    hasH1,
    metaDescriptionLength,
    titleTag,
    h1Text,
  };
}
```

### Task 5: Update SEM Agent

Update the existing SEM agent to work with researcher data.

**File**: `apps/api/src/services/analysis-agents/sem-agent.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { EnrichedKeyword, ResearcherData } from './researcher.agent';
import { semAnalysisSchema, SemAnalysis } from './types';
import { logger } from '@/utils/logger';
import { config } from '@/config';

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

/**
 * SEM Agent - Paid Search Analysis
 *
 * Analyzes battleground keywords and generates SEM recommendations
 */
export async function runSEMAgent(
  researcherData: ResearcherData,
  context: {
    clientName: string;
    totalSpend: number;
    totalRevenue: number;
  }
): Promise<SemAnalysis> {
  logger.info(
    { keywords: researcherData.enrichedKeywords.length },
    'SEM Agent: Starting analysis'
  );

  const prompt = buildSEMPrompt(researcherData.enrichedKeywords, context);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content.text;
    const parsed = JSON.parse(jsonStr);

    // Validate with Zod
    const validated = semAnalysisSchema.parse(parsed);

    logger.info(
      { actionsCount: validated.semActions.length },
      'SEM Agent: Analysis complete'
    );

    return validated;
  } catch (error) {
    logger.error({ error }, 'SEM Agent: Analysis failed');
    throw error;
  }
}

function buildSEMPrompt(
  keywords: EnrichedKeyword[],
  context: { clientName: string; totalSpend: number; totalRevenue: number }
): string {
  const keywordData = keywords
    .map((kw, i) => {
      return `${i + 1}. Query: "${kw.query}"
   - Reason Flagged: ${kw.reason}
   - Priority: ${kw.priority}
   - Metrics: ${JSON.stringify(kw.metrics)}
   ${kw.competitiveMetrics ? `- Competitive: ${JSON.stringify(kw.competitiveMetrics)}` : ''}`;
    })
    .join('\n\n');

  // System prompt based on detailed agent architecture spec
  return `You are an elite Google Ads Strategist. Your goal is to maximize ROAS and efficiency by deeply analyzing the relationship between Paid Search data, Organic Search performance, and GA4 User Behavior.

## Input Data

### Account Context
- Client: ${context.clientName}
- Total Monthly Spend: $${context.totalSpend.toFixed(2)}
- Total Monthly Revenue: $${context.totalRevenue.toFixed(2)}
- Overall ROAS: ${(context.totalRevenue / context.totalSpend).toFixed(2)}

### Battleground Keywords (Query Overlap Data)
These keywords have been flagged by our Scout as requiring attention. Each contains:
- **Google Ads**: Spend, CPC, Clicks, Conversions, ROAS
- **Competitive Metrics** (from Auction Insights): Impression Share, Overlap Rate, Outranking Share
- **Search Console**: Position, CTR, Impressions
- **GA4** (via Landing Page): Engagement Rate, Bounce Rate, Revenue

${keywordData}

## Your Mandate

Analyze the provided data to identify significant opportunities or inefficiencies. Do not limit yourself to pre-defined rules. Look for patterns such as (but not limited to):

1. **Efficiency Gains**: Where can we pull back spend because organic is doing the heavy lifting?
2. **Aggressive Expansion**: Where is organic failing to convert high-intent traffic that paid ads could capture?
3. **Quality Control**: Are we paying for traffic that bounces immediately (High Spend + High Bounce Rate)?
4. **Defensive Gaps**: High Lost IS (Rank) on brand terms or high-converting keywords.
5. **Budget Constraints**: High Lost IS (Budget) on high-ROAS keywords.
6. **Competitor Threats**: High competitor overlap rate or position above rate indicating aggressive competition.

## Output Requirements

For each opportunity you find, provide a specific, actionable recommendation:

- **Action**: What exactly should be changed in Google Ads? (e.g., "Reduce bids by 30%," "Add negative keyword," "Create new ad group")
- **Level**: Is this a campaign, ad group, or keyword level change?
- **Reasoning**: Explain *why* based on the specific data points (e.g., "High competitor overlap of 65% suggests heavy competition; increase bids to protect market share")
- **Expected Uplift**: Estimate the impact (e.g., "Potential 15% cost saving," "Estimated 10% increase in leads")

## Output Format (JSON)

\`\`\`json
{
  "semActions": [
    {
      "action": "Specific action to take",
      "level": "campaign" | "keyword" | "ad_group",
      "expectedUplift": "Expected outcome with estimated impact",
      "reasoning": "Data-driven explanation referencing specific metrics",
      "impact": "high" | "medium" | "low"
    }
  ]
}
\`\`\`

Focus on the highest-impact recommendations. Aim for 5-10 actionable items.`;
}
```

### Task 6: Update SEO Agent

Update the existing SEO agent to work with researcher data.

**File**: `apps/api/src/services/analysis-agents/seo-agent.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { EnrichedPage, ResearcherData } from './researcher.agent';
import { seoAnalysisSchema, SeoAnalysis } from './types';
import { logger } from '@/utils/logger';
import { config } from '@/config';

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

/**
 * SEO Agent - Organic Search Analysis
 *
 * Analyzes critical pages and generates SEO recommendations
 */
export async function runSEOAgent(
  researcherData: ResearcherData,
  context: {
    clientName: string;
    totalOrganicClicks: number;
    totalImpressions: number;
  }
): Promise<SeoAnalysis> {
  logger.info(
    { pages: researcherData.enrichedPages.length },
    'SEO Agent: Starting analysis'
  );

  const prompt = buildSEOPrompt(researcherData.enrichedPages, context);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content.text;
    const parsed = JSON.parse(jsonStr);

    // Validate with Zod
    const validated = seoAnalysisSchema.parse(parsed);

    logger.info(
      { actionsCount: validated.seoActions.length },
      'SEO Agent: Analysis complete'
    );

    return validated;
  } catch (error) {
    logger.error({ error }, 'SEO Agent: Analysis failed');
    throw error;
  }
}

function buildSEOPrompt(
  pages: EnrichedPage[],
  context: { clientName: string; totalOrganicClicks: number; totalImpressions: number }
): string {
  const pageData = pages
    .map((page, i) => {
      return `${i + 1}. URL: ${page.url}
   - Reason Flagged: ${page.reason}
   - Priority: ${page.priority}
   - Metrics: ${JSON.stringify(page.metrics)}
   ${page.contentAnalysis ? `- Content Analysis: ${JSON.stringify(page.contentAnalysis)}` : ''}
   ${page.pageContent ? `- Page Content Available: Yes (see below)` : '- Page Content: Not fetched'}`;
    })
    .join('\n\n');

  // System prompt based on detailed agent architecture spec
  return `You are an expert SEO Strategist. Your goal is to use Paid Search data as a "cheat sheet" to accelerate organic growth and fix technical/content issues.

## Input Data

### Account Context
- Client: ${context.clientName}
- Total Organic Clicks (30 days): ${context.totalOrganicClicks.toLocaleString()}
- Total Impressions (30 days): ${context.totalImpressions.toLocaleString()}
- Average CTR: ${((context.totalOrganicClicks / context.totalImpressions) * 100).toFixed(2)}%

### Critical Pages (Query Overlap Data)
These pages have been flagged by our Scout as requiring attention. Each contains:
- **Google Ads**: Spend, CPC, Clicks, Conversions, ROAS (on keywords driving traffic to this page)
- **Search Console**: Position, CTR, Impressions
- **GA4**: Engagement Rate, Bounce Rate, Revenue
- **Page Content**: HTML/Text content (when available) for content quality analysis

${pageData}

## Your Mandate

Analyze the data to find where Organic Search is underperforming relative to its potential, using Paid data as a benchmark. Look for:

1. **Content Diagnosis**: For pages with provided content, analyze *why* they might be failing. Is the content relevant to the high-spend keywords? Is the CTA clear?
2. **Content Gaps**: Keywords where Paid Ads convert well, but Organic rank is poor (indicating we lack relevant content).
3. **CTR Issues**: Keywords where we rank well but get fewer clicks than expected (or fewer than Paid Ads), suggesting poor titles/descriptions.
4. **UX/Conversion Mismatches**: Pages that rank well but convert poorly compared to their Paid counterparts.
5. **Keyword Expansion**: High-volume terms from Paid Search that we completely miss in Organic.

## Output Requirements

For each opportunity you find, provide:

- **Condition**: Briefly describe the data pattern you found (e.g., "High Paid Conversions vs. Low Organic Rank")
- **Recommendation**: The high-level strategy (e.g., "Create dedicated landing page")
- **Specific Actions**: Concrete steps to take (e.g., "Draft 1500w guide on [Topic]", "Update meta title to match Paid Ad copy")

## Output Format (JSON)

\`\`\`json
{
  "seoActions": [
    {
      "condition": "The specific data pattern that triggered this recommendation",
      "recommendation": "High-level strategic recommendation",
      "specificActions": [
        "Concrete action step 1",
        "Concrete action step 2",
        "Concrete action step 3"
      ],
      "impact": "high" | "medium" | "low"
    }
  ]
}
\`\`\`

Focus on the highest-impact recommendations. Aim for 5-10 actionable items.`;
}
```

### Task 7: Create Director Agent

The Director synthesizes outputs from SEM and SEO agents.

**File**: `apps/api/src/services/analysis-agents/director.agent.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { SemAnalysis, SeoAnalysis, strategyAnalysisSchema, StrategyAnalysis } from './types';
import { logger } from '@/utils/logger';
import { config } from '@/config';

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

/**
 * The Director - Strategy Synthesis Agent
 *
 * Synthesizes SEM and SEO agent outputs into:
 * 1. Executive Summary
 * 2. Unified Recommendations (max 10, prioritized by impact)
 */
export async function runDirector(
  semAnalysis: SemAnalysis,
  seoAnalysis: SeoAnalysis,
  context: {
    clientName: string;
    totalSpend: number;
    totalRevenue: number;
    totalOrganicClicks: number;
    dateRange: { startDate: string; endDate: string };
  }
): Promise<StrategyAnalysis> {
  logger.info(
    {
      semActions: semAnalysis.semActions.length,
      seoActions: seoAnalysis.seoActions.length,
    },
    'Director: Starting synthesis'
  );

  const prompt = buildDirectorPrompt(semAnalysis, seoAnalysis, context);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content.text;
    const parsed = JSON.parse(jsonStr);

    // Validate with Zod
    const validated = strategyAnalysisSchema.parse(parsed);

    // Apply filtering logic
    const filtered = applyFilteringLogic(validated);

    logger.info(
      {
        recommendationsCount: filtered.unifiedRecommendations.length,
      },
      'Director: Synthesis complete'
    );

    return filtered;
  } catch (error) {
    logger.error({ error }, 'Director: Synthesis failed');
    throw error;
  }
}

function buildDirectorPrompt(
  semAnalysis: SemAnalysis,
  seoAnalysis: SeoAnalysis,
  context: {
    clientName: string;
    totalSpend: number;
    totalRevenue: number;
    totalOrganicClicks: number;
    dateRange: { startDate: string; endDate: string };
  }
): string {
  const semActionsText = semAnalysis.semActions
    .map((a, i) => `${i + 1}. [${a.impact.toUpperCase()}] ${a.action}\n   Reasoning: ${a.reasoning}`)
    .join('\n\n');

  const seoActionsText = seoAnalysis.seoActions
    .map((a, i) => `${i + 1}. [${a.impact.toUpperCase()}] ${a.recommendation}\n   Condition: ${a.condition}`)
    .join('\n\n');

  // System prompt based on detailed agent architecture spec
  return `You are a Digital Marketing Director presenting a strategic report to a client.

## Input Data

### Account Overview
- Client: ${context.clientName}
- Analysis Period: ${context.dateRange.startDate} to ${context.dateRange.endDate}
- Total Ad Spend: $${context.totalSpend.toFixed(2)}
- Total Revenue (Paid): $${context.totalRevenue.toFixed(2)}
- Total Organic Clicks: ${context.totalOrganicClicks.toLocaleString()}
- Current ROAS: ${(context.totalRevenue / context.totalSpend).toFixed(2)}

### SEM Agent Findings
${semActionsText || 'No SEM recommendations generated.'}

### SEO Agent Findings
${seoActionsText || 'No SEO recommendations generated.'}

## Your Mandate

You have received tactical advice from your SEM and SEO specialists. Your job is to:

### 1. Synthesize & Prioritize
Review their recommendations, resolve any conflicts (e.g., SEM says "pause," SEO says "wait"), and order them by **Business Impact** (Revenue/Savings).

### 2. Curation & Filtering
The user should not be overwhelmed. Apply the following logic:
- Rank all recommendations by Impact (High > Medium > Low)
- **Filter**:
  - If you have > 10 High/Medium recommendations, **DROP all Low** recommendations
  - If you have < 5 High/Medium recommendations, **INCLUDE the best Low** recommendations to reach a total of 5-7 items
- **Cap** the final list at 10 items maximum

### 3. Executive Summary
Write a narrative summary of the account's "Health State":
- Are they over-spending? Under-investing?
- Is their organic strategy aligned with their paid goals?
- What are the key opportunities and risks?

### 4. Unified Recommendations
Present the final curated list with clear action items.

## Output Requirements

- **Executive Summary**: 3-5 sentences. Professional, insightful, and focused on the bottom line.
- **Unified Recommendations**: A sorted list of the most impactful actions from both agents.

## Output Format (JSON)

\`\`\`json
{
  "executiveSummary": {
    "summary": "3-5 sentence professional assessment of account health and key opportunities",
    "keyHighlights": [
      "Key insight 1 (most important finding)",
      "Key insight 2",
      "Key insight 3"
    ]
  },
  "unifiedRecommendations": [
    {
      "title": "Short, actionable title",
      "description": "Detailed description explaining the recommendation and its business impact",
      "type": "sem" | "seo" | "hybrid",
      "impact": "high" | "medium" | "low",
      "effort": "high" | "medium" | "low",
      "actionItems": [
        "Specific, implementable action step 1",
        "Specific, implementable action step 2"
      ]
    }
  ]
}
\`\`\`

## Important Guidelines
- Prioritize by business impact (revenue potential and cost savings)
- Resolve conflicts between SEM and SEO recommendations thoughtfully
- Be specific and actionable - avoid generic advice
- Consider the interplay between paid and organic - mark as "hybrid" when both channels are involved
- Estimate effort level based on implementation complexity (High = dev/major content work, Medium = moderate changes, Low = quick wins)`;
}

/**
 * Apply filtering logic to limit recommendations
 */
function applyFilteringLogic(analysis: StrategyAnalysis): StrategyAnalysis {
  const { unifiedRecommendations } = analysis;

  // Sort by impact
  const sorted = [...unifiedRecommendations].sort((a, b) => {
    const impactOrder = { high: 3, medium: 2, low: 1 };
    return impactOrder[b.impact] - impactOrder[a.impact];
  });

  const high = sorted.filter((r) => r.impact === 'high');
  const medium = sorted.filter((r) => r.impact === 'medium');
  const low = sorted.filter((r) => r.impact === 'low');

  let filtered: typeof unifiedRecommendations;

  // Filtering logic:
  // - If > 10 High/Medium: DROP all Low
  // - If < 5 High/Medium: INCLUDE best Low to reach 5-7 items
  // - Cap at 10 maximum

  if (high.length + medium.length >= 10) {
    // Too many high/medium - take top 10
    filtered = [...high, ...medium].slice(0, 10);
  } else if (high.length + medium.length < 5) {
    // Not enough high/medium - add some low to reach 5-7
    const needed = Math.min(7 - high.length - medium.length, low.length);
    filtered = [...high, ...medium, ...low.slice(0, needed)];
  } else {
    // Good balance - include all high/medium, cap at 10
    filtered = [...high, ...medium].slice(0, 10);
  }

  return {
    ...analysis,
    unifiedRecommendations: filtered,
  };
}
```

### Task 8: Create Interplay Report Service

The main orchestration service that coordinates all agents.

**File**: `apps/api/src/services/interplay-report.service.ts`

```typescript
import { db } from '@/db';
import { interplayReports, recommendations, clientAccounts } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '@/utils/logger';
import { runScout } from './analysis-agents/scout.agent';
import { runResearcher } from './analysis-agents/researcher.agent';
import { runSEMAgent } from './analysis-agents/sem-agent';
import { runSEOAgent } from './analysis-agents/seo-agent';
import { runDirector } from './analysis-agents/director.agent';
import { constructInterplayData } from './ai-analyzer.service';
import { encryptData, decryptData } from './encryption.service';

export interface GenerateReportOptions {
  days: number;
  trigger: 'client_creation' | 'manual' | 'scheduled';
}

export interface InterplayReportResponse {
  id: string;
  clientAccountId: string;
  trigger: 'client_creation' | 'manual' | 'scheduled';
  status: 'pending' | 'researching' | 'analyzing' | 'completed' | 'failed';
  dateRange: {
    startDate: string;
    endDate: string;
    days: number;
  };
  executiveSummary: {
    summary: string;
    keyHighlights: string[];
  };
  unifiedRecommendations: Array<{
    title: string;
    description: string;
    type: 'sem' | 'seo' | 'hybrid';
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    actionItems: string[];
  }>;
  generatedAt: string;
  tokensUsed?: number;
  processingTimeMs?: number;
}

/**
 * Generate an SEO/SEM Interplay Report for a client
 */
export async function generateInterplayReport(
  clientId: string,
  options: GenerateReportOptions
): Promise<string> {
  const startTime = Date.now();
  logger.info({ clientId, options }, 'Starting interplay report generation');

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - options.days);

  // Create report record
  const [report] = await db
    .insert(interplayReports)
    .values({
      clientAccountId: clientId,
      triggerType: options.trigger,
      status: 'pending',
      dateRangeStart: startDate.toISOString().split('T')[0],
      dateRangeEnd: endDate.toISOString().split('T')[0],
      dateRangeDays: options.days,
    })
    .returning();

  try {
    // Update status to researching
    await db
      .update(interplayReports)
      .set({ status: 'researching', startedAt: new Date() })
      .where(eq(interplayReports.id, report.id));

    // Get client info
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.id, clientId));

    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    // Phase 1: Gather and construct interplay data
    const interplayData = await constructInterplayData(clientId, options.days);

    // Phase 1a: Run Scout
    const scoutFindings = runScout(interplayData);

    // Phase 1b: Run Researcher
    const researcherData = await runResearcher(scoutFindings, clientId);

    // Store phase 1 outputs
    await db
      .update(interplayReports)
      .set({
        status: 'analyzing',
        scoutFindingsEncrypted: await encryptData(JSON.stringify(scoutFindings)),
        researcherDataEncrypted: await encryptData(JSON.stringify(researcherData)),
      })
      .where(eq(interplayReports.id, report.id));

    // Phase 2: Run SEM and SEO Agents in parallel
    const [semAnalysis, seoAnalysis] = await Promise.all([
      runSEMAgent(researcherData, {
        clientName: client.name,
        totalSpend: interplayData.summary.totalSpend,
        totalRevenue: interplayData.summary.totalRevenue,
      }),
      runSEOAgent(researcherData, {
        clientName: client.name,
        totalOrganicClicks: interplayData.summary.totalOrganicClicks,
        totalImpressions: interplayData.queries.reduce(
          (sum, q) => sum + (q.searchConsole?.impressions || 0),
          0
        ),
      }),
    ]);

    // Store phase 2 outputs
    await db
      .update(interplayReports)
      .set({
        semAgentOutputEncrypted: await encryptData(JSON.stringify(semAnalysis)),
        seoAgentOutputEncrypted: await encryptData(JSON.stringify(seoAnalysis)),
      })
      .where(eq(interplayReports.id, report.id));

    // Phase 3: Run Director
    const directorOutput = await runDirector(semAnalysis, seoAnalysis, {
      clientName: client.name,
      totalSpend: interplayData.summary.totalSpend,
      totalRevenue: interplayData.summary.totalRevenue,
      totalOrganicClicks: interplayData.summary.totalOrganicClicks,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    });

    // Calculate processing time
    const processingTimeMs = Date.now() - startTime;

    // Store final outputs
    await db
      .update(interplayReports)
      .set({
        status: 'completed',
        directorOutputEncrypted: await encryptData(JSON.stringify(directorOutput)),
        executiveSummaryEncrypted: await encryptData(
          JSON.stringify(directorOutput.executiveSummary)
        ),
        unifiedRecommendationsEncrypted: await encryptData(
          JSON.stringify(directorOutput.unifiedRecommendations)
        ),
        processingTimeMs,
        completedAt: new Date(),
      })
      .where(eq(interplayReports.id, report.id));

    // Create recommendations in the recommendations table
    await createRecommendationsFromReport(
      clientId,
      report.id,
      directorOutput.unifiedRecommendations
    );

    logger.info(
      {
        reportId: report.id,
        processingTimeMs,
        recommendationsCount: directorOutput.unifiedRecommendations.length,
      },
      'Interplay report generation complete'
    );

    return report.id;
  } catch (error) {
    logger.error({ error, reportId: report.id }, 'Interplay report generation failed');

    await db
      .update(interplayReports)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      })
      .where(eq(interplayReports.id, report.id));

    throw error;
  }
}

/**
 * Create recommendations from the Director's unified recommendations
 */
async function createRecommendationsFromReport(
  clientId: string,
  reportId: string,
  unifiedRecommendations: Array<{
    title: string;
    description: string;
    type: 'sem' | 'seo' | 'hybrid';
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    actionItems: string[];
  }>
): Promise<void> {
  // Map recommendation type to existing recommendationType enum
  const mapType = (type: string): 'reduce' | 'pause' | 'increase' | 'maintain' => {
    // This is a simplification - in practice, you'd parse the recommendation
    // to determine the specific action type
    return 'maintain';
  };

  for (const rec of unifiedRecommendations) {
    await db.insert(recommendations).values({
      clientAccountId: clientId,
      queryOverlapId: null, // Interplay recommendations are not query-specific
      source: 'interplay_report',
      interplayReportId: reportId,
      recommendationType: mapType(rec.type),
      recommendationCategory: rec.type,
      confidenceLevel: 'high', // Default for AI reports
      title: rec.title,
      reasoning: rec.description,
      impactLevel: rec.impact,
      effortLevel: rec.effort,
      actionItems: rec.actionItems,
      status: 'pending',
    });
  }
}

/**
 * Get the latest interplay report for a client
 */
export async function getLatestInterplayReport(
  clientId: string
): Promise<InterplayReportResponse | null> {
  const [report] = await db
    .select()
    .from(interplayReports)
    .where(eq(interplayReports.clientAccountId, clientId))
    .orderBy(desc(interplayReports.createdAt))
    .limit(1);

  if (!report) {
    return null;
  }

  // Decrypt the stored data
  let executiveSummary = { summary: '', keyHighlights: [] as string[] };
  let unifiedRecommendations: InterplayReportResponse['unifiedRecommendations'] = [];

  if (report.executiveSummaryEncrypted) {
    const decrypted = await decryptData(report.executiveSummaryEncrypted);
    executiveSummary = JSON.parse(decrypted);
  }

  if (report.unifiedRecommendationsEncrypted) {
    const decrypted = await decryptData(report.unifiedRecommendationsEncrypted);
    unifiedRecommendations = JSON.parse(decrypted);
  }

  return {
    id: report.id,
    clientAccountId: report.clientAccountId,
    trigger: report.triggerType,
    status: report.status,
    dateRange: {
      startDate: report.dateRangeStart,
      endDate: report.dateRangeEnd,
      days: report.dateRangeDays || 30,
    },
    executiveSummary,
    unifiedRecommendations,
    generatedAt: report.completedAt?.toISOString() || report.createdAt?.toISOString() || '',
    tokensUsed: report.tokensUsed || undefined,
    processingTimeMs: report.processingTimeMs || undefined,
  };
}

/**
 * Get interplay report with all agent outputs for QA/debugging
 *
 * This returns the full pipeline outputs so you can review:
 * - Scout: What keywords/pages were flagged for investigation
 * - Researcher: What enrichment data was gathered (competitive metrics, page content)
 * - SEM Agent: What paid search recommendations were generated
 * - SEO Agent: What organic recommendations were generated
 * - Director: How recommendations were synthesized and prioritized
 */
export interface InterplayReportDebugResponse extends InterplayReportResponse {
  agentOutputs: {
    scout: {
      battlegroundKeywords: Array<{
        query: string;
        reason: string;
        metrics: Record<string, number | undefined>;
        priority: 'high' | 'medium' | 'low';
      }>;
      criticalPages: Array<{
        url: string;
        reason: string;
        metrics: Record<string, number | undefined>;
        priority: 'high' | 'medium' | 'low';
      }>;
      summary: {
        totalQueriesAnalyzed: number;
        battlegroundCount: number;
        criticalPagesCount: number;
      };
    } | null;
    researcher: {
      enrichedKeywords: Array<{
        query: string;
        competitiveMetrics?: {
          impressionShare?: number;
          lostImpressionShareRank?: number;
          lostImpressionShareBudget?: number;
          topCompetitors?: Array<{ domain: string; overlapRate?: number }>;
        };
      }>;
      enrichedPages: Array<{
        url: string;
        pageContent?: string;
        contentAnalysis?: {
          wordCount?: number;
          hasH1?: boolean;
          titleTag?: string;
          metaDescriptionLength?: number;
        };
      }>;
      researchSummary: {
        keywordsEnriched: number;
        pagesEnriched: number;
        competitiveDataAvailable: boolean;
      };
    } | null;
    semAgent: {
      semActions: Array<{
        action: string;
        level: 'campaign' | 'keyword' | 'ad_group';
        expectedUplift: string;
        reasoning: string;
        impact: 'high' | 'medium' | 'low';
      }>;
    } | null;
    seoAgent: {
      seoActions: Array<{
        condition: string;
        recommendation: string;
        specificActions: string[];
        impact: 'high' | 'medium' | 'low';
      }>;
    } | null;
    director: {
      executiveSummary: {
        summary: string;
        keyHighlights: string[];
      };
      unifiedRecommendations: Array<{
        title: string;
        description: string;
        type: 'sem' | 'seo' | 'hybrid';
        impact: 'high' | 'medium' | 'low';
        effort: 'high' | 'medium' | 'low';
        actionItems: string[];
      }>;
    } | null;
  };
}

export async function getInterplayReportWithAgentOutputs(
  clientId: string
): Promise<InterplayReportDebugResponse | null> {
  const [report] = await db
    .select()
    .from(interplayReports)
    .where(eq(interplayReports.clientAccountId, clientId))
    .orderBy(desc(interplayReports.createdAt))
    .limit(1);

  if (!report) {
    return null;
  }

  // Decrypt all agent outputs
  const [
    scoutFindings,
    researcherData,
    semAgentOutput,
    seoAgentOutput,
    directorOutput,
    executiveSummary,
    unifiedRecommendations,
  ] = await Promise.all([
    report.scoutFindingsEncrypted
      ? decryptData(report.scoutFindingsEncrypted).then(JSON.parse)
      : null,
    report.researcherDataEncrypted
      ? decryptData(report.researcherDataEncrypted).then(JSON.parse)
      : null,
    report.semAgentOutputEncrypted
      ? decryptData(report.semAgentOutputEncrypted).then(JSON.parse)
      : null,
    report.seoAgentOutputEncrypted
      ? decryptData(report.seoAgentOutputEncrypted).then(JSON.parse)
      : null,
    report.directorOutputEncrypted
      ? decryptData(report.directorOutputEncrypted).then(JSON.parse)
      : null,
    report.executiveSummaryEncrypted
      ? decryptData(report.executiveSummaryEncrypted).then(JSON.parse)
      : { summary: '', keyHighlights: [] },
    report.unifiedRecommendationsEncrypted
      ? decryptData(report.unifiedRecommendationsEncrypted).then(JSON.parse)
      : [],
  ]);

  return {
    id: report.id,
    clientAccountId: report.clientAccountId,
    trigger: report.triggerType,
    status: report.status,
    dateRange: {
      startDate: report.dateRangeStart,
      endDate: report.dateRangeEnd,
      days: report.dateRangeDays || 30,
    },
    executiveSummary,
    unifiedRecommendations,
    generatedAt: report.completedAt?.toISOString() || report.createdAt?.toISOString() || '',
    tokensUsed: report.tokensUsed || undefined,
    processingTimeMs: report.processingTimeMs || undefined,
    agentOutputs: {
      scout: scoutFindings,
      researcher: researcherData,
      semAgent: semAgentOutput,
      seoAgent: seoAgentOutput,
      director: directorOutput,
    },
  };
}
```

### Task 9: Create Reports Routes

**File**: `apps/api/src/routes/reports.routes.ts`

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '@/middleware/auth.middleware';
import {
  getLatestInterplayReport,
  getInterplayReportWithAgentOutputs,
  generateInterplayReport,
} from '@/services/interplay-report.service';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * GET /api/clients/:clientId/interplay-report
 * Get the latest interplay report for a client
 */
router.get('/clients/:clientId/interplay-report', authenticate, async (req, res) => {
  try {
    const { clientId } = req.params;

    const report = await getLatestInterplayReport(clientId);

    if (!report) {
      return res.status(404).json({
        error: 'No report found',
        message: 'No interplay report has been generated for this client yet.',
      });
    }

    res.json(report);
  } catch (error) {
    logger.error({ error }, 'Failed to get interplay report');
    res.status(500).json({ error: 'Failed to get interplay report' });
  }
});

/**
 * POST /api/clients/:clientId/interplay-report/regenerate
 * Manually trigger report regeneration (Post-MVP)
 */
router.post('/clients/:clientId/interplay-report/regenerate', authenticate, async (req, res) => {
  try {
    const { clientId } = req.params;

    const reportId = await generateInterplayReport(clientId, {
      days: 30,
      trigger: 'manual',
    });

    res.json({
      message: 'Report regeneration started',
      reportId,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to regenerate interplay report');
    res.status(500).json({ error: 'Failed to regenerate report' });
  }
});

/**
 * GET /api/clients/:clientId/interplay-report/debug
 * Get full report with all agent outputs for QA/debugging
 *
 * Returns all intermediate outputs:
 * - Scout findings (Battleground Keywords + Critical Pages)
 * - Researcher data (Enriched keywords + pages with competitive metrics and content)
 * - SEM Agent output (semActions[])
 * - SEO Agent output (seoActions[])
 * - Director output (Executive Summary + Unified Recommendations)
 */
router.get('/clients/:clientId/interplay-report/debug', authenticate, async (req, res) => {
  try {
    const { clientId } = req.params;

    const report = await getInterplayReportWithAgentOutputs(clientId);

    if (!report) {
      return res.status(404).json({
        error: 'No report found',
        message: 'No interplay report has been generated for this client yet.',
      });
    }

    res.json(report);
  } catch (error) {
    logger.error({ error }, 'Failed to get interplay report debug data');
    res.status(500).json({ error: 'Failed to get interplay report debug data' });
  }
});

export default router;
```

### Task 10: Update Data Ingestion Services for Auto-Trigger

Report generation should be triggered after the **first successful data ingestion** from either OAuth sync OR CSV upload.

#### 10a. Update Client Sync Service (OAuth)

**File**: `apps/api/src/services/client-sync.service.ts`

```typescript
import { db } from '@/db';
import { interplayReports, googleAdsQueries } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { generateInterplayReport } from './interplay-report.service';
import { logger } from '@/utils/logger';

export async function runClientSync(clientId: string, options?: { trigger?: 'manual' | 'scheduled' }) {
  // ... existing sync logic for GA4, Google Ads, Search Console via OAuth ...

  // After successful sync, check if report generation is needed
  try {
    const existingReport = await db
      .select({ id: interplayReports.id })
      .from(interplayReports)
      .where(eq(interplayReports.clientAccountId, clientId))
      .limit(1);

    // Check if we have sufficient data (from either OAuth or CSV)
    const hasData = await checkDataAvailability(clientId);

    if (existingReport.length === 0 && hasData) {
      logger.info({ clientId }, 'First data available - triggering interplay report generation');
      await generateInterplayReport(clientId, { days: 30, trigger: 'client_creation' });
    }
  } catch (error) {
    // Don't fail the sync if report generation fails
    logger.error({ error, clientId }, 'Failed to generate interplay report after sync');
  }
}

// Helper to check if we have data from either source
async function checkDataAvailability(clientId: string): Promise<boolean> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(googleAdsQueries)
    .where(eq(googleAdsQueries.clientAccountId, clientId));

  return (result[0]?.count || 0) > 0;
}
```

#### 10b. Update CSV Import Service (CSV Upload)

**File**: `apps/api/src/services/csv-import.service.ts`

Add auto-trigger at the end of `processUploadSession`:

```typescript
import { generateInterplayReport } from './interplay-report.service';
import { interplayReports } from '@/db/schema';

export async function processUploadSession(
  clientAccountId: string,
  files: Array<{ buffer: Buffer; filename: string; size: number }>,
  uploadedBy: string
): Promise<UploadSessionResult> {
  // ... existing CSV processing logic ...

  // After successful upload, check if report should be generated
  if (result.imported.length > 0) {
    try {
      const existingReport = await db
        .select({ id: interplayReports.id })
        .from(interplayReports)
        .where(eq(interplayReports.clientAccountId, clientAccountId))
        .limit(1);

      if (existingReport.length === 0) {
        logger.info({ clientAccountId }, 'First CSV upload - triggering interplay report generation');
        await generateInterplayReport(clientAccountId, { days: 30, trigger: 'client_creation' });
      }
    } catch (error) {
      // Don't fail the upload if report generation fails
      logger.error({ error, clientAccountId }, 'Failed to generate interplay report after CSV upload');
    }
  }

  return result;
}
```

This ensures report generation is triggered by whichever data source is populated first (OAuth or CSV).

### Task 11: Register Routes

**File**: `apps/api/src/server.ts`

Add the reports routes:

```typescript
import reportsRoutes from '@/routes/reports.routes';

// Add with other route registrations
app.use('/api', reportsRoutes);
```

## File Structure Summary

After completing this phase:

```
apps/api/
├── drizzle/
│   └── XXXX_interplay_reports.sql     # NEW migration
├── src/
│   ├── db/
│   │   └── schema.ts                   # MODIFIED (new tables/columns)
│   ├── routes/
│   │   └── reports.routes.ts           # NEW
│   ├── services/
│   │   ├── interplay-report.service.ts # NEW
│   │   ├── client-sync.service.ts      # MODIFIED (auto-trigger)
│   │   └── analysis-agents/
│   │       ├── types.ts                # EXISTING
│   │       ├── scout.agent.ts          # NEW
│   │       ├── researcher.agent.ts     # NEW
│   │       ├── sem-agent.ts            # MODIFIED
│   │       ├── seo-agent.ts            # MODIFIED
│   │       ├── director.agent.ts       # NEW
│   │       └── strategy-agent.ts       # EXISTING (may be merged into director)
│   └── server.ts                       # MODIFIED (route registration)
```

## Testing Checklist

### Database
- [ ] Migration runs successfully
- [ ] `interplay_reports` table created with all columns
- [ ] `recommendations` table has new columns
- [ ] `query_overlap_id` is nullable

### Scout Agent
- [ ] Correctly identifies battleground keywords
- [ ] Correctly identifies critical pages
- [ ] Deduplication works
- [ ] Priority sorting works

### Researcher Agent
- [ ] Enriches keywords with available data
- [ ] Handles missing competitive metrics gracefully
- [ ] Handles missing page content gracefully

### SEM Agent
- [ ] Generates valid JSON output
- [ ] Output validates against Zod schema
- [ ] Recommendations are actionable and specific

### SEO Agent
- [ ] Generates valid JSON output
- [ ] Output validates against Zod schema
- [ ] Recommendations are actionable and specific

### Director Agent
- [ ] Synthesizes SEM and SEO findings
- [ ] Executive summary is coherent
- [ ] Filtering logic limits to 10 recommendations
- [ ] Impact prioritization works

### Interplay Report Service
- [ ] Creates report record with pending status
- [ ] Updates status through phases
- [ ] Stores encrypted outputs
- [ ] Creates recommendations in recommendations table
- [ ] Handles errors gracefully

### Auto-Trigger
- [ ] Report generates after first client sync
- [ ] Report does NOT generate on subsequent syncs
- [ ] Sync doesn't fail if report generation fails

### API Endpoints
- [ ] `GET /api/clients/:id/interplay-report` returns report
- [ ] Returns 404 if no report exists
- [ ] Report data is properly decrypted

## Notes for Implementation

1. **Encryption**: The implementation assumes `encryptData` and `decryptData` functions exist in `encryption.service.ts`. If not, implement them or store data unencrypted for MVP.

2. **Anthropic SDK**: Ensure the Anthropic SDK is properly configured with the API key from environment variables.

3. **Error Handling**: Each agent should handle errors gracefully. If one agent fails, the entire report generation fails and should be logged.

4. **Token Tracking**: Consider adding token tracking by inspecting the Anthropic response's `usage` field.

5. **Timeouts**: Add timeouts to Claude API calls to prevent hanging. Consider a 60-second timeout per agent.

6. **Rate Limiting**: Be mindful of Anthropic API rate limits. The Director prompt is the longest and most expensive.

7. **Testing**: Test with mock data first before using real client data. The Scout can be tested independently with sample query data.
