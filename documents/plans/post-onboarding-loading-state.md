# Post-Onboarding Loading State Implementation Plan

## Problem Statement

After a user completes onboarding (connects Google accounts), they are immediately redirected to the Dashboard. However:

1. The initial data sync takes 1-2 minutes (Search Console, GA4, Google Ads API calls)
2. The AI report generation takes another 30-60 seconds (multi-agent pipeline)
3. The Dashboard shows empty/zero values during this time, which is confusing
4. The main value proposition (the AI report) isn't ready yet

**User expectation**: After connecting accounts, see a clear indication that data is being prepared, then land on a dashboard with meaningful insights.

## Current State Analysis

### Current Flow
```
Onboarding.tsx (step=complete)
    ↓
handleComplete() → navigate('/')
    ↓
Dashboard.tsx
    ↓
Shows client cards (empty metrics until sync completes)
```

### Existing Backend Endpoint
`GET /api/clients/:id/sync-status` currently returns:
```json
{
  "id": "job-uuid",
  "status": "pending" | "running" | "completed" | "failed",
  "jobType": "full_sync",
  "createdAt": "...",
  "startedAt": "...",
  "completedAt": "...",
  "errorMessage": "..." | null
}
```
Or `{ "status": "never_synced" }` if no jobs exist.

### Gaps Identified
1. **No report status**: Endpoint doesn't query `interplay_reports` table
2. **No step-level progress**: Can't show which data source is currently syncing (deferred - requires migration + instrumentation)
3. **No stuck job detection for running jobs**: Only pending jobs are marked stale after 5 min
4. **clientId availability**: Must verify onboarding provides clientId for redirect
5. **Status alignment**: Report status must include all actual states: `pending`, `researching`, `analyzing`, `completed`, `failed`
6. **Schema imports**: Route needs `interplayReports`, `gte`, `isNull`, `or`, `lt` imports
7. **Null startedAt**: Timeout handling must cover missing `startedAt` on running jobs

## Recommended Implementation: Option A (Dedicated Preparing Page)

### Backend Changes Required

#### 1. Enhance `GET /api/clients/:id/sync-status`

**New Response Schema (aligned to actual DB enums):**
```typescript
interface SyncStatusResponse {
  // Sync job info
  sync: {
    status: 'never_synced' | 'pending' | 'running' | 'completed' | 'failed';
    jobId: string | null;
    startedAt: string | null;
    completedAt: string | null;
    errorMessage: string | null;
    // NOTE: currentStep deferred for MVP - would require migration + sync flow instrumentation
  };

  // Report info (only queried if sync is running or completed)
  report: {
    // Matches interplay_reports.status enum + 'none' for no report yet
    status: 'none' | 'pending' | 'researching' | 'analyzing' | 'completed' | 'failed';
    reportId: string | null;
    createdAt: string | null;
    completedAt: string | null;
    errorMessage: string | null;
  } | null;

  // Derived ready state for frontend simplicity
  isReady: boolean;  // true when sync=completed AND report=completed

  // For timeout detection (duplicated for convenience)
  syncStartedAt: string | null;
}
```

**Report Linkage Rule:**
- Query latest report WHERE `client_account_id = :id` AND `created_at > lastSync.startedAt`
- This ensures we show the report triggered by the current/recent sync, not stale ones

**Implementation Changes (clients.routes.ts:1153-1209):**
```typescript
// Additional imports needed at top of file:
// import { interplayReports } from '@/db/schema.js';
// import { gte, isNull, or, lt } from 'drizzle-orm';

router.get('/:id/sync-status', async (req: Request, res: Response) => {
  // ... existing auth/client verification ...

  // Get latest sync job
  const [latestSync] = await db
    .select()
    .from(syncJobs)
    .where(eq(syncJobs.clientAccountId, id))
    .orderBy(desc(syncJobs.createdAt))
    .limit(1);

  if (!latestSync) {
    return res.json({
      sync: { status: 'never_synced', jobId: null, startedAt: null, completedAt: null, errorMessage: null },
      report: null,
      isReady: false,
      syncStartedAt: null,
    });
  }

  // Get latest report created after this sync started
  let reportInfo = null;
  if (latestSync.status === 'completed' || latestSync.status === 'running') {
    const [latestReport] = await db
      .select({
        id: interplayReports.id,
        status: interplayReports.status,
        createdAt: interplayReports.createdAt,
        completedAt: interplayReports.completedAt,
        errorMessage: interplayReports.errorMessage,
      })
      .from(interplayReports)
      .where(
        and(
          eq(interplayReports.clientAccountId, id),
          latestSync.startedAt
            ? gte(interplayReports.createdAt, latestSync.startedAt)
            : sql`true`
        )
      )
      .orderBy(desc(interplayReports.createdAt))
      .limit(1);

    if (latestReport) {
      reportInfo = {
        status: latestReport.status,
        reportId: latestReport.id,
        createdAt: latestReport.createdAt?.toISOString() || null,
        completedAt: latestReport.completedAt?.toISOString() || null,
        errorMessage: latestReport.errorMessage,
      };
    } else {
      // Sync completed but no report yet - might be pending creation
      reportInfo = {
        status: 'none',
        reportId: null,
        createdAt: null,
        completedAt: null,
        errorMessage: null,
      };
    }
  }

  const isReady = latestSync.status === 'completed' && reportInfo?.status === 'completed';

  res.json({
    sync: {
      status: latestSync.status,
      jobId: latestSync.id,
      startedAt: latestSync.startedAt?.toISOString() || null,
      completedAt: latestSync.completedAt?.toISOString() || null,
      errorMessage: latestSync.errorMessage,
    },
    report: reportInfo,
    isReady,
    syncStartedAt: latestSync.startedAt?.toISOString() || null,
  });
});
```

