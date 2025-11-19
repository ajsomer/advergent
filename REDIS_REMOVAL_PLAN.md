# **Redis Removal Plan v4.1 - Final (Complete)**

## **Overview**

Remove Redis/BullMQ job queue system and replace with:
- **Render Cron Jobs** for daily scheduled syncs
- **Direct service calls** for manual syncs
- **Shared sync service** (`runClientSync`) used by both

---

## **STEP 1: Extract Sync Logic to Reusable Service**

**Create:** `apps/api/src/services/client-sync.service.ts`

Extract the sync logic from `apps/api/src/workers/sync.worker.ts` (lines 33-184) into a standalone service.

### **Function Signature:**

```typescript
/**
 * Run data sync for a client from Google Ads and Search Console
 *
 * @param clientId - Client account ID
 * @param trigger - What triggered the sync ('scheduled' | 'manual')
 * @param existingJobId - Optional sync_jobs.id to update (if already created)
 * @returns Object with success=true and recordsProcessed count
 * @throws Error if sync fails (caller must handle)
 *
 * Note: Creates sync_jobs DB record with status tracking.
 * On failure, DB record is marked 'failed' before throwing.
 */
export async function runClientSync(
  clientId: string,
  trigger: 'scheduled' | 'manual',
  existingJobId?: string
): Promise<{ success: true; recordsProcessed: number }>
```

### **Full Implementation:**

```typescript
import { db } from '@/db/index.js';
import { clientAccounts, searchQueries, searchConsoleQueries, syncJobs } from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getSearchAnalytics } from '@/services/search-console.service.js';
import { normalizeQuery, hashQuery } from '@/services/query-matcher.service.js';
import { syncLogger } from '@/utils/logger.js';

export async function runClientSync(
  clientId: string,
  trigger: 'scheduled' | 'manual',
  existingJobId?: string
): Promise<{ success: true; recordsProcessed: number }> {
  syncLogger.info(
    { clientId, trigger },
    'Starting sync'
  );

  try {
    // Fetch client account
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.id, clientId))
      .limit(1);

    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    // Create or use existing sync job record
    let syncJob;
    if (existingJobId) {
      // Manual sync: job already created, update to 'running'
      [syncJob] = await db
        .update(syncJobs)
        .set({
          status: 'running',
          startedAt: new Date(),
        })
        .where(eq(syncJobs.id, existingJobId))
        .returning();
    } else {
      // Scheduled sync: create new job
      [syncJob] = await db
        .insert(syncJobs)
        .values({
          clientAccountId: clientId,
          jobType: 'full_sync',
          status: 'running',
          startedAt: new Date(),
        })
        .returning();
    }

    let recordsProcessed = 0;

    try {
      // Sync Search Console data if connected
      if (client.searchConsoleRefreshTokenEncrypted) {
        syncLogger.info({ clientId }, 'Fetching Search Console data');

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30); // Last 30 days

        const scData = await getSearchAnalytics(
          clientId,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        );

        syncLogger.info(
          { clientId, recordCount: scData.length },
          'Search Console data fetched'
        );

        // Process and store Search Console data
        for (const row of scData) {
          // Normalize and hash the query
          const normalized = normalizeQuery(row.query);
          const hash = hashQuery(normalized);

          // Find or create search query
          let [searchQuery] = await db
            .select()
            .from(searchQueries)
            .where(
              and(
                eq(searchQueries.clientAccountId, clientId),
                eq(searchQueries.queryHash, hash)
              )
            )
            .limit(1);

          if (!searchQuery) {
            [searchQuery] = await db
              .insert(searchQueries)
              .values({
                clientAccountId: clientId,
                queryText: row.query,
                queryNormalized: normalized,
                queryHash: hash,
              })
              .returning();
          }

          // Insert Search Console query data
          await db
            .insert(searchConsoleQueries)
            .values({
              clientAccountId: clientId,
              searchQueryId: searchQuery.id,
              date: row.date,
              impressions: row.impressions,
              clicks: row.clicks,
              ctr: row.ctr.toString(),
              position: row.position.toString(),
              page: row.page,
              device: row.device,
              country: row.country,
              searchAppearance: row.searchAppearance,
              searchType: row.searchType,
            })
            .onConflictDoNothing(); // Skip if already exists

          recordsProcessed++;
        }

        syncLogger.info(
          { clientId, recordsProcessed },
          'Search Console data stored'
        );
      }

      // TODO: Sync Google Ads data if connected
      // This will be implemented similarly to Search Console sync

      // Mark sync job as completed
      await db
        .update(syncJobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          recordsProcessed,
        })
        .where(eq(syncJobs.id, syncJob.id));

      syncLogger.info(
        { clientId, recordsProcessed, trigger },
        'Sync completed successfully'
      );

      return { success: true, recordsProcessed };
    } catch (error) {
      // Mark sync job as failed in DB
      await db
        .update(syncJobs)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          recordsProcessed,
        })
        .where(eq(syncJobs.id, syncJob.id));

      // Re-throw so caller knows sync failed
      throw error;
    }
  } catch (error) {
    syncLogger.error(
      { clientId, trigger, error },
      'Sync failed'
    );
    // Re-throw to caller
    throw error;
  }
}
```

