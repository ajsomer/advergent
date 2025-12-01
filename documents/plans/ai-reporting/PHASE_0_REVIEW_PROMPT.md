# Phase 0 Review and Fix Implementation Prompt

Use this prompt to guide an AI agent through reviewing and fixing Phase 0 implementation issues.

---

## Prompt

```
You are reviewing and fixing Phase 0 (Prerequisites) of the Advergent AI Reporting system. Three issues have been identified that need to be addressed to bring the implementation in line with the architecture spec.

## Reference Documents

Before making changes, review these specification documents:

1. **Phase 0 Spec**: `documents/plans/ai-reporting/phase-0-prerequisites.md`
   - Contains the database schema requirements including keyword-level auction insights columns
   - See Part 3: Database Schema, specifically the `auction_insights` table definition

2. **Phase 4 Spec**: `documents/plans/ai-reporting/phase-4-multi-agent-system.md`
   - Lines 2008-2056 describe the auto-trigger requirement for CSV uploads
   - The Researcher agent's `fetchKeywordCompetitiveMetrics` function expects keyword-level data

3. **Master Plan**: `documents/REPORTS_IMPLEMENTATION_PLAN.md`
   - Overall architecture and how phases connect

4. **Dev Log**: `documents/dev-logs/2025-12-01-phase0-csv-upload-implementation.md`
   - Documents what was implemented in Phase 0

## Issues to Fix

### Issue 1: Auction Insights Missing Keyword-Level Columns

**Location**: `apps/api/src/services/csv-import.service.ts` (lines ~339-386)

**Problem**: The `importAuctionInsights()` function only populates:
- `competitorDomain`
- `impressionShare`, `outrankingShare`, `overlapRate`, `topOfPageRate`, `positionAboveRate`, `absTopOfPageRate`
- `impressionShareBelowThreshold`

**Missing columns that exist in schema but are never populated**:
- `campaignName`
- `adGroupName`
- `keyword`
- `keywordMatchType`
- `lostImpressionShareRank`
- `lostImpressionShareBudget`

**Impact**: Every auction insights record is account-level only. The Researcher agent's `fetchKeywordCompetitiveMetrics` will never find keyword-specific rows and will always fall back to less accurate account aggregates.

**Fix Required**:
1. Update the `AUCTION_INSIGHTS_COLUMNS` mapping in `apps/api/src/utils/csv-column-mapper.ts` to include:
   - Campaign Name / Campaign → campaignName
   - Ad Group Name / Ad Group → adGroupName
   - Keyword → keyword
   - Match type / Match Type → keywordMatchType
   - Search lost IS (rank) → lostImpressionShareRank
   - Search lost IS (budget) → lostImpressionShareBudget

2. Update `importAuctionInsights()` in `apps/api/src/services/csv-import.service.ts` to:
   - Extract these fields from the parsed CSV row
   - Include them in the `db.insert(auctionInsights).values({...})` call

**Note**: Google Ads Auction Insights CSV exports include these columns when exported at keyword level. Account-level exports won't have them (they'll be empty), which is fine - the schema allows nulls.

### Issue 2: CSV Uploads Don't Trigger Report Generation

**Location**: `apps/api/src/services/csv-import.service.ts` (lines ~79-160)

**Problem**: `processUploadSession()` loops through files and returns a summary, but never triggers report generation. The Phase 4 spec requires CSV uploads to auto-trigger `generateInterplayReport` the first time data exists so users without OAuth data aren't blocked.

**Reference**: `documents/plans/ai-reporting/phase-4-multi-agent-system.md` lines 2008-2056

**Fix Required**:
1. After successful file processing in `processUploadSession()`, check if:
   - Any Tier 1 files (google_ads_searches, google_ads_keywords, auction_insights) were imported
   - This is the first data upload for this client (no existing reports)

2. If conditions are met, trigger report generation asynchronously (fire-and-forget pattern similar to manual sync in `clients.routes.ts`)

3. Implementation options:
   - Import and call the report generation service (when Phase 4 is implemented)
   - For now, add a TODO comment or stub function that can be connected later
   - Consider adding a `shouldTriggerReport` flag to the return type

**Suggested approach for now** (Phase 4 not yet implemented):
```typescript
// At end of processUploadSession, after the loop:
const hasTier1Data = result.imported.some(f =>
  ['google_ads_searches', 'google_ads_keywords', 'auction_insights'].includes(f.fileType)
);

if (hasTier1Data) {
  // TODO: Phase 4 - Trigger report generation
  // await triggerReportGeneration(clientAccountId);
  logger.info({ clientAccountId, sessionId }, 'Tier 1 data uploaded - report generation eligible');
}
```

### Issue 3: Upload Session API Cross-Client Data Leakage

**Location**: `apps/api/src/routes/csv-upload.routes.ts` (lines ~130-156)

**Problem**: The `GET /api/clients/:clientId/csv-uploads/:sessionId` endpoint:
1. Validates that `clientId` belongs to the caller's agency ✓
2. But then queries `csvUploads` only by `uploadSessionId`, ignoring `clientId`

**Security Issue**: An agency user with multiple clients could supply a session ID from another client and retrieve those files, despite the URL containing a different `:clientId`.

**Fix Required**:
Update the query to filter on BOTH `uploadSessionId` AND `clientAccountId`:

```typescript
const uploads = await db
  .select()
  .from(csvUploads)
  .where(
    and(
      eq(csvUploads.uploadSessionId, sessionId),
      eq(csvUploads.clientAccountId, clientId)  // ADD THIS
    )
  )
  .orderBy(csvUploads.fileName);
```

## Implementation Order

1. **Fix Issue 3 first** - It's the simplest and addresses a security concern
2. **Fix Issue 1 second** - Update column mapper and importer
3. **Fix Issue 2 last** - Add the trigger stub/TODO (full implementation depends on Phase 4)

## Testing

After fixes:
1. Verify the security fix by attempting to access a session from a different client
2. Test auction insights import with a keyword-level CSV export (if available)
3. Check logs for the "report generation eligible" message after uploading Tier 1 data

## Success Criteria

- [ ] `GET /api/clients/:clientId/csv-uploads/:sessionId` filters by both sessionId AND clientId
- [ ] Auction insights importer extracts and stores keyword-level columns when present
- [ ] `processUploadSession` logs when Tier 1 data is uploaded (trigger stub in place)
- [ ] TypeScript compilation passes
- [ ] Update dev log with fixes applied
```

---

## Usage

Copy the prompt above and provide it to an AI coding agent. The agent should have read access to the specification files and write access to implement the fixes.