#### 2. Add Stuck Job Detection for Running Jobs (covers null startedAt)

In `client-sync.service.ts`, before starting a sync, mark running jobs older than 10 minutes as failed:
```typescript
// Mark stale RUNNING jobs as failed (in addition to existing pending job cleanup)
await db
  .update(syncJobs)
  .set({
    status: 'failed',
    errorMessage: 'Job timed out after 10 minutes',
    completedAt: new Date()
  })
  .where(
    and(
      eq(syncJobs.clientAccountId, clientId),
      eq(syncJobs.status, 'running'),
      or(
        isNull(syncJobs.startedAt), // handle missing startedAt
        lt(syncJobs.startedAt, new Date(Date.now() - 10 * 60 * 1000))
      )
    )
  );
```

### Frontend Changes Required

#### 1. Create `useSyncStatus` Hook

```typescript
// apps/web/src/hooks/useSyncStatus.ts
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api';

interface SyncStatusResponse {
  sync: {
    status: 'never_synced' | 'pending' | 'running' | 'completed' | 'failed';
    jobId: string | null;
    startedAt: string | null;
    completedAt: string | null;
    errorMessage: string | null;
  };
  report: {
    // Matches DB enum + 'none' for no report yet
    status: 'none' | 'pending' | 'researching' | 'analyzing' | 'completed' | 'failed';
    reportId: string | null;
    createdAt: string | null;
    completedAt: string | null;
    errorMessage: string | null;
  } | null;
  isReady: boolean;
  syncStartedAt: string | null;
}

export function useSyncStatus(clientId: string | undefined, options?: { enabled?: boolean }) {
  const api = useApiClient();

  return useQuery<SyncStatusResponse>({
    queryKey: ['sync-status', clientId],
    queryFn: async () => {
      const response = await api.get(`/api/clients/${clientId}/sync-status`);
      return response.data;
    },
    refetchInterval: (query) => {
      // Stop polling when ready or failed
      const data = query.state.data;
      if (data?.isReady) return false;
      if (data?.sync.status === 'failed') return false;
      if (data?.report?.status === 'failed') return false;
      return 5000; // Poll every 5 seconds
    },
    enabled: !!clientId && (options?.enabled !== false),
  });
}
```

#### 2. Create `ClientPreparing.tsx` Page

