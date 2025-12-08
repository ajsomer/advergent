# Dev Log: CSV Import Fix & Report Generation Investigation

**Date:** 2025-12-01
**Branch:** `ai-reporting-implementation`

---

## Summary

Fixed a critical bug in CSV import that caused 0 rows to be imported for most file types. Also investigated (but not yet resolved) an issue with the SEM Agent failing to generate valid JSON during report generation.

---

## Issue 1: CSV Import Showing 0 Rows (RESOLVED)

### Symptoms
When uploading Google Ads CSV files from `sample-data/google-ads/`, the import summary showed:
- Auction Insights: 0 rows
- Campaigns: 0 rows
- Keywords: 0 rows
- Search Terms: 0 rows
- Devices: 4 rows ✓
- Daily Trends: 30 rows ✓

Only Devices and Daily Trends were importing data correctly.

### Root Cause
The `normalizeColumnName` function in `apps/api/src/utils/csv-column-mapper.ts` was **not idempotent**.

PapaParse's `transformHeader` callback was being invoked multiple times on the same header value. On the first pass:
- `"Search"` → `"queryText"` ✓

On the second pass:
- `"queryText"` → `"querytext"` (lowercase, because it wasn't in the mapping)

This caused the importers to look for `row.queryText` but only find `row.querytext`, causing all rows to be skipped via `if (!row.queryText) continue;`.

Devices and Daily Trends worked because their mapped field names (`device`, `date`, `clicks`, etc.) are already lowercase, so re-normalization had no effect.

### Fix
Made `normalizeColumnName` idempotent by checking if the header is already a mapping target value before applying any transformation:

```typescript
export function normalizeColumnName(header: string, mapping: ColumnMapping): string {
  const trimmed = header.trim();

  // Check if header is already a mapping target (idempotency check)
  // This handles the case where PapaParse calls transformHeader twice
  const mappingTargets = new Set(Object.values(mapping));
  if (mappingTargets.has(trimmed)) {
    return trimmed;
  }

  return mapping[trimmed] || trimmed.toLowerCase().replace(/\s+/g, '_');
}
```

### Result
After fix:
- Search Terms: 100 rows ✓
- Keywords: 30 rows ✓
- Auction Insights: 9 rows ✓
- Campaigns: 4 rows ✓
- Devices: 4 rows ✓
- Daily Trends: 30 rows ✓

**File changed:** `apps/api/src/utils/csv-column-mapper.ts:108-124`

---

## Issue 2: OAuth Session Expiration (Known Behavior)

### Symptoms
400 Bad Request errors on `/api/google/accounts/:clientId`, `/api/google/properties/:clientId`, and `/api/google/ga4-properties/:clientId` endpoints.

### Root Cause
The temporary OAuth session store (`apps/api/src/utils/temp-oauth-store.ts`) uses in-memory storage with a 10-minute TTL. Sessions are lost when:
1. The server restarts (tsx watch reloads on file changes)
2. More than 10 minutes pass between OAuth callback and account selection

### Current Behavior
This is expected behavior. The UI already handles this with error messages prompting users to restart the OAuth flow.

### Future Improvement
Consider using Redis-backed storage (Upstash) for production to persist sessions across server restarts.

---

## Issue 3: SEM Agent JSON Validation Failure (IN PROGRESS)

### Symptoms
Report generation fails with: `SEM Agent failed to generate valid JSON analysis`

### Investigation
The SEM Agent (`apps/api/src/services/interplay-report/agents/sem.agent.ts`) calls `callGenericAI()` and then validates the response against `semAgentOutputSchema`:

```typescript
const response = await callGenericAI(prompt);
const parsed = JSON.parse(response);
const validated = semAgentOutputSchema.parse(parsed);
```

The schema requires:
```typescript
semAgentOutputSchema = z.object({
  semActions: z.array(semActionSchema).min(1).max(15),  // Note: .min(1) requires at least 1 action
});
```

### Possible Causes
1. AI returns invalid JSON (markdown-wrapped, syntax errors)
2. AI returns valid JSON but fails Zod validation (wrong field names, wrong types)
3. AI returns empty `semActions` array (fails `.min(1)` constraint)
4. The error logging doesn't capture the actual AI response for debugging

### Next Steps
1. Add detailed logging to capture the raw AI response before JSON parsing
2. Consider making `semActions` allow empty array (`.min(0)`) for edge cases
3. Add better error messages that include which validation step failed

---

## Files Modified

1. `apps/api/src/utils/csv-column-mapper.ts` - Fixed idempotency issue in `normalizeColumnName`

---

## Testing Notes

To reproduce the CSV import fix:
1. Delete existing client data
2. Create new client via onboarding
3. Upload all CSVs from `sample-data/google-ads/`
4. Verify row counts match file contents

To reproduce the SEM Agent issue:
1. Complete CSV upload for a new client
2. Trigger report generation (happens automatically on first Tier 1 data upload)
3. Check server logs for `SEM Agent: Failed to generate valid analysis`
