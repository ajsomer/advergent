# Phase 5: Polish and UX Enhancements

## Objective

Refine the Reports feature with improved loading states, error handling, and prepare the foundation for future enhancements like manual regeneration, report history, and scheduled reports.

## Prerequisites

- Phases 1-4 must be completed
- Reports tab is functional with PDF/CSV export
- Multi-agent system generates reports successfully

## Context

### Current State
- Reports tab displays pre-generated interplay reports
- PDF and CSV export work
- Basic loading/error states exist

### Target State
- Polished loading states with skeleton loaders and progress indicators
- Comprehensive error handling with user-friendly messages
- Manual "Regenerate Report" button (calls existing endpoint)
- Report generation progress tracking
- Foundation for report history and scheduling (Post-MVP)

## Tasks

### Task 1: Enhanced Loading States

**File**: `apps/web/src/components/clients/reports/ReportLoadingSkeleton.tsx`

```typescript
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function ReportLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="space-y-2 text-right">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>

      {/* Export actions skeleton */}
      <div className="flex gap-3">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Report content skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />

          <div className="space-y-2 pt-4">
            <Skeleton className="h-4 w-32" />
            <div className="space-y-2 pl-4">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-56" />
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-12" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <Skeleton className="h-5 w-64" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### Task 2: Report Generation Progress Component

**File**: `apps/web/src/components/clients/reports/ReportGeneratingState.tsx`

```typescript
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Search, Brain, Sparkles, CheckCircle } from 'lucide-react';

interface ReportGeneratingStateProps {
  status: 'pending' | 'researching' | 'analyzing' | 'completed' | 'failed';
}

const STAGES = [
  { id: 'pending', label: 'Queued', icon: Loader2, description: 'Report queued for processing' },
  { id: 'researching', label: 'Researching', icon: Search, description: 'Gathering data and identifying key areas' },
  { id: 'analyzing', label: 'Analyzing', icon: Brain, description: 'AI agents analyzing SEM and SEO opportunities' },
  { id: 'completed', label: 'Complete', icon: CheckCircle, description: 'Report ready' },
];