### **Key Changes from Original Worker:**
- ✅ Remove `job.data` wrapper - accept `clientId`, `trigger`, `existingJobId` directly
- ✅ Remove `job.id` from logging - use `clientId` + `trigger` instead
- ✅ Keep ALL existing logic: DB operations, error handling, status transitions
- ✅ **KEEP throwing behavior** - errors propagate to caller
- ✅ Support optional `existingJobId` parameter for manual syncs
- ✅ DB failure tracking happens before re-throwing error

---

## **STEP 2: Create Standalone Daily Sync Job**

**Create:** `apps/api/src/jobs/daily-sync.ts`

```typescript
#!/usr/bin/env node
import { db } from '@/db/index.js';
import { clientAccounts, syncJobs } from '@/db/schema.js';
import { eq, and, or, sql } from 'drizzle-orm';
import { runClientSync } from '@/services/client-sync.service.js';
import { workerLogger } from '@/utils/logger.js';

async function main() {
  workerLogger.info('Starting daily sync job');

  // Clean up stale jobs (running > 1 hour = assume crashed)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const staleJobs = await db
    .update(syncJobs)
    .set({
      status: 'failed',
      completedAt: new Date(),
      errorMessage: 'Job timed out or process crashed',
    })
    .where(and(
      or(
        eq(syncJobs.status, 'pending'),
        eq(syncJobs.status, 'running')
      ),
      sql`${syncJobs.startedAt} < ${oneHourAgo}`
    ))
    .returning();

  if (staleJobs.length > 0) {
    workerLogger.warn(
      { staleJobCount: staleJobs.length },
      'Cleaned up stale sync jobs'
    );
  }

  // Fetch all active clients
  const clients = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.isActive, true));

  workerLogger.info({ clientCount: clients.length }, 'Found active clients');

  let successCount = 0;
  let failureCount = 0;

  // Run syncs sequentially
  for (const client of clients) {
    try {
      const result = await runClientSync(client.id, 'scheduled');
      successCount++;
      workerLogger.info(
        { clientId: client.id, recordsProcessed: result.recordsProcessed },
        'Client sync succeeded'
      );
    } catch (error) {
      failureCount++;
      // Error already logged by runClientSync, just count it
      workerLogger.error(
        { clientId: client.id, error: error instanceof Error ? error.message : 'Unknown error' },
        'Client sync failed'
      );
    }
  }

  workerLogger.info(
    { total: clients.length, succeeded: successCount, failed: failureCount },
    'Daily sync job completed'
  );

  // Exit with error code if any syncs failed
  process.exit(failureCount > 0 ? 1 : 0);
}

main().catch(error => {
  workerLogger.error({ error }, 'Daily sync job crashed');
  process.exit(1);
});
```

### **Error Handling Flow:**
1. `runClientSync()` throws on failure
2. Try/catch in loop catches per-client failures
3. Failures logged + counted
4. Job continues processing other clients
5. Exit code 1 if any failures (Render marks cron run as failed)

