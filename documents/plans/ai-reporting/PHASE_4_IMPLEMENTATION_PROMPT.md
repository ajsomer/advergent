# Phase 4: Multi-Agent System Implementation Prompt

Use this prompt to guide an AI agent through implementing Phase 4 (SEO/SEM Interplay Report Multi-Agent System) after Phase 0 is complete.

---

## Prompt

```
You are implementing Phase 4 of the Advergent AI Reporting system - the Multi-Agent SEO/SEM Interplay Report. Phase 0 (Prerequisites) has been completed, providing the database schema and CSV upload infrastructure.

## CRITICAL: Code Organization Principles

Before implementing ANY code, follow these modularization principles:

1. **Maximum File Size**: No single file should exceed ~300 lines. If approaching this limit, split into smaller modules.

2. **Single Responsibility**: Each file should do ONE thing well:
   - Types/interfaces in dedicated `types.ts` files
   - Zod schemas in dedicated `schemas.ts` files
   - Database queries in dedicated `queries.ts` or `repository.ts` files
   - Business logic in service files
   - HTTP handlers in route files

3. **Directory Structure for Agents**: Create a modular structure:
   ```
   src/services/interplay-report/
   ├── index.ts                    # Main orchestrator (exports public API)
   ├── types.ts                    # All TypeScript interfaces
   ├── schemas.ts                  # All Zod validation schemas
   ├── queries.ts                  # Database queries (select, insert, update)
   ├── agents/
   │   ├── index.ts               # Re-exports all agents
   │   ├── scout.agent.ts         # Scout logic (~150 lines max)
   │   ├── researcher.agent.ts    # Researcher logic
   │   ├── sem.agent.ts           # SEM analysis
   │   ├── seo.agent.ts           # SEO analysis
   │   └── director.agent.ts      # Strategy synthesis
   ├── prompts/
   │   ├── sem.prompt.ts          # SEM agent prompt builder
   │   ├── seo.prompt.ts          # SEO agent prompt builder
   │   └── director.prompt.ts     # Director prompt builder
   └── utils/
       ├── data-constructor.ts    # InterplayData construction
       └── filters.ts             # Filtering/sorting utilities
   ```

4. **Import/Export Pattern**: Use barrel exports (`index.ts`) for clean imports:
   ```typescript
   // Good: import from module root
   import { runScout, ScoutFindings } from '@/services/interplay-report/agents';

   // Avoid: deep imports
   import { runScout } from '@/services/interplay-report/agents/scout.agent';
   ```

5. **Separate Concerns**:
   - Prompts are TEXT, not logic - put in separate files
   - Database operations are separate from business logic
   - Validation schemas are separate from types

## Reference Documents

Before implementing, review these specification documents:

1. **Phase 4 Spec**: `documents/plans/ai-reporting/phase-4-multi-agent-system.md`
   - Complete multi-agent architecture
   - Agent responsibilities and data flows
   - Database schema for `interplay_reports` table

2. **Phase 0 Spec**: `documents/plans/ai-reporting/phase-0-prerequisites.md`
   - Database schema that Phase 4 depends on
   - `auction_insights` table structure (keyword-level competitive data)

3. **Existing Code**:
   - `apps/api/src/services/analysis-agents/types.ts` - Existing agent type definitions
   - `apps/api/src/services/ai-analyzer.service.ts` - Existing AI integration patterns
   - `apps/api/src/db/schema.ts` - Current database schema (includes Phase 0 tables)

4. **Dev Log**: `documents/dev-logs/2025-12-01-phase0-csv-upload-implementation.md`
   - Documents Phase 0 implementation and review fixes

## Current State (After Phase 0)

The following already exists:
- `dataSourceEnum` - Values: 'api', 'csv_upload'
- `csvUploads` table - Tracks upload sessions
- `auctionInsights` table - Competitor data with keyword-level columns:
  - `campaignName`, `adGroupName`, `keyword`, `keywordMatchType`
  - `impressionShare`, `lostImpressionShareRank`, `lostImpressionShareBudget`
  - `outrankingShare`, `overlapRate`, `topOfPageRate`, `positionAboveRate`, `absTopOfPageRate`
- `campaignMetrics`, `deviceMetrics`, `dailyAccountMetrics` tables
- Extended `googleAdsQueries` with `dataSource` column
- CSV import service with Tier 1 data trigger stub (logs when report generation is eligible)
- Existing analysis agents: `sem-agent.ts`, `seo-agent.ts`, `strategy-agent.ts`
- `constructInterplayData()` function in `ai-analyzer.service.ts`

## Target State

After Phase 4:
- New `interplay_reports` table storing generated reports
- Extended `recommendations` table for interplay recommendations
- Modular multi-agent pipeline: Scout → Researcher → SEM Agent → SEO Agent → Director
- Auto-trigger report generation after first sync OR first CSV upload
- API endpoints to fetch and regenerate reports
- Scout and Researcher utilize `auction_insights` data for competitive analysis

## Implementation Tasks

### Task 1: Create Database Migration

Create migration file: `apps/api/drizzle/0009_interplay_reports.sql`

```sql
-- Create enums for interplay reports
CREATE TYPE report_trigger AS ENUM ('client_creation', 'manual', 'scheduled');
CREATE TYPE report_status AS ENUM ('pending', 'researching', 'analyzing', 'completed', 'failed');
CREATE TYPE recommendation_source AS ENUM ('legacy', 'interplay_report');
CREATE TYPE recommendation_category AS ENUM ('sem', 'seo', 'hybrid');
CREATE TYPE impact_level AS ENUM ('high', 'medium', 'low');
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

  -- Final output
  executive_summary_encrypted TEXT,
  unified_recommendations_encrypted TEXT,

  -- Metadata
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_interplay_reports_client ON interplay_reports(client_account_id);
CREATE INDEX idx_interplay_reports_status ON interplay_reports(status);
CREATE INDEX idx_interplay_reports_created ON interplay_reports(created_at);

