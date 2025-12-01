import { ReportExecutiveSummary } from '../components/ReportExecutiveSummary';
import { ReportUnifiedRecommendations } from '../components/ReportUnifiedRecommendations';
import type { InterplayReportResponse } from '@advergent/shared';

interface InterplayReportViewProps {
  report: Pick<InterplayReportResponse, 'executiveSummary' | 'recommendations'>;
}

export function InterplayReportView({ report }: InterplayReportViewProps) {
  return (
    <div className="space-y-8">
      {/* Executive Summary Section */}
      {report.executiveSummary && (
        <ReportExecutiveSummary
          summary={report.executiveSummary.summary}
          keyHighlights={report.executiveSummary.keyHighlights}
        />
      )}

      {/* Divider */}
      <hr className="border-slate-200" />

      {/* Unified Recommendations Section */}
      {report.recommendations && report.recommendations.length > 0 && (
        <ReportUnifiedRecommendations
          recommendations={report.recommendations}
        />
      )}

      {/* Empty state if no recommendations */}
      {(!report.recommendations || report.recommendations.length === 0) && (
        <div className="text-center py-8 text-slate-500">
          <p>No recommendations generated for this report.</p>
        </div>
      )}
    </div>
  );
}