### **Stale Job Cleanup:**
- Runs at start of each daily sync
- Marks jobs `pending` or `running` for >1 hour as `failed`
- Prevents orphaned jobs from blocking future syncs

---

## **STEP 2b: Add Database Migration for Concurrency Constraint**

This migration adds a **partial unique index** that prevents concurrent syncs at the database level. This is the only truly race-free solution.

### **2b.1: Update Drizzle Schema**

**Edit:** `apps/api/src/db/schema.ts`

**Find the `syncJobs` table definition (around line 237) and update the indexes section:**

```typescript
export const syncJobs = pgTable('sync_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  jobType: jobTypeEnum('job_type').notNull(),
  status: jobStatusEnum('status').default('pending'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  recordsProcessed: integer('records_processed').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Remove old index
  // clientIdx: index('idx_sync_jobs_client').on(table.clientAccountId),  // DELETE THIS LINE

  // Add partial unique index for active jobs (pending/running)
  activePerClientIdx: uniqueIndex('idx_sync_jobs_active_per_client')
    .on(table.clientAccountId)
    .where(sql`status IN ('pending', 'running')`),

  // Add regular index for all client lookups
  clientAllIdx: index('idx_sync_jobs_client_all').on(table.clientAccountId),

  // Keep existing indexes
  statusIdx: index('idx_sync_jobs_status').on(table.status),
  createdAtIdx: index('idx_sync_jobs_created_at').on(table.createdAt),
}));
```

**Add import at top of file if not present:**
```typescript
import { pgTable, uuid, varchar, timestamp, integer, text, boolean, date, decimal, bigint, check, index, uniqueIndex, pgEnum, sql } from 'drizzle-orm/pg-core';
```

### **2b.2: Generate Migration**

**Run Drizzle migration generator:**
```bash
cd apps/api
npm run db:generate
```

This will create a new migration file in `apps/api/drizzle/` (or wherever Drizzle is configured to output migrations).

### **2b.3: Apply Migration**

**Run migration:**
```bash
cd apps/api
npm run db:push
# OR if using node-pg-migrate:
# npm run migrate
```

### **How This Works:**

The partial unique index enforces **at the database level** that only one row with `status IN ('pending', 'running')` can exist per `client_account_id`.

**Concurrent insert attempts:**
- Request A inserts → succeeds
- Request B inserts → **violates unique constraint** → throws error
- Application catches error → returns 409 with Request A's `jobId`

**This is atomic and race-free** - PostgreSQL guarantees no two concurrent transactions can both insert.

---

## **STEP 3: Refactor Manual Sync Endpoint**

**Update:** `apps/api/src/routes/clients.routes.ts` (lines 636-679)

### **Imports (Updated):**

```typescript
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '@/db/index.js';
import {
  clientAccounts,
  searchConsoleQueries,
  googleAdsQueries,
  searchQueries,
  queryOverlaps,
  recommendations,
  syncJobs,              // ← ADD THIS (was missing)
} from '@/db/schema.js';
import { eq, and, desc, sql, or } from 'drizzle-orm';  // ← ADD 'or' (was missing)
import { logger } from '@/utils/logger.js';
import { getClientRecommendations } from '@/services/recommendation-storage.service.js';
import { runClientSync } from '@/services/client-sync.service.js';  // ← ADD THIS (new import)
```

### **Route Implementation (Replace lines 636-679):**

