import { useInterplayReport } from '@/hooks/useInterplayReport';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { FileText, RefreshCw } from 'lucide-react';
import { ReportHeader } from './reports/ReportHeader';
import { ReportPreviewContainer } from './reports/ReportPreviewContainer';
import { InterplayReportView } from './reports/templates/InterplayReportView';
import { ExportActions } from './reports/ExportActions';

interface ReportsTabProps {
  clientId: string;
  client: {
    id: string;
    name: string;
  };
}

export function ReportsTab({ clientId, client }: ReportsTabProps) {
  const { data: report, isLoading, isError, error } = useInterplayReport(clientId);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <Alert variant="destructive">
        <p>Error loading report: {(error as Error)?.message || 'Unknown error'}</p>
      </Alert>
    );
  }

  // Empty state - no report generated yet
  if (!report) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-slate-400 mb-4">
            <FileText className="h-12 w-12 mx-auto" />
          </div>
          <p className="text-slate-500 text-lg">No report available yet</p>
          <p className="text-sm text-slate-400 mt-2">
            The SEO/SEM Interplay Report will be generated automatically after the initial data sync completes.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Report failed
  if (report.status === 'failed') {
    return (
      <Alert variant="destructive">
        <p>Report generation failed: {report.error || 'Unknown error'}. Please try syncing the client data again.</p>
      </Alert>
    );
  }

  // Report still generating
  if (report.status !== 'completed') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-blue-500 mb-4">
            <RefreshCw className="h-12 w-12 mx-auto animate-spin" />
          </div>
          <p className="text-slate-500 text-lg">Report is being generated...</p>
          <p className="text-sm text-slate-400 mt-2">
            Status: {report.status}
          </p>
          <Badge variant="secondary" className="mt-4">
            {report.status === 'researching' && 'Gathering data...'}
            {report.status === 'analyzing' && 'AI analysis in progress...'}
            {report.status === 'pending' && 'Queued for processing...'}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Completed report - render the full view
  return (
    <div className="space-y-6">
      <ReportHeader
        title="SEO/SEM Interplay Report"
        generatedAt={report.metadata.createdAt}
        dateRange={report.dateRange}
        trigger={report.trigger}
      />

      <ExportActions
        report={report}
        clientName={client.name}
      />

      <ReportPreviewContainer>
        <InterplayReportView report={report} />
      </ReportPreviewContainer>
    </div>
  );
}
