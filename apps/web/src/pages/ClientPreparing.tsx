import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, Circle, AlertCircle, RefreshCw } from 'lucide-react';
import { useApiClient } from '@/lib/api';

type ProgressStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stalled';

function ProgressStep({ label, status, error }: {
  label: string;
  status: ProgressStatus;
  error?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      {status === 'completed' && <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />}
      {status === 'running' && <Loader2 className="h-6 w-6 text-blue-500 animate-spin flex-shrink-0" />}
      {status === 'pending' && <Circle className="h-6 w-6 text-slate-300 flex-shrink-0" />}
      {status === 'failed' && <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0" />}
      {status === 'stalled' && <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0" />}
      <div>
        <span className={`font-medium ${
          status === 'failed' ? 'text-red-700' :
          status === 'stalled' ? 'text-amber-700' :
          'text-slate-700'
        }`}>
          {label}
        </span>
        {error && (
          <p className="text-sm text-red-600 mt-1">{error}</p>
        )}
        {status === 'stalled' && !error && (
          <p className="text-sm text-amber-600 mt-1">Report generation didn't start automatically</p>
        )}
      </div>
    </div>
  );
}

// Time after sync completes where we expect report to start (in seconds)
const REPORT_START_GRACE_PERIOD_SECONDS = 30;

export default function ClientPreparing() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const api = useApiClient();
  const { data: status, isLoading, error: fetchError, refetch } = useSyncStatus(clientId);

  const [elapsedTime, setElapsedTime] = useState(0);
  const [syncCompletedAt, setSyncCompletedAt] = useState<number | null>(null);

  // Track when sync completed to detect stalled report generation
  useEffect(() => {
    if (status?.sync.status === 'completed' && status.sync.completedAt) {
      setSyncCompletedAt(new Date(status.sync.completedAt).getTime());
    } else {
      // Reset when a new sync starts/runs or when there is no completion timestamp
      setSyncCompletedAt(null);
    }
  }, [status?.sync.status, status?.sync.completedAt]);

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

  const handleGenerateReport = async () => {
    try {
      await api.post(`/api/clients/${clientId}/interplay-report/regenerate`, { days: 30 });
      refetch();
    } catch (err) {
      console.error('Failed to generate report', err);
    }
  };

  // Show error state if fetch failed repeatedly
  if (fetchError) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="py-12">
              <div className="text-center mb-8">
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  Connection Error
                </h1>
                <p className="text-slate-600">
                  Unable to check sync status. Please check your connection and try again.
                </p>
              </div>
              <div className="flex justify-center gap-4">
                <Button onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Button variant="outline" onClick={() => navigate('/')}>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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

  // Detect if report generation stalled (sync completed but report never started)
  const isReportStalled =
    syncStatus === 'completed' &&
    reportStatus === 'none' &&
    syncCompletedAt &&
    (Date.now() - syncCompletedAt) > REPORT_START_GRACE_PERIOD_SECONDS * 1000;

  // Determine step statuses
  const getSyncStepStatus = (): ProgressStatus => {
    if (syncStatus === 'completed') return 'completed';
    if (syncStatus === 'running' || syncStatus === 'pending') return 'running';
    if (syncStatus === 'failed') return 'failed';
    return 'pending';
  };

  const getReportStepStatus = (): ProgressStatus => {
    if (syncStatus !== 'completed') return 'pending';
    if (reportStatus === 'completed') return 'completed';
    if (['pending', 'researching', 'analyzing'].includes(reportStatus)) return 'running';
    if (reportStatus === 'failed') return 'failed';
    // Report never started after grace period - stalled
    if (isReportStalled) return 'stalled';
    // Still within grace period, show as running (waiting)
    if (reportStatus === 'none') return 'running';
    return 'pending';
  };

  const hasIssue = hasFailed || isReportStalled;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12">
            <div className="text-center mb-8">
              {hasIssue ? (
                <AlertCircle className={`h-16 w-16 mx-auto mb-4 ${hasFailed ? 'text-red-500' : 'text-amber-500'}`} />
              ) : (
                <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-4" />
              )}
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                {hasFailed ? 'Something went wrong' :
                 isReportStalled ? 'Report Generation Needed' :
                 'Preparing Your Dashboard'}
              </h1>
              <p className="text-slate-600">
                {hasFailed
                  ? 'We encountered an issue while setting up your account.'
                  : isReportStalled
                  ? 'Data sync completed, but the AI report needs to be generated manually.'
                  : "We're syncing your data and generating AI insights. This usually takes 1-2 minutes."}
              </p>
            </div>

            {/* Progress Steps */}
            <div className="space-y-4 mb-8">
              <ProgressStep
                label="Syncing data from Google"
                status={getSyncStepStatus()}
                error={status?.sync.errorMessage}
              />
              <ProgressStep
                label="Generating AI insights"
                status={getReportStepStatus()}
                error={status?.report?.errorMessage}
              />
            </div>

            {/* Error/Stalled Actions */}
            {hasIssue && (
              <div className="flex justify-center gap-4">
                {syncStatus === 'failed' && (
                  <Button onClick={handleRetrySync}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Sync
                  </Button>
                )}
                {(reportStatus === 'failed' || isReportStalled) && (
                  <Button onClick={handleGenerateReport}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {isReportStalled ? 'Generate Report' : 'Retry Report'}
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate('/')}>
                  Go to Dashboard
                </Button>
              </div>
            )}

            {/* Timeout Warning */}
            {isTimeout && !hasIssue && (
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
            {!hasIssue && (
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
