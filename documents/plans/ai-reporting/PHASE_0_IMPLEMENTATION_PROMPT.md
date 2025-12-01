# Phase 0 Implementation Prompt

Use this prompt to guide an AI agent through implementing Phase 0 (Prerequisites) of the AI Reporting system.

---

## Prompt

```
You are implementing Phase 0 (Prerequisites) of the Advergent AI Reporting system. This phase establishes the database schema and CSV upload infrastructure that all other phases depend on.

## Your Task

Implement Phase 0 by following the detailed specification in:
`documents/plans/ai-reporting/phase-0-prerequisites.md`

## Key Deliverables

1. **Database Migration** - Create a new Drizzle migration with:
   - `csv_uploads` table (track upload sessions)
   - `auction_insights` table (competitor data with keyword-level support)
   - `campaign_metrics` table
   - `device_metrics` table
   - `daily_account_metrics` table
   - Extend `google_ads_queries` with `data_source`, `match_type`, etc.

2. **Backend CSV Infrastructure**:
   - Install dependencies: `papaparse`, `multer`
   - Create `apps/api/src/services/csv-import.service.ts`
   - Create `apps/api/src/services/csv-parsers/` directory with parsers for:
     - Search Terms CSV
     - Keywords CSV
     - Auction Insights CSV (with keyword-level support)
   - Create `apps/api/src/routes/csv-upload.routes.ts`
   - File type detection based on column headers

3. **Frontend Upload Component**:
   - Install dependencies: `react-dropzone`, `papaparse`
   - Create `apps/web/src/components/clients/CSVUploadZone.tsx`
   - Drag-and-drop with file type icons
   - Upload progress and validation feedback

## Important Implementation Notes

### Auction Insights Schema
The `auction_insights` table MUST support keyword-level data for accurate per-keyword competitive analysis:
- Include `campaign_name`, `ad_group_name`, `keyword`, `keyword_match_type` columns
- Include `lost_impression_share_rank` and `lost_impression_share_budget` columns
- The Researcher agent (Phase 4) will query this table by keyword

### Data Source Tracking
All imported data must have `data_source = 'csv_upload'` to distinguish from OAuth API data.

### File Type Detection
Detect CSV type by examining column headers:
- "Search term" → Search Terms report
- "Keyword" (without "Search term") → Keywords report
- "Display URL domain" → Auction Insights report

## Reference Files

- Phase 0 spec: `documents/plans/ai-reporting/phase-0-prerequisites.md`
- Master plan: `documents/REPORTS_IMPLEMENTATION_PLAN.md`
- Sample CSV data: `sample-data/google-ads/`
- Existing schema: `apps/api/src/db/schema.ts`

## Implementation Order

1. Create and run database migration
2. Update Drizzle schema.ts with new tables
3. Create CSV parsers (start with Search Terms, then Auction Insights)
4. Create csv-import.service.ts
5. Create csv-upload.routes.ts
6. Register routes in server.ts
7. Create frontend CSVUploadZone component
8. Test with sample data from `sample-data/google-ads/`

## Success Criteria

After Phase 0 is complete:
- [ ] Database migration runs without errors
- [ ] All new tables created with correct columns
- [ ] `data_source` column added to `google_ads_queries`
- [ ] CSV upload endpoint accepts files at POST /api/clients/:id/csv-upload
- [ ] Search Terms CSV imports correctly
- [ ] Auction Insights CSV imports with keyword-level data
- [ ] Frontend shows drag-and-drop zone with progress
- [ ] Uploaded data visible in database with `data_source = 'csv_upload'`

## After Completion

Once Phase 0 is complete, proceed to Phase 4 (Multi-Agent System) which depends on this infrastructure.

The recommended implementation order is:
Phase 0 → Phase 4 → Phase 1 → Phase 2 → Phase 3 → Phase 5
```

---

## Usage

Copy the prompt above and provide it to an AI coding agent along with access to this codebase. The agent should have read access to the specification files and write access to implement the changes.
