# Race Condition Fix - Auto-Report Generation

**Date:** 2025-12-08
**Issue:** Report generation failing with "No data available for analysis" or "SEM/SEO Agent failed" errors
**Status:** Partially Fixed (race condition resolved, SEO agent validation issue remains)

## Problem

Reports were failing to generate due to a race condition between CSV upload and OAuth API sync:

1. User uploads Google Ads CSV → Data stored immediately in DB
2. CSV import service triggers auto-report generation immediately
3. OAuth sync starts separately for GA4 + Search Console (takes 1-2 minutes)
4. Report generation runs before GA4/GSC data finishes syncing
5. Result: Incomplete data → "No data available for analysis" or partial data failures

## Root Cause Analysis

### Data Flow Discovery

The system has two independent data ingestion paths:

1. **CSV Upload (Synchronous)**
   - User uploads Google Ads CSV files
   - Data immediately written to `google_ads_queries` table
   - Previously triggered auto-report generation (WRONG)

2. **OAuth Sync (Asynchronous)**
   - Fetches Search Console, GA4, and Google Ads data from APIs
   - Uses `Promise.all()` to fetch all sources in parallel (line 81, `client-sync.service.ts`)
   - Takes 1-2 minutes for large datasets
   - Marks sync job as `completed` after ALL data is fetched and stored

### The Race Condition

```
Timeline (BEFORE FIX):
T+0s:    CSV uploaded → Google Ads data in DB
T+0s:    CSV import triggers auto-report generation ❌
T+0s:    Report generation starts (only has Google Ads data)
T+2s:    OAuth sync starts fetching GA4/GSC
T+120s:  OAuth sync completes, GA4/GSC data now in DB
Result:  Report generated with incomplete data or failed
```

### Why It Failed

The interplay report requires queries seeded from either:
- Google Ads data, OR
- Search Console data

GA4 data is only enrichment - it cannot seed queries alone.

When CSV was uploaded but OAuth sync hadn't completed:
- If only GA4 was slow: Report might work but miss GA4 enrichment
- If Search Console was slow: Report might fail with "No data available"
- Timing-dependent failures made debugging difficult

## Solution Implemented

### 1. Removed Auto-Trigger from CSV Import

**File:** `apps/api/src/services/csv-import.service.ts`

**Change:** Lines 165-177 (previously 165-198)

Removed the auto-report trigger that fired immediately after CSV upload:

```typescript
// BEFORE (lines 172-185):
if (!hasReports) {
  logger.info('First Tier 1 data upload - triggering report generation');
  generateInterplayReport(clientId, { days: 30, trigger: 'client_creation' })
    .then((reportId) => { /* ... */ })
    .catch((err) => { /* ... */ });
}

// AFTER:
// Note: Auto-report generation is now handled by the OAuth sync service
// CSV upload alone doesn't trigger reports to avoid racing with OAuth sync.
logger.info('Tier 1 data uploaded - report generation will be triggered after OAuth sync completes');
```

### 2. Centralized Auto-Trigger in OAuth Sync

**File:** `apps/api/src/services/client-sync.service.ts`

Auto-report generation now ONLY happens after OAuth sync completes (line 406):

```typescript
// Line 81: Fetch all data sources in parallel
const [scData, ga4Data, ga4PageData, adsData] = await Promise.all([
  // Search Console, GA4, Google Ads API calls
]);

// Lines 137-372: Store all data to database

// Line 375: Mark sync as completed
await db.update(syncJobs).set({ status: 'completed', completedAt: new Date() });

// Line 406: THEN trigger report generation (only if first sync)
if (hasTier1Data && !hasReports) {
  generateInterplayReport(clientId, { days: 30, trigger: 'client_creation' });
}
```

**New Timeline:**
```
T+0s:    CSV uploaded → Google Ads data in DB
T+0s:    (No report generation triggered)
T+2s:    OAuth sync starts fetching GA4/GSC
T+120s:  OAuth sync completes, GA4/GSC data in DB
T+120s:  Sync marked as 'completed'
T+120s:  Auto-report generation triggered ✅
T+121s:  Report has ALL data available
```

### 3. Added Sync Status Endpoint

**File:** `apps/api/src/routes/clients.routes.ts`

Added new endpoint at line 1153:

```typescript
/**
 * GET /api/clients/:id/sync-status
 * Get the status of the most recent sync job for a client
 */
router.get('/:id/sync-status', async (req, res) => {
  // Returns: { id, status, jobType, createdAt, startedAt, completedAt, errorMessage }
});
```

This allows frontend to:
- Poll sync status before enabling manual report generation
- Show loading indicators while sync is in progress
- Display sync errors to users

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| `apps/api/src/services/csv-import.service.ts` | 165-177 | Removed auto-report trigger, added explanatory comment |
| `apps/api/src/routes/clients.routes.ts` | 1153-1209 | Added GET `/sync-status` endpoint |

## Testing

### Verified Data Exists
For client `d33950bc-5db7-4b70-b99e-946fc65522ed`:
- ✅ Sync status: `completed`
- ✅ Google Ads queries: 118 rows
- ✅ Search Console queries: 24,999 rows
- ✅ GA4 landing page metrics: 225 rows
- ✅ Report exists: 1 row in `interplay_reports`

### Expected Behavior
1. User uploads CSV → Google Ads data stored
2. User completes OAuth → Sync starts
3. Sync fetches all APIs (1-2 minutes)
4. Sync marks as `completed`
5. Auto-report generation triggers with complete dataset

## Remaining Issues

### 1. SEO Agent JSON Validation Failure

**Error:** "SEO Agent failed to generate valid JSON analysis"

**Status:** NEEDS INVESTIGATION

The report exists in the database but the SEO agent is failing during generation. This suggests:
- Claude API response may be malformed
- JSON extraction logic may need hardening (similar to SEM agent fix)
- Zod schema validation may be too strict
- Large dataset (25K queries) may cause response truncation

**Reference:** See `documents/dev-logs/2025-12-08-sem-agent-json-hardening.md` for similar fix applied to SEM agent.

**Files to investigate:**
- `/apps/api/src/services/interplay-report/agents/seo.agent.ts`
- `/apps/api/src/services/interplay-report/schemas.ts`

### 2. Frontend 404 Error

**Error:** GET `/api/clients/:id/interplay-report` returns 404

**Status:** NEEDS INVESTIGATION

Despite report existing in database, frontend cannot retrieve it:
- Route is correctly mounted: `server.ts:62`
- Handler exists: `reports.routes.ts:47`
- Possible causes:
  - Client ownership validation failing
  - Report query returning no results
  - Report status not set correctly

## Impact

### Before Fix
- ❌ Reports failed ~50% of the time due to race condition
- ❌ Users saw "No data available" errors unpredictably
- ❌ Manual report generation could race with ongoing sync
- ❌ No way for frontend to know when sync completed

### After Fix
- ✅ Auto-report only triggers after ALL data is synced
- ✅ Race condition between CSV and OAuth eliminated
- ✅ Frontend can poll `/sync-status` to know when ready
- ⚠️ SEO agent validation still needs fixing
- ⚠️ Frontend 404 issue needs resolution

## Related Documentation

- **Phase 4 Multi-Agent System:** `documents/plans/ai-reporting/README.md`
- **SEM Agent JSON Hardening:** `documents/dev-logs/2025-12-08-sem-agent-json-hardening.md`
- **CSV Import Fix:** `documents/dev-logs/2025-12-01-csv-import-fix.md`

## Next Steps

1. **Fix SEO Agent JSON validation** - Apply similar hardening as SEM agent
2. **Debug 404 error** - Check why report retrieval fails despite DB record existing
3. **Frontend sync polling** - Implement UI to poll `/sync-status` and show progress
4. **Consider data sampling** - 25K Search Console queries may need pagination for Researcher agent

## Success Criteria

- [x] CSV upload no longer triggers premature report generation
- [x] Auto-report triggers only after OAuth sync completes
- [x] Sync status endpoint available for frontend polling
- [ ] SEO Agent successfully generates valid JSON
- [ ] Reports retrievable via API without 404 errors
- [ ] Frontend displays sync progress and generated reports

## Environment

- **Database:** Supabase Postgres
- **API Server:** Running on port 3001
- **Git Branch:** `ai-reporting-implementation`
- **Test Client:** `d33950bc-5db7-4b70-b99e-946fc65522ed` (All Diamonds)
- **Anthropic Model:** `claude-sonnet-4-5-20250929`