```typescript
/**
 * POST /api/clients/:id/sync
 * Trigger manual data sync for a client from Google Ads and Search Console
 */
router.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify client exists and belongs to user's agency
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(and(eq(clientAccounts.id, id), eq(clientAccounts.agencyId, user.agencyId)))
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Fail stale pending jobs (e.g., server crashed before async work kicked off)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await db
      .update(syncJobs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: 'Sync timed out before starting',
      })
      .where(and(
        eq(syncJobs.clientAccountId, id),
        eq(syncJobs.status, 'pending'),
        sql`${syncJobs.startedAt} < ${fiveMinutesAgo}`
      ));

    // Try to insert new sync job (status 'pending')
    // The unique partial index will prevent concurrent syncs atomically
    let syncJob;
    try {
      [syncJob] = await db
        .insert(syncJobs)
        .values({
          clientAccountId: id,
          jobType: 'full_sync',
          status: 'pending',
          startedAt: new Date(),
        })
        .returning();
    } catch (error: any) {
      // Unique constraint violation = sync already running
      if (error.code === '23505' && error.constraint === 'idx_sync_jobs_active_per_client') {
        // Find the existing active job
        const [activeJob] = await db
          .select()
          .from(syncJobs)
          .where(and(
            eq(syncJobs.clientAccountId, id),
            or(
              eq(syncJobs.status, 'pending'),
              eq(syncJobs.status, 'running')
            )
          ))
          .orderBy(desc(syncJobs.createdAt))
          .limit(1);

        return res.status(409).json({
          success: false,
          message: 'Sync already in progress',
          jobId: activeJob?.id || null,
        });
      }
      // Other DB errors - re-throw
      throw error;
    }

    logger.info(
      { clientId: id, userId: user.id, jobId: syncJob.id },
      'Manual sync initiated'
    );

    // Return 202 Accepted with jobId
    res.status(202).json({
      success: true,
      message: 'Data sync initiated',
      jobId: syncJob.id,
    });

    // Fire-and-forget execution
    setImmediate(() => {
      runClientSync(id, 'manual', syncJob.id)
        .then(result => {
          logger.info(
            { clientId: id, userId: user.id, jobId: syncJob.id, recordsProcessed: result.recordsProcessed },
            'Manual sync completed successfully'
          );
        })
        .catch(error => {
          logger.error(
            { clientId: id, userId: user.id, jobId: syncJob.id, error },
            'Manual sync failed'
          );
        });
    });
  } catch (error) {
    logger.error({ error }, 'Failed to initiate manual sync');
    res.status(500).json({ error: 'Failed to initiate data sync' });
  }
});
```

### **Key Features:**
1. ✅ **Truly atomic**: Database enforces constraint, impossible to race
2. ✅ **No TOCTOU vulnerability**: Insert is the check (try-insert-catch pattern)
3. ✅ **Sequential execution**: Only one sync per client at a time
4. ✅ **Frontend compatibility**: Returns `jobId` matching existing type contract
5. ✅ **Auto-heals stale pending jobs**: Pending rows older than ~5 minutes are failed before inserting, so a crash cannot block retries
6. ✅ **Immediate response**: Returns 202 before sync starts
7. ✅ **Fire-and-forget safety**: Uses `setImmediate()` with explicit `.catch()`

### **Concurrency Guard Behavior (Truly Atomic):**

```
Time    Request A                           Request B
────────────────────────────────────────────────────────────
T0      INSERT pending job
T1      ✅ Success, get jobId                INSERT pending job
T2      Return 202 with jobId               ❌ Constraint violation (error.code='23505')
T3      setImmediate → running              SELECT active job
T4                                          ✅ Return 409 with A's jobId
```

**Why this is race-free:**
- PostgreSQL guarantees unique indexes are checked atomically during INSERT
- No window between check and insert
- Database is the source of truth
- Concurrent requests physically cannot both insert

---

## **STEP 4: Remove BullMQ Import from Server**

**Update:** `apps/api/src/server.ts`

**Delete lines 21-22:**
```typescript
// Import sync worker to start processing jobs
import './workers/sync.worker.js';
```

No other changes needed to this file.

---

## **STEP 5: Remove Dependencies**

**Update:** `apps/api/package.json`

**Remove from `dependencies`:**
```json
"bullmq": "^5.0.0",      // line 24
"ioredis": "^5.3.2",     // line 34
"node-cron": "^3.0.3",   // line 36
```

**Remove from `devDependencies`:**
```json
"@types/node-cron": "^3.0.8",  // line 54
```

**Run after editing:**
```bash
cd apps/api && npm install
```

This updates `package-lock.json` and removes ~50 transitive dependencies.

---

## **STEP 6: Update Render Configuration**

**Update:** `render.yaml`

### **6a. Add Cron Job Service**

Insert after line 50 (before worker service):

