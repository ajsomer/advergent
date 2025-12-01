import { ReportRecommendationCard } from './ReportRecommendationCard';
import type { UnifiedRecommendation } from '@advergent/shared';

interface ReportUnifiedRecommendationsProps {
  recommendations: UnifiedRecommendation[];
}

export function ReportUnifiedRecommendations({ recommendations }: ReportUnifiedRecommendationsProps) {
  // Group by impact for summary
  const highImpact = recommendations.filter(r => r.impact === 'high');
  const mediumImpact = recommendations.filter(r => r.impact === 'medium');
  const lowImpact = recommendations.filter(r => r.impact === 'low');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">
          Unified Recommendations ({recommendations.length})
        </h2>
        <div className="flex gap-4 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            High: {highImpact.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            Medium: {mediumImpact.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Low: {lowImpact.length}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <ReportRecommendationCard
            key={index}
            index={index}
            title={rec.title}
            description={rec.description}
            type={rec.type}
            impact={rec.impact}
            effort={rec.effort}
            actionItems={rec.actionItems}
          />
        ))}
      </div>
    </div>
  );
}
