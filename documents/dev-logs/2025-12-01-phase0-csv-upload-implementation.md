# Phase 0: CSV Upload Infrastructure Implementation

**Date:** 2025-12-01
**Phase:** 0 - Prerequisites and Foundation
**Status:** Complete

## Overview

Implemented the database schema and CSV upload infrastructure for the AI Reporting system. This phase establishes the data foundation that all other phases depend on.

## Changes Made

### Database Schema (`apps/api/src/db/schema.ts`)

#### New Enum
- `dataSourceEnum` - Values: `'api'`, `'csv_upload'` to distinguish data origin

#### Extended Table: `googleAdsQueries`
Added columns for CSV-imported keyword data:
- `dataSource` - Tracks whether data came from API or CSV upload
- `matchType` - Keyword match type (Phrase, Exact, Broad)
- `criterionStatus` - Keyword status (Enabled, Paused, Removed)
- `campaignStatus` - Campaign status
- `adGroupStatus` - Ad group status
- `dateRangeStart` / `dateRangeEnd` - For aggregated CSV data without single dates

#### New Tables

1. **`csvUploads`** - Tracks upload sessions
   - `uploadSessionId` - Groups files from same upload
   - `fileName`, `fileType`, `fileSize`, `rowCount`
   - `dateRangeStart`, `dateRangeEnd`
   - `status` - processing/completed/failed/skipped
   - `uploadedBy` - User reference

2. **`auctionInsights`** - Tier 1 competitor data
   - Supports keyword-level granularity (campaign, ad_group, keyword columns)
   - Core metrics: `impressionShare`, `lostImpressionShareRank`, `lostImpressionShareBudget`
   - Additional metrics: `outrankingShare`, `overlapRate`, `topOfPageRate`, `positionAboveRate`, `absTopOfPageRate`
   - `impressionShareBelowThreshold` flag for "< 10%" values

3. **`campaignMetrics`** - Tier 2 campaign data
   - Campaign name, group, status
   - Impressions, clicks, cost, CTR

4. **`deviceMetrics`** - Tier 2 device data
   - Device type breakdown
   - Impressions, clicks, cost

5. **`dailyAccountMetrics`** - Tier 2 time series
   - Daily metrics with unique constraint on (clientAccountId, date)
   - Supports upsert for updates

### Migration
- Generated: `drizzle/0008_sour_phalanx.sql`
- Applied successfully to database

### Backend Implementation

#### Utilities Created

1. **`apps/api/src/utils/csv-file-detector.ts`**
   - `detectGoogleAdsReportType()` - Identifies report type from filename pattern
   - `parseDateRangeFromFilename()` - Extracts date range from filename
   - Tiered classification: Tier 1 (essential), Tier 2 (contextual), Tier 3 (skip)

2. **`apps/api/src/utils/csv-column-mapper.ts`**
   - Column mappings for each report type
   - Utility functions:
     - `parseCurrency()` / `parseCurrencyToMicros()` - Currency parsing
     - `parsePercentage()` - Percentage parsing with "< X%" handling
     - `parseDate()` - Multi-format date parsing
     - `parseInteger()` - Integer with comma separators
     - `isBelowThreshold()` - Detects "< 10%" type values

#### Service Created

**`apps/api/src/services/csv-import.service.ts`**
- `processUploadSession()` - Main entry point for multi-file uploads
- Tier 1 importers:
  - `importGoogleAdsSearches()` - Search terms CSV
  - `importGoogleAdsKeywords()` - Keywords CSV with match types
  - `importAuctionInsights()` - Competitor data
- Tier 2 importers:
  - `importCampaigns()` - Campaign metrics
  - `importDevices()` - Device metrics
  - `importTimeSeries()` - Daily trends

#### Routes Created

**`apps/api/src/routes/csv-upload.routes.ts`**
- `POST /api/clients/:clientId/csv-upload` - Upload multiple CSV files
- `GET /api/clients/:clientId/csv-uploads` - Get upload history
- `GET /api/clients/:clientId/csv-uploads/:sessionId` - Get session details

Registered in `server.ts` under `/api/clients` path.

### Frontend Implementation

**`apps/web/src/components/upload/CSVUploadZone.tsx`**
- Drag-and-drop interface using react-dropzone
- Upload progress indicator
- Results display showing:
  - Imported files with row counts
  - Skipped files with reasons
  - Failed files with errors
  - Date range
