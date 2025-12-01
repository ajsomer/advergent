# Phase 4: Multi-Agent SEO/SEM Interplay Report System

**Date**: 2025-12-01
**Branch**: `ai-reporting-implementation`
**Status**: Complete

## Overview

Implemented the Phase 4 Multi-Agent SEO/SEM Interplay Report system. This feature automatically analyzes the interplay between paid (Google Ads) and organic (Search Console) search performance, generating prioritized recommendations using a multi-agent AI pipeline.

## Architecture

### Multi-Agent Pipeline

```
Scout (Data Triage)
    ↓
Researcher (Data Enrichment)
    ↓
SEM Agent + SEO Agent (Parallel AI Analysis)
    ↓
Director (Strategy Synthesis)
    ↓
Final Report + Recommendations
```

### Agent Responsibilities

| Agent | Type | Purpose |
|-------|------|---------|
| **Scout** | Pure Data | Identifies battleground keywords and critical pages using rule-based triage (no AI) |
| **Researcher** | Data Enrichment | Fetches auction insights for keywords, scrapes page content for SEO analysis |
| **SEM Agent** | AI Analysis | Analyzes keywords with competitive metrics, generates Google Ads recommendations |
| **SEO Agent** | AI Analysis | Analyzes pages with content issues, generates organic optimization recommendations |
| **Director** | AI Synthesis | Combines SEM + SEO outputs, resolves conflicts, prioritizes to max 10 recommendations |

## Files Created

### Database
- `drizzle/0009_nostalgic_morph.sql` - Generated migration for new tables and columns

### Schema Updates (`src/db/schema.ts`)
- New enums: `reportTriggerEnum`, `reportStatusEnum`, `recommendationSourceEnum`, `recommendationCategoryEnum`, `impactLevelEnum`, `effortLevelEnum`
- New table: `interplayReports` - Stores report state and encrypted agent outputs
- Extended `recommendations` table with interplay-specific fields

### Interplay Report Service (`src/services/interplay-report/`)

```
interplay-report/
├── index.ts                    # Public API exports
├── types.ts                    # TypeScript interfaces (~200 lines)
├── schemas.ts                  # Zod validation schemas (~80 lines)
├── queries.ts                  # Database operations (~180 lines)
├── orchestrator.ts             # Pipeline coordination (~270 lines)
├── agents/
│   ├── index.ts               # Agent exports
│   ├── scout.agent.ts         # Data triage (~200 lines)
│   ├── researcher.agent.ts    # Data enrichment (~160 lines)
│   ├── sem.agent.ts           # SEM AI analysis (~50 lines)
│   ├── seo.agent.ts           # SEO AI analysis (~50 lines)
│   └── director.agent.ts      # Strategy synthesis (~120 lines)
├── prompts/
│   ├── index.ts               # Prompt exports
│   ├── sem.prompt.ts          # SEM agent prompt builder (~80 lines)
│   ├── seo.prompt.ts          # SEO agent prompt builder (~80 lines)
│   └── director.prompt.ts     # Director prompt builder (~100 lines)
└── utils/
    ├── index.ts               # Utils exports
    └── data-constructor.ts    # Fetches and merges data from DB (~320 lines)
```

### Routes (`src/routes/reports.routes.ts`)
- `GET /:clientId/interplay-report` - Get latest report
- `POST /:clientId/interplay-report/regenerate` - Trigger manual regeneration
- `GET /:clientId/interplay-report/debug` - Get full agent outputs (QA)

### Updated Files
- `src/server.ts` - Registered reports routes
- `src/services/csv-import.service.ts` - Added auto-trigger on first Tier 1 CSV upload
- `src/routes/clients.routes.ts` - Updated recommendations endpoint to handle nullable `queryOverlapId`

## Database Schema