```yaml
  # Daily Sync Cron Job
  - type: cron
    name: advergent-daily-sync
    runtime: node
    schedule: "0 2 * * *"  # 2 AM UTC daily
    buildCommand: NODE_ENV=development npm install && cd apps/api && npm run build
    dockerCommand: cd apps/api && node dist/jobs/daily-sync.js
    envVars:
      - key: NODE_ENV
        value: production
      # Database
      - key: DATABASE_URL
        sync: false
      # Google OAuth & APIs
      - key: GOOGLE_CLIENT_ID
        sync: false
      - key: GOOGLE_CLIENT_SECRET
        sync: false
      - key: GOOGLE_REDIRECT_URI
        value: https://advergent-api.onrender.com/api/google/callback
      - key: GOOGLE_ADS_DEVELOPER_TOKEN
        sync: false
      # AI Provider
      - key: ANTHROPIC_API_KEY
        sync: false
      # Encryption (CRITICAL - service throws without this)
      - key: ENCRYPTION_MASTER_KEY
        sync: false
      # AWS (for future KMS integration)
      - key: AWS_REGION
        value: ap-southeast-2
      - key: AWS_ACCESS_KEY_ID
        sync: false
      - key: AWS_SECRET_ACCESS_KEY
        sync: false
      - key: KMS_KEY_ID
        sync: false
```

### **6b. Delete Worker Service**

Delete entire worker service block (lines 52-90):
```yaml
  # Background Worker Service  ← DELETE THIS ENTIRE BLOCK
  - type: worker
    name: advergent-worker
    ...
```

### **6c. Remove Redis Env Vars from API Service**

Delete from API service `envVars` section (lines 16-19, 48-49):
```yaml
      - key: UPSTASH_REDIS_URL     # DELETE
        sync: false                 # DELETE
      - key: UPSTASH_REDIS_TOKEN   # DELETE
        sync: false                 # DELETE
      - key: RUN_SCHEDULER         # DELETE
        value: false                # DELETE
```

### **Why These Env Vars Are Required:**

| Env Var | Required By | Crash Without It? |
|---------|-------------|-------------------|
| `DATABASE_URL` | Drizzle ORM | ✅ Yes - can't connect to DB |
| `GOOGLE_CLIENT_ID` | OAuth2 client | ✅ Yes - initialization fails |
| `GOOGLE_CLIENT_SECRET` | OAuth2 client | ✅ Yes - initialization fails |
| `GOOGLE_REDIRECT_URI` | OAuth2 client (line 63 of search-console.service.ts) | ✅ Yes |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API | ⚠️ If client has Ads connected |
| `ANTHROPIC_API_KEY` | Claude AI | ⚠️ If analysis runs during sync |
| `ENCRYPTION_MASTER_KEY` | Encryption service constructor (line 11) | ✅ Yes - **throws immediately** |
| `AWS_*` | Future KMS | ⚠️ Not yet used, but config reads them |

**Note:** `COOKIE_SECRET` is NOT needed - only used by Express middleware, cron job doesn't run HTTP server.

---

## **STEP 7: Update Configuration Files**

### **7a. Update Config**

**File:** `apps/api/src/config/index.ts`

**Delete lines 18-20:**
```typescript
  // Redis
  redisUrl: process.env.UPSTASH_REDIS_URL,
  redisToken: process.env.UPSTASH_REDIS_TOKEN,
```

**Delete line 46:**
```typescript
  runScheduler: process.env.RUN_SCHEDULER === 'true',
```

### **7b. Update Env Example**

**File:** `apps/api/.env.example`

**Remove these lines:**
```bash
# Redis (Upstash)
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-token

# Worker settings
RUN_SCHEDULER=false
```

**Ensure this exists:**
```bash
# Encryption
ENCRYPTION_MASTER_KEY=your-64-char-hex-key
```

---

## **STEP 8: Update Documentation**

### **8a. Update CLAUDE.md**

**Find section "Background Jobs - BullMQ + Upstash Redis" (around line 80) and replace with:**