- Instructions for exporting from Google Ads

### Dependencies Added

#### Backend (`apps/api`)
- `papaparse` - CSV parsing
- `multer` - File upload handling
- `@types/papaparse` - TypeScript types
- `@types/multer` - TypeScript types

#### Frontend (`apps/web`)
- `react-dropzone` - Drag-and-drop file upload

## File Detection Patterns

| Pattern | Type | Tier | Action |
|---------|------|------|--------|
| `Searches(Search_*.csv` | google_ads_searches | 1 | Store |
| `Search_keywords(*.csv` | google_ads_keywords | 1 | Store |
| `Auction_insights(Compare_*.csv` | auction_insights | 1 | Store |
| `Campaigns(*.csv` | campaigns | 2 | Store |
| `Devices(*.csv` | devices | 2 | Store |
| `Time_series(*.csv` | time_series | 2 | Store |
| `Searches(Word_*.csv` | skip | 3 | Skip |
| `Demographics(*.csv` | skip | 3 | Skip |
| `Day_&_hour(*.csv` | skip | 3 | Skip |
| Others | skip | 3 | Skip |

## Testing Notes

- TypeScript compilation passes for both `apps/api` and `apps/web`
- Database migration applied successfully
- Dev server running without errors
- Sample data available in `sample-data/google-ads/` for testing

## Phase 0 Review Fixes (2025-12-01)

Applied fixes identified during architecture review to align implementation with spec requirements.

### Issue 1: Auction Insights Missing Keyword-Level Columns (Fixed)

**Problem:** The `importAuctionInsights()` function only populated account-level metrics, ignoring keyword-level columns that exist in the schema.

**Fix Applied:**
1. Updated `AUCTION_INSIGHTS_COLUMNS` in `csv-column-mapper.ts` to include:
   - `Campaign Name` / `Campaign` → `campaignName`
   - `Ad Group Name` / `Ad Group` → `adGroupName`
   - `Keyword` → `keyword`
   - `Match type` / `Match Type` → `keywordMatchType`
   - `Search lost IS (rank)` → `lostImpressionShareRank`
   - `Search lost IS (budget)` → `lostImpressionShareBudget`

2. Updated `importAuctionInsights()` in `csv-import.service.ts` to extract and store:
   - `campaignName`, `adGroupName`, `keyword`, `keywordMatchType`
   - `lostImpressionShareRank`, `lostImpressionShareBudget`

**Impact:** Researcher agent's `fetchKeywordCompetitiveMetrics` will now find keyword-specific rows when users upload keyword-level auction insights exports.

### Issue 2: CSV Uploads Don't Trigger Report Generation (Stub Added)

**Problem:** `processUploadSession()` returned results but never triggered report generation. Per Phase 4 spec, CSV uploads should auto-trigger reports.

**Fix Applied:**
- Added Tier 1 data detection at end of `processUploadSession()` in `csv-import.service.ts`
- Logs "Tier 1 data uploaded - report generation eligible" when google_ads_searches, google_ads_keywords, or auction_insights files are imported
- TODO comment marks where `triggerReportGeneration()` will be called when Phase 4 is implemented

### Issue 3: Upload Session API Cross-Client Data Leakage (Security Fix)

**Problem:** `GET /api/clients/:clientId/csv-uploads/:sessionId` only filtered by `uploadSessionId`, allowing cross-client data access.

**Fix Applied:**
- Updated query in `csv-upload.routes.ts` to filter by BOTH `uploadSessionId` AND `clientAccountId`
- Prevents agency users from accessing upload sessions belonging to other clients

### Files Modified
- `apps/api/src/utils/csv-column-mapper.ts` - Added keyword-level column mappings
- `apps/api/src/services/csv-import.service.ts` - Updated auction insights importer, added Tier 1 trigger stub
- `apps/api/src/routes/csv-upload.routes.ts` - Fixed security issue with client ID filtering

### Verification
- TypeScript compilation passes
- All three issues addressed per spec requirements

## Next Steps

Per the implementation plan, the recommended order is:
```
Phase 0 (done) -> Phase 4 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 5
```

Phase 4 (Multi-Agent System) should be implemented next as it uses the data structures created here.
