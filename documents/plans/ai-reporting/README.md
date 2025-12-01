# AI Reporting Implementation Prompts

This folder contains implementation prompts for the Reports feature in Advergent. Each prompt is designed to be self-contained and actionable for AI-assisted development.

## Phase Overview

| Phase | File | Description | Estimated Effort |
|-------|------|-------------|------------------|
| **0** | `phase-0-prerequisites.md` | **Prerequisites: Schema, CSV Upload, Data Validation** | 6-8 hours |
| 1 | `phase-1-reports-tab-ui.md` | Reports Tab UI Infrastructure | 4-6 hours |
| 2 | `phase-2-pdf-generation.md` | PDF Generation with @react-pdf/renderer | 3-4 hours |
| 3 | `phase-3-csv-export.md` | CSV Export + Print Styles | 2-3 hours |
| 4 | `phase-4-multi-agent-system.md` | SEO/SEM Interplay Report (Multi-Agent) | 8-12 hours |
| 5 | `phase-5-polish.md` | Polish and UX Enhancements | 3-4 hours |

**Total Estimated Effort: 26-36 hours**

## Recommended Implementation Order

> **IMPORTANT**: This order is consistent with `/documents/REPORTS_IMPLEMENTATION_PLAN.md`.
> Both documents now describe the same recommended sequence.

### Standard Order (Recommended)

```
Phase 0 → Phase 4 → Phase 1 → Phase 2 → Phase 3 → Phase 5
```

| Phase | Name | Description | Dependencies |
|-------|------|-------------|--------------|
| **0** | Prerequisites | Database schema, CSV upload infrastructure | None |
| **4** | Multi-Agent System | Scout, Researcher, SEM/SEO Agents, Director | Phase 0 |
| **1** | Reports Tab UI | Frontend to display generated reports | Phase 0 (Phase 4 optional - can use mocks) |
| **2** | PDF Generation | `@react-pdf/renderer` for PDF export | Phase 1 |
| **3** | CSV Export | Export recommendations to CSV | Phase 1, Phase 0 (papaparse) |
| **5** | Polish | Regenerate button, history, enhancements | Phases 1-4 |

### Why This Order?

1. **Phase 0 first**: Creates `csv_uploads`, `auction_insights`, and extends `google_ads_queries` with `data_source` column. All other phases depend on this schema.

2. **Phase 4 before Phase 1**: The Reports Tab needs report data to display. Building the backend first means real data flows through the UI immediately.

3. **Phase 1 can use mocks**: If you prefer to validate UI first, Phase 1 includes mock data that simulates a completed report.

### Alternative: UI First with Mock Data

If you want to validate the UI before backend work:

```
Phase 0 → Phase 1 (with mocks) → Phase 4 → Phase 2 → Phase 3 → Phase 5
```

In this flow:
- Phase 1 uses the mock data provided in `phase-1-reports-tab-ui.md`
- Phase 4 replaces mocks with real AI-generated reports
- All other phases remain the same

**Note**: Phase 0 is ALWAYS required first as it sets up the database schema that Phase 4 depends on.

## How to Use These Prompts

Each phase prompt contains:

1. **Objective** - Clear goal for the phase
2. **Prerequisites** - What must be completed first
3. **Context** - Current state and target state
4. **Tasks** - Step-by-step implementation guide with code examples
5. **File Structure** - Summary of files to create/modify
6. **Testing Checklist** - Verification criteria
7. **Notes** - Implementation tips and gotchas

### Using with Claude Code

Copy the entire phase prompt into Claude Code and say:
```
Implement the tasks in this document. Start with Task 1.
```

Claude will work through each task, creating files and making modifications as specified.

### Using with Other AI Tools

The prompts are designed to be tool-agnostic. They include complete code examples that can be copied directly or adapted to your workflow.

## Key Dependencies

### Frontend (apps/web)
- `@react-pdf/renderer` - PDF generation (Phase 2)
- `papaparse` - CSV parsing and export (Phases 0, 3)
- `react-dropzone` - File upload UI (Phase 0)
- `@types/papaparse` - TypeScript types

### Backend (apps/api)
- Anthropic Claude API - AI analysis (Phase 4)
- Drizzle ORM - Database access
- `papaparse` - CSV parsing (Phase 0)
- `multer` - File upload handling (Phase 0)
- Existing encryption service - Data security

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA SOURCES (Phase 0)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────┐         ┌──────────────────┐             │
│   │   Google OAuth   │   OR    │   CSV Upload     │             │
│   │   (API Sync)     │         │   (Manual)       │             │
│   └────────┬─────────┘         └────────┬─────────┘             │
│            │                            │                        │
│            └──────────┬─────────────────┘                        │
│                       ▼                                          │
│            ┌──────────────────┐                                  │
│            │  Normalized Data │                                  │
│            │  + Auction       │                                  │
│            │    Insights      │                                  │
│            └────────┬─────────┘                                  │
│                     ▼                                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         USER FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Client Created → 2. Data Synced/Uploaded → 3. Report Auto-Gen│
│                                                                  │
│  4. User Views Reports Tab → 5. Downloads PDF/CSV               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-AGENT PIPELINE (Phase 4)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Scout (Data Triage)                                            │
│     ↓                                                           │
│  Researcher (Enrich with Auction Insights)                      │
│     ↓                                                           │
│  SEM Agent + SEO Agent (Parallel Analysis)                      │
│     ↓                                                           │
│  Director (Synthesize & Prioritize)                             │
│     ↓                                                           │
│  Store Report + Create Recommendations                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Reference Documents

- `/documents/REPORTS_IMPLEMENTATION_PLAN.md` - Full architectural plan
- `/documents/CSV_UPLOAD_IMPLEMENTATION_PLAN.md` - CSV upload feature plan
- `/apps/api/src/services/analysis-agents/types.ts` - Existing agent types
- `/apps/api/src/db/schema.ts` - Current database schema
- `/sample-data/google-ads/` - Sample Google Ads export files

## Success Metrics

After completing all phases:

### Phase 0 (Prerequisites)
- [ ] `auction_insights` table created and populated from CSV
- [ ] `csv_uploads` table tracks upload history
- [ ] CSV upload UI allows drag-and-drop file upload
- [ ] Date range extracted automatically from filenames
- [ ] Competitor data available for AI analysis

### Phases 1-5 (Reports Feature)
- [ ] Reports tab visible in Client Details page
- [ ] SEO/SEM Interplay Report auto-generates on first client sync
- [ ] Executive summary provides meaningful account health narrative
- [ ] 5-10 prioritized recommendations appear in report
- [ ] Recommendations also appear in Recommendations tab with SEM/SEO badges
- [ ] PDF download generates correctly formatted document
- [ ] CSV export works for recommendations data
- [ ] Loading, empty, and error states handled gracefully
- [ ] Manual "Regenerate Report" button works
- [ ] Report generation completes within 60 seconds