```markdown
6. **Background Jobs** - Render Cron Jobs:
   - `jobs/daily-sync.ts` - Daily data sync at 2 AM UTC via Render cron service
   - Manual syncs via `POST /api/clients/:id/sync` endpoint (fire-and-forget async)
   - `services/client-sync.service.ts` - Shared sync logic used by both cron and manual triggers
   - No queue system - direct function calls with throwing error contract
   - Sequential client processing (parallelization can be added if needed)
   - Job status tracked in `sync_jobs` table with concurrency guard
   - Stale job cleanup runs before each daily sync
```

**Delete section "BullMQ + Scheduler Pattern" (around line 95):**

Delete entire section about Redis-based leader election.

**Update "Deployment (Render)" section (around line 150):**

**Replace:**
```markdown
2. **Worker Service** - BullMQ workers
   - Build: same as web service
   - Start: `node dist/workers/index.js`
   - Env: `RUN_SCHEDULER=true`
```

**With:**
```markdown
2. **Cron Job Service** - Daily sync
   - Build: same as web service
   - Schedule: `0 2 * * *` (2 AM UTC)
   - Command: `node dist/jobs/daily-sync.js`
   - Runs independently of web service
   - Includes stale job cleanup before each run
```

**Update "External services" section (around line 160):**

**Remove:**
```markdown
- Redis: Upstash Redis (serverless)
```

**Update "Environment Variables" section (around line 280):**

**Remove from Backend (.env) section:**
```bash
UPSTASH_REDIS_URL=https://...
UPSTASH_REDIS_TOKEN=...
RUN_SCHEDULER=false
```

### **8b. Update PROMPT.md**

Search for all instances and update:
- **"BullMQ"** → "Render Cron Jobs"
- **"Upstash Redis"** → *(remove)*
- **"worker process"** → "cron job service"
- **"syncQueue.add"** → "runClientSync service"
- **"leader election"** → *(remove - no longer needed)*

Specific sections to update:
1. Architecture overview
2. Week 4 implementation notes (Background Jobs)
3. Deployment checklist

### **8c. Update GOOGLE_OAUTH_IMPLEMENTATION.md**

**Find line 100:**
```markdown
Store state parameter in session/redis for CSRF protection
```

**Replace with:**
```markdown
Store state parameter in encrypted, signed cookie for CSRF protection
```

### **8d. Update docker-compose.yml**

**Comment out Redis service and volume (lines 19-32):**

```yaml
  # Redis - No longer used (removed BullMQ job queue)
  # Uncomment if needed for future caching/sessions
  # redis:
  #   image: redis:7-alpine
  #   ports:
  #     - "6379:6379"
  #   volumes:
  #     - redis_data:/data
  #   healthcheck:
  #     test: ["CMD", "redis-cli", "ping"]
  #     interval: 10s
  #     timeout: 3s
  #     retries: 5

volumes:
  postgres_data:
  # redis_data:  # Commented - Redis no longer used
```

---

## **STEP 9: Delete Workers Directory**

**After all above steps complete and tested:**

```bash
rm -rf apps/api/src/workers
```

**Files deleted:**
- `apps/api/src/workers/index.ts`
- `apps/api/src/workers/scheduler.ts`
- `apps/api/src/workers/sync.worker.ts`

---

## **STEP 10: Testing**

### **10a. Local Testing**

```bash
# 1. Install dependencies (removes BullMQ/Redis packages)
cd apps/api && npm install

# 2. Build project
npm run build

# 3. Verify jobs directory exists in dist
ls -la dist/jobs/
# Should show: daily-sync.js

# 4. Test daily sync script locally
node dist/jobs/daily-sync.js
# Check logs for sync completion

# 5. Start API server
npm run dev
# Verify no errors about missing workers

# 6. Test manual sync endpoint
curl -X POST http://localhost:3001/api/clients/{clientId}/sync \
  -H "Authorization: Bearer {your-clerk-token}" \
  -H "Content-Type: application/json"

# Expected response:
# {"success":true,"message":"Data sync initiated","jobId":"clxxx..."}

# 7. Test concurrent sync protection
curl -X POST http://localhost:3001/api/clients/{clientId}/sync \
  -H "Authorization: Bearer {token}" &
curl -X POST http://localhost:3001/api/clients/{clientId}/sync \
  -H "Authorization: Bearer {token}" &

# Expected:
# Request 1: 202 Accepted { "jobId": "abc123", ... }
# Request 2: 409 Conflict { "jobId": "abc123", ... }  (same jobId!)

# 8. Check server logs for async completion
# Should see: "Manual sync completed successfully" or "Manual sync failed"

# 9. Verify DB sync_jobs table
# psql or DB tool:
SELECT * FROM sync_jobs
WHERE client_account_id = '{clientId}'
ORDER BY created_at DESC;

# Should show:
# - Only ONE job created from concurrent requests
# - Status transitions: pending → running → completed/failed
```