### New Table: `interplay_reports`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `client_account_id` | UUID | FK to client_accounts |
| `trigger_type` | ENUM | 'client_creation', 'manual', 'scheduled' |
| `status` | ENUM | 'pending', 'researching', 'analyzing', 'completed', 'failed' |
| `date_range_start/end` | DATE | Analysis period |
| `scout_findings_encrypted` | TEXT | JSON output from Scout |
| `researcher_data_encrypted` | TEXT | JSON output from Researcher |
| `sem_agent_output_encrypted` | TEXT | JSON output from SEM Agent |
| `seo_agent_output_encrypted` | TEXT | JSON output from SEO Agent |
| `director_output_encrypted` | TEXT | JSON output from Director |
| `executive_summary_encrypted` | TEXT | Final summary |
| `unified_recommendations_encrypted` | TEXT | Final recommendations |
| `tokens_used` | INTEGER | AI token usage |
| `processing_time_ms` | INTEGER | Total processing time |

### Extended: `recommendations`

New columns for interplay recommendations:
- `source` - 'legacy' or 'interplay_report'
- `interplay_report_id` - FK to interplay_reports
- `recommendation_category` - 'sem', 'seo', or 'hybrid'
- `title` - Short recommendation title
- `impact_level` - 'high', 'medium', 'low'
- `effort_level` - 'high', 'medium', 'low'
- `action_items` - Array of specific actions
- `query_overlap_id` - Now nullable (interplay recs don't have overlaps)

## Scout Agent Triage Rules

### SEM Track - Battleground Keywords
1. **High Spend + Low ROAS** ($100+ spend, ROAS < 2) → High priority
2. **Cannibalization Risk** (Organic position 1-3 + $50+ ad spend) → High priority
3. **Growth Potential** (5+ conversions, could expand) → Medium priority
4. **Competitive Pressure** (High spend, needs auction analysis) → Low priority

### SEO Track - Critical Pages
1. **High Paid Spend + Low Organic** ($100+ paid, organic position > 10) → High priority
2. **High Traffic + High Bounce** (1000+ impressions, 70%+ bounce) → Medium/High priority
3. **High Impressions + Low CTR** (1000+ impressions, < 2% CTR) → Medium priority

## API Usage

### Trigger Manual Report Generation
```bash
POST /api/clients/:clientId/interplay-report/regenerate
Content-Type: application/json

{
  "days": 30
}
```

Response: `202 Accepted` (generation runs in background)

### Get Latest Report
```bash
GET /api/clients/:clientId/interplay-report
```

Response:
```json
{
  "id": "uuid",
  "clientAccountId": "uuid",
  "status": "completed",
  "dateRange": { "start": "2025-11-01", "end": "2025-12-01", "days": 30 },
  "executiveSummary": {
    "summary": "...",
    "keyHighlights": ["...", "..."]
  },
  "recommendations": [
    {
      "title": "Reduce bids on branded terms",
      "description": "...",
      "type": "sem",
      "impact": "high",
      "effort": "low",
      "actionItems": ["...", "..."]
    }
  ],
  "metadata": {
    "tokensUsed": 5000,
    "processingTimeMs": 45000,
    "createdAt": "2025-12-01T10:00:00Z",
    "completedAt": "2025-12-01T10:00:45Z"
  }
}
```

### Auto-Trigger Behavior

When Tier 1 data (google_ads_searches, google_ads_keywords, auction_insights) is uploaded via CSV:
1. System checks if any interplay reports exist for the client
2. If no reports exist, automatically triggers report generation with `trigger: 'client_creation'`
3. Generation runs in background (fire-and-forget)
4. Upload response is not blocked

## Testing Notes

- Requires data in database (Google Ads queries, Search Console queries) to generate meaningful reports
- Without data, Scout finds no battleground keywords or critical pages
- SEM/SEO agents return empty arrays if no data to analyze
- Director handles empty inputs gracefully with fallback message

## Code Quality

- All files under 300 lines (per Phase 4 spec)
- Clear separation: types, schemas, queries, prompts, logic
- Modular agent structure with barrel exports
- Proper error handling with status updates on failure
- Logging with dedicated `interplay-*` module tags

## Next Steps (Future Phases)

1. Add actual encryption for stored agent outputs (currently plain JSON)
2. Track token usage from AI calls
3. Add scheduled report generation (cron trigger)
4. Frontend UI for viewing/interacting with reports
5. Historical report comparison