export function ReportGeneratingState({ status }: ReportGeneratingStateProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const currentStageIndex = STAGES.findIndex((s) => s.id === status);
  const progress = status === 'completed' ? 100 : ((currentStageIndex + 1) / STAGES.length) * 100;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardContent className="pt-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 text-blue-600 mb-4">
            <Sparkles className="h-8 w-8 animate-pulse" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Generating Your Report</h3>
          <p className="text-sm text-slate-500 mt-1">
            Our AI agents are analyzing your data to create actionable insights
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-slate-500 mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Stage indicators */}
        <div className="space-y-3">
          {STAGES.map((stage, index) => {
            const Icon = stage.icon;
            const isActive = stage.id === status;
            const isComplete = index < currentStageIndex || status === 'completed';
            const isPending = index > currentStageIndex;

            return (
              <div
                key={stage.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-100 border border-blue-200'
                    : isComplete
                    ? 'bg-green-50'
                    : 'bg-slate-50'
                }`}
              >
                <div
                  className={`flex items-center justify-center h-8 w-8 rounded-full ${
                    isActive
                      ? 'bg-blue-500 text-white'
                      : isComplete
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {isComplete && !isActive ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Icon className={`h-5 w-5 ${isActive ? 'animate-spin' : ''}`} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium ${
                        isActive ? 'text-blue-700' : isComplete ? 'text-green-700' : 'text-slate-400'
                      }`}
                    >
                      {stage.label}
                    </span>
                    {isActive && (
                      <Badge variant="secondary" className="text-xs">
                        In Progress
                      </Badge>
                    )}
                  </div>
                  <p
                    className={`text-sm ${
                      isActive ? 'text-blue-600' : isComplete ? 'text-green-600' : 'text-slate-400'
                    }`}
                  >
                    {stage.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Elapsed time */}
        <div className="text-center mt-6 text-sm text-slate-500">
          Elapsed time: {formatTime(elapsedTime)}
        </div>

        {/* Estimated time */}
        <p className="text-center text-xs text-slate-400 mt-2">
          Typical generation time: 30-60 seconds
        </p>
      </CardContent>
    </Card>
  );
}
```

### Task 3: Error State Component

**File**: `apps/web/src/components/clients/reports/ReportErrorState.tsx`

```typescript
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ReportErrorStateProps {
  error?: Error | null;
  onRetry?: () => void;
  type?: 'load' | 'generate' | 'export';
}

export function ReportErrorState({ error, onRetry, type = 'load' }: ReportErrorStateProps) {
  const messages = {
    load: {
      title: 'Failed to Load Report',
      description: 'We couldn\'t load the report data. This might be a temporary issue.',
    },
    generate: {
      title: 'Report Generation Failed',
      description: 'The AI analysis encountered an error. Please try regenerating the report.',
    },
    export: {
      title: 'Export Failed',
      description: 'We couldn\'t generate the export file. Please try again.',
    },
  };

  const { title, description } = messages[type];

  return (
    <Alert variant="destructive" className="max-w-xl mx-auto">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2">
        <p>{description}</p>
        {error?.message && (
          <p className="mt-2 text-sm font-mono bg-red-50 p-2 rounded">
            Error: {error.message}
          </p>
        )}
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-4 gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
```

### Task 4: Empty State Component

**File**: `apps/web/src/components/clients/reports/ReportEmptyState.tsx`

```typescript
import { FileText, RefreshCw, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ReportEmptyStateProps {
  clientName: string;
  onGenerateReport?: () => void;
  isGenerating?: boolean;
}

export function ReportEmptyState({
  clientName,
  onGenerateReport,
  isGenerating,
}: ReportEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-slate-100 text-slate-400 mb-4">
          <FileText className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          No Report Available
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          The SEO/SEM Interplay Report for {clientName} hasn't been generated yet.
          Reports are automatically created after the initial data sync completes.
        </p>

        <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>Generated after first sync</span>
          </div>
        </div>

        {onGenerateReport && (
          <div className="mt-6">
            <Button
              onClick={onGenerateReport}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Generate Report Now
                </>
              )}
            </Button>
            <p className="text-xs text-slate-400 mt-2">
              Or wait for the automatic generation after sync
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Task 5: Add Regenerate Report Hook

**File**: `apps/web/src/hooks/useRegenerateReport.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface RegenerateReportResponse {
  message: string;
  reportId: string;
}

export function useRegenerateReport(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation<RegenerateReportResponse, Error>({
    mutationFn: async () => {
      const { data } = await apiClient.post(
        `/api/clients/${clientId}/interplay-report/regenerate`
      );
      return data;
    },
    onSuccess: () => {
      // Invalidate the report query to trigger refetch
      queryClient.invalidateQueries({
        queryKey: ['client', clientId, 'interplay-report'],
      });
    },
  });
}
```

### Task 6: Update ReportsTab with Polish

**File**: `apps/web/src/components/clients/ReportsTab.tsx`

```typescript
import { useState } from 'react';
import { useInterplayReport } from '@/hooks/useInterplayReport';
import { useRegenerateReport } from '@/hooks/useRegenerateReport';
import { Button } from '@/components/ui/button';
import { RefreshCw, FileText } from 'lucide-react';
import { ReportHeader } from './reports/ReportHeader';
import { ReportPreviewContainer } from './reports/ReportPreviewContainer';
import { InterplayReportView } from './reports/templates/InterplayReportView';
import { ExportActions } from './reports/ExportActions';
import { ReportLoadingSkeleton } from './reports/ReportLoadingSkeleton';
import { ReportGeneratingState } from './reports/ReportGeneratingState';
import { ReportErrorState } from './reports/ReportErrorState';
import { ReportEmptyState } from './reports/ReportEmptyState';
import { useToast } from '@/components/ui/use-toast';

interface ReportsTabProps {
  clientId: string;
  client: {
    id: string;
    name: string;
  };
}

export function ReportsTab({ clientId, client }: ReportsTabProps) {
  const { toast } = useToast();
  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
  } = useInterplayReport(clientId);

  const regenerateReport = useRegenerateReport(clientId);

  // Polling for report status updates
  const [isPolling, setIsPolling] = useState(false);

  const handleRegenerateReport = async () => {
    try {
      await regenerateReport.mutateAsync();
      toast({
        title: 'Report Generation Started',
        description: 'Your new report is being generated. This may take up to a minute.',
      });
      // Start polling for updates
      setIsPolling(true);
      const pollInterval = setInterval(async () => {
        const result = await refetch();
        if (result.data?.status === 'completed' || result.data?.status === 'failed') {
          clearInterval(pollInterval);
          setIsPolling(false);
        }
      }, 3000);
    } catch (err) {
      toast({
        title: 'Generation Failed',
        description: 'Failed to start report generation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Loading state
  if (isLoading) {
    return <ReportLoadingSkeleton />;
  }

  // Error state
  if (isError) {
    return (
      <ReportErrorState
        error={error}
        onRetry={() => refetch()}
        type="load"
      />
    );
  }

  // Empty state - no report generated yet
  if (!report) {
    return (
      <ReportEmptyState
        clientName={client.name}
        onGenerateReport={handleRegenerateReport}
        isGenerating={regenerateReport.isPending}
      />
    );
  }

  // Report still generating
  if (report.status !== 'completed' && report.status !== 'failed') {
    return <ReportGeneratingState status={report.status} />;
  }

  // Report failed
  if (report.status === 'failed') {
    return (
      <div className="space-y-6">
        <ReportErrorState
          type="generate"
          onRetry={handleRegenerateReport}
        />
        <p className="text-center text-sm text-slate-500">
          You can try regenerating the report or contact support if the issue persists.
        </p>
      </div>
    );
  }

  // Completed report - render the full view
  return (
    <div className="space-y-6">
      {/* Header with regenerate button */}
      <div className="flex items-start justify-between">
        <ReportHeader
          title="SEO/SEM Interplay Report"
          generatedAt={report.generatedAt}
          dateRange={report.dateRange}
          trigger={report.trigger}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerateReport}
          disabled={regenerateReport.isPending || isPolling}
          className="gap-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              regenerateReport.isPending || isPolling ? 'animate-spin' : ''
            }`}
          />
          {regenerateReport.isPending || isPolling ? 'Regenerating...' : 'Regenerate'}
        </Button>
      </div>

      <ExportActions report={report} clientName={client.name} />

      <ReportPreviewContainer>
        <InterplayReportView report={report} />
      </ReportPreviewContainer>

      {/* Report metadata footer */}
      <div className="text-center text-xs text-slate-400 space-y-1">
        {report.processingTimeMs && (
          <p>Generated in {(report.processingTimeMs / 1000).toFixed(1)} seconds</p>
        )}
        {report.tokensUsed && <p>AI tokens used: {report.tokensUsed.toLocaleString()}</p>}
      </div>
    </div>
  );
}
```

### Task 7: Add Toast Notifications

Ensure the toast component is set up. If not already installed:

```bash
npx shadcn-ui@latest add toast
```

**File**: `apps/web/src/components/ui/use-toast.ts`

This should be auto-generated by shadcn. Verify it exists and exports `useToast`.

### Task 8: Add Progress Component

If not already installed:

```bash
npx shadcn-ui@latest add progress
```

### Task 9: Update Report Header with Status Badge

**File**: `apps/web/src/components/clients/reports/ReportHeader.tsx`

Update to include better status handling:

```typescript
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';

interface ReportHeaderProps {
  title: string;
  generatedAt: string;
  dateRange: {
    startDate: string;
    endDate: string;
    days: number;
  };
  trigger: 'client_creation' | 'manual' | 'scheduled';
  status?: 'pending' | 'researching' | 'analyzing' | 'completed' | 'failed';
}

export function ReportHeader({
  title,
  generatedAt,
  dateRange,
  trigger,
  status = 'completed',
}: ReportHeaderProps) {
  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d, yyyy');
  };

  const triggerLabel = {
    client_creation: 'Initial Analysis',
    manual: 'Manual',
    scheduled: 'Scheduled',
  };

  const triggerColors = {
    client_creation: 'bg-green-100 text-green-800 border-green-200',
    manual: 'bg-blue-100 text-blue-800 border-blue-200',
    scheduled: 'bg-purple-100 text-purple-800 border-purple-200',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <Badge className={triggerColors[trigger]}>{triggerLabel[trigger]}</Badge>
      </div>

      <div className="flex items-center gap-6 text-sm text-slate-500">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          <span>
            {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
          </span>
          <span className="text-slate-400">({dateRange.days} days)</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          <span>Generated {formatDate(generatedAt)}</span>
        </div>
      </div>
    </div>
  );
}
```

## File Structure Summary

After completing this phase:

```
apps/web/src/
├── hooks/
│   ├── useInterplayReport.ts          # EXISTING
│   └── useRegenerateReport.ts         # NEW
└── components/clients/
    ├── ReportsTab.tsx                 # MODIFIED (polished)
    └── reports/
        ├── ReportHeader.tsx           # MODIFIED
        ├── ExportActions.tsx          # EXISTING
        ├── ReportPreviewContainer.tsx # EXISTING
        ├── ReportLoadingSkeleton.tsx  # NEW
        ├── ReportGeneratingState.tsx  # NEW
        ├── ReportErrorState.tsx       # NEW
        ├── ReportEmptyState.tsx       # NEW
        ├── components/                # EXISTING
        ├── templates/                 # EXISTING
        └── pdf/                       # EXISTING
```

## Testing Checklist

### Loading States
- [ ] Skeleton loader appears while fetching report
- [ ] Skeleton matches the layout of the actual report

### Generation Progress
- [ ] Progress component shows when report is generating
- [ ] Status updates through stages (pending → researching → analyzing)
- [ ] Progress bar reflects current stage
- [ ] Elapsed time counter works
- [ ] Polling updates the UI as status changes

### Error States
- [ ] Load error shows appropriate message
- [ ] Generation error shows appropriate message
- [ ] Retry button works
- [ ] Error details shown when available

### Empty State
- [ ] Shows when no report exists
- [ ] Generate Report button works
- [ ] Loading state on button during generation
- [ ] Toast notification appears on success/failure

### Regenerate Report
- [ ] Regenerate button appears on completed reports
- [ ] Button disabled during regeneration
- [ ] Polling starts after triggering regeneration
- [ ] UI updates when new report is ready
- [ ] Toast notifications for success/failure

### Report Header
- [ ] Shows trigger type badge with correct color
- [ ] Date range formatted correctly
- [ ] Generation date formatted correctly

## Future Enhancements (Post-Phase 5)

### Report History
- New endpoint: `GET /api/clients/:id/interplay-reports` (list all)
- History dropdown or tab in ReportsTab
- Compare reports over time

### Scheduled Reports
- User preferences for report frequency
- Cron job for scheduled regeneration
- Email delivery of reports

### Report Customization
- Section visibility toggles
- Custom date range selection
- Comparison periods (this month vs last month)

### Performance Optimizations
- Server-side caching of report data
- Incremental report updates
- Background regeneration with webhooks

## Notes for Implementation

1. **Toast Provider**: Ensure the Toaster component is added to the app root (usually in `App.tsx` or layout component).

2. **Polling Strategy**: The current implementation uses simple polling. For production, consider:
   - WebSocket connections for real-time updates
   - Server-Sent Events (SSE)
   - Background sync with service workers

3. **Error Boundaries**: Consider adding React error boundaries around the ReportsTab to catch rendering errors.

4. **Analytics**: Track report generation and export events for product analytics.

5. **Accessibility**: Ensure loading states and progress indicators are accessible with proper ARIA labels.