### **10b. Test jobId Tracking**

```bash
# Manual sync returns jobId
RESPONSE=$(curl -X POST http://localhost:3001/api/clients/{id}/sync \
  -H "Authorization: Bearer {token}")

echo $RESPONSE
# Expected: {"success":true,"message":"Data sync initiated","jobId":"clxxx..."}

# Extract jobId
JOB_ID=$(echo $RESPONSE | jq -r '.jobId')

# Check sync_jobs table
psql $DATABASE_URL -c "SELECT * FROM sync_jobs WHERE id = '$JOB_ID';"
# Should show: status = 'pending' initially, then 'running', then 'completed'/'failed'
```

### **10c. Test Cron Env Vars**

```bash
# Verify ENCRYPTION_MASTER_KEY is set
echo $ENCRYPTION_MASTER_KEY | wc -c
# Should output: 65 (64 hex chars + newline)

# Run daily sync and check for encryption errors
node dist/jobs/daily-sync.js
# Should NOT see: "ENCRYPTION_MASTER_KEY environment variable is required"
```

### **10d. Render Deployment Testing**

```bash
# 1. Push to main branch
git add .
git commit -m "Remove Redis/BullMQ, use Render cron jobs"
git push origin main
```

**2. Monitor Render dashboard:**
- Web service (advergent-api) rebuilds ✓
- Worker service deleted ✓
- Cron job service created ✓

**3. Verify cron job:**
- Open `advergent-daily-sync` service in Render
- Click "Trigger Run" to test manually
- Check logs for successful execution
- Verify `sync_jobs` table in production DB

**4. Test manual sync in production:**
```bash
curl -X POST https://advergent-api.onrender.com/api/clients/{id}/sync \
  -H "Authorization: Bearer {token}"
```
- Should return 202 Accepted
- Check API logs for async completion

**5. Monitor for 24 hours:**
- Ensure cron runs at 2 AM UTC
- Check for any errors in logs
- Verify daily sync_jobs records created

---

## **Error Handling Contract - Summary**

### **runClientSync() Behavior**

✅ **Success:** Returns `{ success: true, recordsProcessed: number }`
❌ **Failure:** Throws error (after marking DB record as 'failed')

### **Caller Responsibilities**

**Daily cron job:**
```typescript
try {
  await runClientSync(id, 'scheduled');
  // Log success
} catch (error) {
  // Log failure, continue to next client
}
```

**Manual sync endpoint:**
```typescript
setImmediate(() => {
  runClientSync(id, 'manual', syncJob.id)
    .then(result => { /* log success */ })
    .catch(error => { /* log failure */ });
});
```

### **Database State**

Both success and failure cases write to `sync_jobs` table:
- **Success:** `status = 'completed'`, `recordsProcessed = N`
- **Failure:** `status = 'failed'`, `errorMessage = "..."`, then throws

This ensures audit trail regardless of outcome.

---

## **Migration Checklist**

- [ ] **Step 1:** Create `services/client-sync.service.ts` with `existingJobId` param
- [ ] **Step 2:** Create `jobs/daily-sync.ts` with stale job cleanup
- [ ] **Step 2b:** Add database constraint for concurrency:
  - [ ] Update `schema.ts` to add partial unique index
  - [ ] Add `sql` to imports from 'drizzle-orm/pg-core'
  - [ ] Run `npm run db:generate` to create migration
  - [ ] Run `npm run db:push` (or `npm run migrate`) to apply migration