-- Extend recommendations table for interplay reports
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

CREATE INDEX idx_recommendations_interplay_report ON recommendations(interplay_report_id);
CREATE INDEX idx_recommendations_source ON recommendations(source);
```

### Task 2: Update Database Schema (Drizzle)

Update `apps/api/src/db/schema.ts` with new enums and tables. Keep schema changes minimal - just add the new tables and columns.

### Task 3: Create Modular Interplay Report Service

Create the following directory structure:

```
apps/api/src/services/interplay-report/
├── index.ts                    # Public API
├── types.ts                    # TypeScript interfaces
├── schemas.ts                  # Zod schemas
├── queries.ts                  # Database operations
├── orchestrator.ts             # Main pipeline orchestration
├── agents/
│   ├── index.ts
│   ├── scout.agent.ts
│   ├── researcher.agent.ts
│   ├── sem.agent.ts
│   ├── seo.agent.ts
│   └── director.agent.ts
├── prompts/
│   ├── index.ts
│   ├── sem.prompt.ts
│   ├── seo.prompt.ts
│   └── director.prompt.ts
└── utils/
    ├── index.ts
    ├── data-constructor.ts
    └── filters.ts
```

#### 3a. Types File (`types.ts`) - ~100 lines

Define all interfaces:
- `ScoutFindings`, `BattlegroundKeyword`, `CriticalPage`
- `ResearcherData`, `EnrichedKeyword`, `EnrichedPage`, `CompetitiveMetrics`
- `InterplayReportResponse`, `GenerateReportOptions`

#### 3b. Schemas File (`schemas.ts`) - ~80 lines

Define Zod validation schemas for agent outputs. Reuse existing schemas from `analysis-agents/types.ts` where possible.

#### 3c. Queries File (`queries.ts`) - ~100 lines

Database operations:
- `createReport()` - Insert new report record
- `updateReportStatus()` - Update status and phase outputs
- `getLatestReport()` - Fetch most recent report for client
- `createRecommendationsFromReport()` - Insert recommendations

#### 3d. Scout Agent (`agents/scout.agent.ts`) - ~150 lines

The Scout performs data triage (NO AI calls - pure data analysis):

**SEM Track - Battleground Keywords:**
1. High Spend (>$100) + Low ROAS (<2)
2. High Organic Rank (#1-3) + High Ad Spend (>$50) = Cannibalization risk
3. High Conversions (>5) + Low Impression Share (<50%) = Growth potential

**SEO Track - Critical Pages:**
1. High Paid Spend (>$100) + Low Organic Rank (>10)
2. High Organic Traffic + High Bounce Rate (>70%)
3. High Impressions (>1000) + Low CTR (<2%)

Output: `ScoutFindings` with prioritized battleground keywords and critical pages.

#### 3e. Researcher Agent (`agents/researcher.agent.ts`) - ~200 lines

The Researcher enriches Scout findings with additional data:

**SEM Track - Competitive Metrics:**
- Query `auction_insights` table for keyword-level data (Phase 0)
- Fallback to account-level data if keyword-level not available
- Include `dataLevel` field to indicate data granularity

```typescript
// Priority order for competitive metrics:
// 1. Keyword-level auction insights (most accurate)
// 2. Account-level auction insights (fallback)
// 3. Return undefined if no data
```

**SEO Track - Page Content:**
- Fetch live HTML for critical pages
- Extract: word count, H1, title tag, meta description
- 10-second timeout per page

#### 3f. SEM Agent (`agents/sem.agent.ts`) - ~100 lines

Calls Claude to analyze enriched keywords. Import prompt from `prompts/sem.prompt.ts`.

#### 3g. SEO Agent (`agents/seo.agent.ts`) - ~100 lines

Calls Claude to analyze enriched pages. Import prompt from `prompts/seo.prompt.ts`.

#### 3h. Director Agent (`agents/director.agent.ts`) - ~120 lines

Synthesizes SEM and SEO outputs:
- Resolves conflicts between recommendations
- Prioritizes by business impact
- Applies filtering logic (max 10 recommendations)
- Generates executive summary

Import prompt from `prompts/director.prompt.ts`.

#### 3i. Prompt Files (`prompts/*.ts`) - ~150 lines each

Separate files for building prompts:
- `sem.prompt.ts` - `buildSEMPrompt(keywords, context)`
- `seo.prompt.ts` - `buildSEOPrompt(pages, context)`
- `director.prompt.ts` - `buildDirectorPrompt(semAnalysis, seoAnalysis, context)`

This separates the TEXT (prompts) from the LOGIC (agents).

#### 3j. Orchestrator (`orchestrator.ts`) - ~150 lines

Main pipeline coordination:
```typescript
export async function generateInterplayReport(clientId, options) {
  // 1. Create report record (status: pending)
  // 2. Gather data → constructInterplayData()
  // 3. Run Scout (status: researching)
  // 4. Run Researcher
  // 5. Run SEM + SEO agents in parallel (status: analyzing)
  // 6. Run Director
  // 7. Store results + create recommendations (status: completed)
}
```

#### 3k. Public API (`index.ts`) - ~30 lines

Re-export public functions:
```typescript
export { generateInterplayReport, getLatestInterplayReport } from './orchestrator';
export type { InterplayReportResponse, GenerateReportOptions } from './types';
```

### Task 4: Create Reports Routes

Create `apps/api/src/routes/reports.routes.ts` (~80 lines):

- `GET /api/clients/:clientId/interplay-report` - Get latest report
- `POST /api/clients/:clientId/interplay-report/regenerate` - Manual regeneration
- `GET /api/clients/:clientId/interplay-report/debug` - Get full agent outputs (QA)

### Task 5: Update CSV Import Service for Auto-Trigger

Update the Tier 1 trigger stub in `apps/api/src/services/csv-import.service.ts`:

Replace the TODO comment with actual report generation:

```typescript
import { generateInterplayReport } from '@/services/interplay-report';
import { db } from '@/db';
import { interplayReports } from '@/db/schema';
import { eq } from 'drizzle-orm';

// At end of processUploadSession, after Tier 1 check:
if (hasTier1Data) {
  try {
    // Check if this is the first data upload (no existing reports)
    const existingReport = await db
      .select({ id: interplayReports.id })
      .from(interplayReports)
      .where(eq(interplayReports.clientAccountId, clientAccountId))
      .limit(1);

    if (existingReport.length === 0) {
      logger.info({ clientAccountId, sessionId }, 'First Tier 1 data - triggering report generation');
      // Fire-and-forget: don't await, don't block upload response
      generateInterplayReport(clientAccountId, { days: 30, trigger: 'client_creation' })
        .catch(err => logger.error({ err, clientAccountId }, 'Background report generation failed'));
    }
  } catch (error) {
    logger.error({ error, clientAccountId }, 'Failed to check/trigger report generation');
  }
}
```

### Task 6: Register Routes

Update `apps/api/src/server.ts` to register the reports routes.

### Task 7: Update Data Constructor

The existing `constructInterplayData()` in `ai-analyzer.service.ts` may need updates to:
1. Accept a `clientId` parameter instead of raw data arrays
2. Fetch data from database (both API and CSV sources)
3. Include competitive metrics from `auction_insights` table

Consider moving this to `interplay-report/utils/data-constructor.ts`.

## File Size Guidelines

After implementation, verify these approximate line counts:

| File | Max Lines | Purpose |
|------|-----------|---------|
| `types.ts` | ~100 | All interfaces |
| `schemas.ts` | ~80 | Zod validation |
| `queries.ts` | ~100 | Database operations |
| `orchestrator.ts` | ~150 | Pipeline coordination |
| `scout.agent.ts` | ~150 | Data triage logic |
| `researcher.agent.ts` | ~200 | Data enrichment |
| `sem.agent.ts` | ~100 | SEM analysis |
| `seo.agent.ts` | ~100 | SEO analysis |
| `director.agent.ts` | ~120 | Strategy synthesis |
| `sem.prompt.ts` | ~150 | SEM prompt text |
| `seo.prompt.ts` | ~150 | SEO prompt text |
| `director.prompt.ts` | ~150 | Director prompt text |
| `reports.routes.ts` | ~80 | HTTP handlers |

Total: ~1500 lines across 13+ files instead of one massive file.

## Testing Checklist

### Database
- [ ] Migration runs successfully
- [ ] `interplay_reports` table created
- [ ] `recommendations` table has new columns
- [ ] `query_overlap_id` is now nullable

### Scout Agent
- [ ] Identifies battleground keywords with correct criteria
- [ ] Identifies critical pages with correct criteria
- [ ] Deduplication works (same query/page not listed twice)
- [ ] Priority sorting works (high → medium → low)
- [ ] Limits output (max 20 keywords, max 10 pages)

### Researcher Agent
- [ ] Fetches keyword-level auction insights when available
- [ ] Falls back to account-level when keyword-level missing
- [ ] Includes `dataLevel` field in response
- [ ] Fetches page content with timeout handling
- [ ] Gracefully handles fetch failures

### SEM/SEO Agents
- [ ] Generate valid JSON output
- [ ] Output validates against Zod schemas
- [ ] Recommendations are specific and actionable

### Director Agent
- [ ] Synthesizes both agent outputs
- [ ] Executive summary is coherent
- [ ] Filtering limits to 10 recommendations max
- [ ] Impact prioritization works correctly

### Auto-Trigger
- [ ] Report generates after first CSV upload with Tier 1 data
- [ ] Report does NOT generate on subsequent uploads
- [ ] Upload response is not blocked by report generation

### API Endpoints
- [ ] `GET /interplay-report` returns report or 404
- [ ] `POST /interplay-report/regenerate` starts generation
- [ ] `GET /interplay-report/debug` returns all agent outputs

## Implementation Notes

1. **Encryption**: Use existing `encryptData`/`decryptData` from `encryption.service.ts`. If not implemented, store unencrypted for MVP.

2. **Error Handling**: Each agent should catch errors and log them. If one agent fails, the entire report should fail gracefully with error message stored.

3. **Timeouts**: Add 60-second timeout for each Claude API call. The Director is the longest call.

4. **Rate Limiting**: Be mindful of Anthropic rate limits. Consider sequential agent calls if parallel causes issues.

5. **Testing**: Test Scout independently with mock data first. It's the only non-AI agent.

6. **Logging**: Use `logger.child({ module: 'interplay-report' })` for all logging.

## Success Criteria

- [ ] All files under 300 lines
- [ ] Clear separation between types, schemas, queries, logic, and prompts
- [ ] Scout correctly triages data without AI calls
- [ ] Researcher enriches with auction_insights data
- [ ] SEM/SEO/Director agents produce valid JSON
- [ ] Auto-trigger works on first Tier 1 CSV upload
- [ ] API endpoints return expected responses
- [ ] TypeScript compilation passes
- [ ] Dev log updated with Phase 4 implementation notes
```

---

## Usage

Copy the prompt above and provide it to an AI coding agent. The agent should:
1. Create the modular directory structure first
2. Implement types and schemas
3. Implement database queries
4. Implement agents one by one
5. Implement the orchestrator
6. Wire up routes and auto-trigger
7. Test and verify

The modular approach ensures maintainable code that's easy to test and extend.
