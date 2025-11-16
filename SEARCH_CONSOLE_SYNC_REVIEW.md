# Search Console OAuth & Auto-Sync Implementation Review

## Problem Statement

When a user connects their Google Search Console account via OAuth, the system should automatically trigger a data sync to populate the database with Search Console query data. Currently, the OAuth flow completes successfully but no sync is triggered, leaving the database empty even though the user has data in their Search Console account.

## Current Behavior

1. User creates a client (e.g., "Unique Diamonds")
2. User clicks to connect Search Console
3. OAuth flow initiates via `GET /api/google/auth/initiate?clientId={id}&service=search_console`
4. User authenticates with Google and grants permissions
5. Callback handler `GET /api/google/callback` stores the encrypted refresh token in the database
6. ✅ OAuth connection is established - `search_console_refresh_token_encrypted` is saved
7. ❌ **No data sync is triggered** - database tables remain empty:
   - `search_queries` table: empty
   - `search_console_queries` table: empty
8. User navigates to client detail page and sees empty states (expected, but shouldn't be)

## Expected Behavior

After successful OAuth callback and token storage:
1. System should automatically trigger a background sync job OR
2. Immediately sync the last 30 days of Search Console data
3. Populate `search_queries` and `search_console_queries` tables
4. User can immediately view their data in the client detail page

## Files to Review

### 1. OAuth Callback Handler
**File**: `apps/api/src/routes/google-oauth.routes.ts`

Look for the callback handler that processes the OAuth response. After storing the refresh token, it should:
- Trigger a sync job via BullMQ queue, OR
- Directly call the sync service to fetch initial data
- Consider using `USE_MOCK_GOOGLE_APIS` flag to determine sync behavior

### 2. Search Console Service
**File**: `apps/api/src/services/search-console.service.ts`

Review the `getSearchAnalytics()` function:
- It correctly fetches data from Google Search Console API
- Parameters: `clientAccountId`, `startDate`, `endDate`
- Returns array of `SearchConsoleQuery` objects

### 3. Query Matcher Service
**File**: `apps/api/src/services/query-matcher.service.ts`

Review the `getOrCreateQuery()` function:
- It normalizes queries and creates hash
- Inserts into `search_queries` table if not exists
- Returns the query record with `id`

### 4. Database Schema
**File**: `apps/api/src/db/schema.ts`

Tables involved:
```typescript
// Stores normalized queries with hash for deduplication
searchQueries {
  id: uuid
  clientAccountId: uuid
  queryText: text
  queryNormalized: text
  queryHash: varchar(32)
}

// Stores Search Console performance data
searchConsoleQueries {
  id: uuid
  clientAccountId: uuid
  searchQueryId: uuid (FK to searchQueries)
  date: date
  impressions: int
  clicks: int
  ctr: decimal
  position: decimal
  device: varchar
  country: varchar
}
```

### 5. Background Workers (if applicable)
**File**: `apps/api/src/workers/sync.worker.ts`

Check if there's a sync worker that should be triggered after OAuth.

### 6. Sync Jobs Tracking
**File**: Check if `sync_jobs` table is being used to track sync execution

## Implementation Requirements

### Option A: Immediate Sync (Recommended for MVP)

After OAuth callback success, directly call sync service:

```typescript
// In google-oauth.routes.ts callback handler, after saving refresh token:

// 1. Import sync service
import { getSearchAnalytics } from '@/services/search-console.service.js';
import { getOrCreateQuery } from '@/services/query-matcher.service.js';

// 2. Trigger immediate sync (last 30 days)
const endDate = new Date().toISOString().split('T')[0];
const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split('T')[0];

try {
  const scData = await getSearchAnalytics(clientId, startDate, endDate);

  // 3. Insert data into database
  for (const row of scData) {
    // Get or create normalized query
    const query = await getOrCreateQuery(clientId, row.query);

    // Insert Search Console data
    await db.insert(searchConsoleQueries).values({
      clientAccountId: clientId,
      searchQueryId: query.id,
      date: row.date,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: row.ctr.toString(),
      position: row.position.toString(),
    }).onConflictDoNothing();
  }

  logger.info(
    { clientId, recordCount: scData.length },
    'Initial Search Console sync completed'
  );
} catch (error) {
  logger.error({ error, clientId }, 'Initial sync failed - will retry later');
  // Don't fail OAuth callback if sync fails
}
```

### Option B: Queue-Based Sync (More Scalable)

After OAuth callback success, add job to BullMQ queue:

```typescript
// In google-oauth.routes.ts callback handler:
import { syncQueue } from '@/workers/queues.js';

await syncQueue.add('search-console-initial-sync', {
  clientId,
  service: 'search_console',
  startDate: /* 30 days ago */,
  endDate: /* today */,
  priority: 'high', // Initial sync should be fast
});
```

## Mock Mode Consideration

Check if `USE_MOCK_GOOGLE_APIS=true` is set in `.env`:
- If true, should use mock service to populate database with fixture data
- If false, should call real Google Search Console API
- Mock service location: `apps/api/src/services/search-console.service.mock.ts`

## Success Criteria

After implementing the fix:

1. ✅ User connects Search Console via OAuth
2. ✅ System automatically syncs last 30 days of data
3. ✅ Database tables are populated:
   - `search_queries` has normalized queries
   - `search_console_queries` has performance metrics
4. ✅ User navigates to `/client/:id` and sees actual data
5. ✅ Summary cards show real metrics (impressions, clicks, CTR, position)
6. ✅ Query data tab shows list of queries with metrics
7. ✅ Sync job tracking is recorded in `sync_jobs` table (optional)

## Testing Steps

1. Create a new test client
2. Connect Search Console for a property with known data
3. Wait for sync to complete (should be < 30 seconds for immediate sync)
4. Navigate to client detail page
5. Verify data appears in all tabs
6. Check database tables to confirm data insertion

## Additional Considerations

### Error Handling
- What happens if Google API is rate limited during sync?
- Should we retry failed syncs?
- How do we communicate sync status to the user?

### User Experience
- Should we show a loading spinner during initial sync?
- Should we redirect to a "syncing..." page after OAuth?
- Should we send a notification when sync completes?

### Data Freshness
- After initial sync, when do we sync again? (Daily worker?)
- Should we show "last synced" timestamp in UI?

## Task for AI Agent

Please review the OAuth callback implementation in `apps/api/src/routes/google-oauth.routes.ts` and:

1. **Identify** where the refresh token is being saved after successful OAuth
2. **Implement** automatic sync trigger after token storage (choose Option A or B above)
3. **Ensure** proper error handling so OAuth doesn't fail if sync has issues
4. **Add** logging to track sync execution
5. **Consider** the `USE_MOCK_GOOGLE_APIS` flag for development vs production behavior
6. **Test** the implementation with a real client connection
7. **Update** any relevant documentation

The goal is to ensure that when a user completes the Search Console OAuth flow, their data automatically appears in the application without requiring manual intervention.