- [ ] **Step 3:** Update `routes/clients.routes.ts`:
  - [ ] Add `syncJobs` to schema imports
  - [ ] Add `or` to drizzle-orm imports
  - [ ] Add `runClientSync` service import
  - [ ] Implement atomic try-insert-catch pattern
  - [ ] Handle constraint violation (error code '23505')
  - [ ] Return `jobId` in response
  - [ ] Pass `jobId` to `runClientSync()`
- [ ] **Step 4:** Remove worker import from `server.ts`
- [ ] **Step 5:** Remove 4 packages from `apps/api/package.json` + run `npm install`
- [ ] **Step 6:** Update `render.yaml`:
  - [ ] Add cron job service with complete env vars (including `ENCRYPTION_MASTER_KEY`)
  - [ ] Delete worker service
  - [ ] Remove Redis env vars from API service
- [ ] **Step 7:** Update `config/index.ts` and `.env.example`
- [ ] **Step 8:** Update 4 docs (CLAUDE.md, PROMPT.md, GOOGLE_OAUTH_IMPLEMENTATION.md, docker-compose.yml)
- [ ] **Step 9:** Delete `apps/api/src/workers/` directory
- [ ] **Step 10:** Test locally + deploy to Render + monitor

---

## **Summary of Changes**

| Component | Action | Files Changed |
|-----------|--------|---------------|
| **Sync Logic** | Extract to service with `existingJobId` param | `services/client-sync.service.ts` (new) |
| **Daily Cron** | Create standalone script with stale job cleanup | `jobs/daily-sync.ts` (new) |
| **DB Schema** | Add partial unique index for concurrency | `db/schema.ts` (update) |
| **DB Migration** | Generate and apply migration | Auto-generated via `db:generate` |
| **Manual Sync** | Add atomic try-insert-catch, preserve `jobId` | `routes/clients.routes.ts` (update) |
| **Server Startup** | Remove worker import | `server.ts` (delete lines 21-22) |
| **Dependencies** | Remove 4 packages | `apps/api/package.json` |
| **Deployment** | Add cron, remove worker, complete env vars | `render.yaml` |
| **Config** | Remove Redis vars | `config/index.ts`, `.env.example` |
| **Docs** | Update all Redis references | 4 files |
| **Local Dev** | Comment Redis | `docker-compose.yml` |
| **Cleanup** | Delete workers | `apps/api/src/workers/*` (delete directory) |

---

## **Risk Mitigation**

✅ **No code duplication** - Single `runClientSync()` service
✅ **No lost functionality** - Daily + manual syncs both work
✅ **No race conditions** - Database-enforced partial unique index (truly atomic)
✅ **No TOCTOU bugs** - Try-insert-catch pattern eliminates check-then-act vulnerability
✅ **No crashes** - All imports replaced before deletion
✅ **No missing env vars** - Complete list including `ENCRYPTION_MASTER_KEY`
✅ **No config drift** - All env vars cleaned up
✅ **No doc confusion** - All Redis references updated
✅ **Frontend compatibility** - `jobId` preserved in response
✅ **Stale job cleanup** - Runs before each daily sync and before every manual trigger
✅ **Proper Drizzle workflow** - Schema updated first, then migration generated

---

## **Ready to Implement**

This plan is production-ready and addresses all identified issues:
1. ✅ **Race condition prevention** - Database-level partial unique index (truly atomic)
2. ✅ **TOCTOU vulnerability fixed** - Try-insert-catch pattern instead of check-then-insert
3. ✅ **Missing imports** (`syncJobs`, `or`, `sql`)
4. ✅ **Complete env vars** for cron job (including `ENCRYPTION_MASTER_KEY`)
5. ✅ **Frontend type contract preserved** - `jobId` returned in response
6. ✅ **Sequential execution per client** - Only one active sync at a time
7. ✅ **Proper error handling and logging** - Comprehensive error propagation
8. ✅ **Proper Drizzle workflow** - Schema-first, then migration generation

**Proceed with implementation step by step, testing each change before moving to the next.**