```typescript
// apps/web/src/pages/ClientPreparing.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, Circle, AlertCircle, RefreshCw } from 'lucide-react';
import { useApiClient } from '@/lib/api';

export default function ClientPreparing() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const api = useApiClient();
  const { data: status, isLoading, error, refetch } = useSyncStatus(clientId);

  const [elapsedTime, setElapsedTime] = useState(0);

  // Track elapsed time for timeout warning
  useEffect(() => {
    if (!status?.syncStartedAt) return;

    const interval = setInterval(() => {
      const started = new Date(status.syncStartedAt!).getTime();
      setElapsedTime(Math.floor((Date.now() - started) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [status?.syncStartedAt]);

  // Auto-redirect when ready
  useEffect(() => {
    if (status?.isReady) {
      navigate(`/clients/${clientId}`, { replace: true });
    }
  }, [status?.isReady, clientId, navigate]);

  const handleRetrySync = async () => {
    try {
      await api.post(`/api/clients/${clientId}/sync`);
      refetch();
    } catch (err) {
      console.error('Failed to retry sync', err);
    }
  };

  const handleRetryReport = async () => {
    try {
      await api.post(`/api/clients/${clientId}/interplay-report/regenerate`, { days: 30 });
      refetch();
    } catch (err) {
      console.error('Failed to retry report', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const syncStatus = status?.sync.status || 'never_synced';
  const reportStatus = status?.report?.status || 'none';
  const hasFailed = syncStatus === 'failed' || reportStatus === 'failed';
  const isTimeout = elapsedTime > 300; // 5 minutes

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12">
            <div className="text-center mb-8">
              {hasFailed ? (
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              ) : (
                <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-4" />
              )}
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                {hasFailed ? 'Something went wrong' : 'Preparing Your Dashboard'}
              </h1>
              <p className="text-slate-600">
                {hasFailed
                  ? 'We encountered an issue while setting up your account.'
                  : "We're syncing your data and generating AI insights. This usually takes 1-2 minutes."}
              </p>
            </div>

            {/* Progress Steps */}
            <div className="space-y-4 mb-8">
              <ProgressStep
                label="Syncing data from Google"
                status={
                  syncStatus === 'completed' ? 'completed' :
                  syncStatus === 'running' || syncStatus === 'pending' ? 'running' :
                  syncStatus === 'failed' ? 'failed' : 'pending'
                }
                error={status?.sync.errorMessage}
              />
              <ProgressStep
                label="Generating AI insights"
                status={
                  syncStatus !== 'completed' ? 'pending' :
                  reportStatus === 'completed' ? 'completed' :
                  // 'pending', 'researching', 'analyzing' all show as running
                  ['pending', 'researching', 'analyzing'].includes(reportStatus) ? 'running' :
                  reportStatus === 'failed' ? 'failed' : 'pending'
                }
                error={status?.report?.errorMessage}
              />
            </div>

            {/* Error Actions */}
            {hasFailed && (
              <div className="flex justify-center gap-4">
                {syncStatus === 'failed' && (
                  <Button onClick={handleRetrySync}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Sync
                  </Button>
                )}
                {reportStatus === 'failed' && (
                  <Button onClick={handleRetryReport}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Report
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate('/')}>
                  Go to Dashboard
                </Button>
              </div>
            )}

            {/* Timeout Warning */}
            {isTimeout && !hasFailed && (
              <Alert className="mt-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This is taking longer than expected. You can wait or{' '}
                  <button
                    onClick={() => navigate(`/clients/${clientId}`)}
                    className="underline"
                  >
                    view your dashboard
                  </button>{' '}
                  and check back later.
                </AlertDescription>
              </Alert>
            )}

            {/* Skip Link */}
            {!hasFailed && (
              <p className="text-center text-sm text-slate-500 mt-8">
                <button
                  onClick={() => navigate(`/clients/${clientId}`)}
                  className="underline hover:text-slate-700"
                >
                  Skip and view dashboard
                </button>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProgressStep({ label, status, error }: {
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      {status === 'completed' && <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />}
      {status === 'running' && <Loader2 className="h-6 w-6 text-blue-500 animate-spin flex-shrink-0" />}
      {status === 'pending' && <Circle className="h-6 w-6 text-slate-300 flex-shrink-0" />}
      {status === 'failed' && <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0" />}
      <div>
        <span className={`font-medium ${status === 'failed' ? 'text-red-700' : 'text-slate-700'}`}>
          {label}
        </span>
        {error && (
          <p className="text-sm text-red-600 mt-1">{error}</p>
        )}
      </div>
    </div>
  );
}
```

#### 3. Update `App.tsx` Routing

Add new route before `/clients/:clientId`:
```typescript
<Route
  path="/clients/:clientId/preparing"
  element={
    <>
      <SignedIn>
        <Layout>
          <ClientPreparing />
        </Layout>
      </SignedIn>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
    </>
  }
/>
```

#### 4. Update `Onboarding.tsx` Navigation

Verify `clientId` is available (it is - stored in state from step 1), then change:
```typescript
const handleComplete = () => {
  if (clientId) {
    navigate(`/clients/${clientId}/preparing`);
  } else {
    // Fallback - shouldn't happen but handle gracefully
    navigate('/');
  }
};
```

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/routes/clients.routes.ts` | MODIFY | Enhance sync-status endpoint with report info |
| `apps/api/src/services/client-sync.service.ts` | MODIFY | Add running job timeout cleanup |
| `apps/web/src/pages/ClientPreparing.tsx` | CREATE | New loading/progress page |
| `apps/web/src/hooks/useSyncStatus.ts` | CREATE | Hook to poll sync status |
| `apps/web/src/App.tsx` | MODIFY | Add route for /clients/:id/preparing |
| `apps/web/src/pages/Onboarding.tsx` | MODIFY | Navigate to preparing page on complete |

### Testing Checklist

- [ ] New client → onboarding → redirects to preparing page (clientId available)
- [ ] Preparing page shows sync progress with correct status names
- [ ] Preparing page shows report generation progress after sync completes
- [ ] Auto-redirects to ClientDetail when both sync AND report complete
- [ ] Sync failure shows error + retry button
- [ ] Report failure shows error + retry button
- [ ] Timeout warning appears after 5 minutes
- [ ] "Skip" link works and navigates to ClientDetail
- [ ] Works for both unified and split OAuth flows
- [ ] Works when user refreshes preparing page mid-sync
- [ ] Report status only shown for reports created after current sync started
- [ ] Running sync jobs older than 10 minutes are marked as timed out

## Implementation Order

1. **Backend**: Add running job timeout cleanup to client-sync.service.ts
2. **Backend**: Enhance sync-status endpoint with report status + isReady flag
3. **Frontend**: Create useSyncStatus hook with smart polling
4. **Frontend**: Create ClientPreparing page with progress UI
5. **Frontend**: Add route in App.tsx
6. **Frontend**: Update Onboarding navigation to use clientId
7. **Test**: End-to-end flow with real sync + report generation
