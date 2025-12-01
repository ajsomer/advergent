import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Target, Zap } from 'lucide-react';
import type { RecommendationCategory, ImpactLevel, EffortLevel } from '@advergent/shared';

interface ReportRecommendationCardProps {
  title: string;
  description: string;
  type: RecommendationCategory;
  impact: ImpactLevel;
  effort: EffortLevel;
  actionItems: string[];
  index: number;
}

export function ReportRecommendationCard({
  title,
  description,
  type,
  impact,
  effort,
  actionItems,
  index,
}: ReportRecommendationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const typeColors: Record<RecommendationCategory, string> = {
    sem: 'bg-purple-100 text-purple-800 border-purple-200',
    seo: 'bg-green-100 text-green-800 border-green-200',
    hybrid: 'bg-orange-100 text-orange-800 border-orange-200',
  };

  const impactColors: Record<ImpactLevel, string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-slate-100 text-slate-800',
  };

  const effortColors: Record<EffortLevel, string> = {
    high: 'text-red-600',
    medium: 'text-yellow-600',
    low: 'text-green-600',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-sm font-medium">
              {index + 1}
            </span>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className={typeColors[type]}>
                  {type.toUpperCase()}
                </Badge>
                <Badge className={impactColors[impact]}>
                  <Target className="h-3 w-3 mr-1" />
                  {impact.charAt(0).toUpperCase() + impact.slice(1)} Impact
                </Badge>
              </div>
              <h3 className="font-semibold text-slate-900">{title}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${effortColors[effort]}`}>
              <Zap className="h-3 w-3 inline mr-1" />
              {effort.charAt(0).toUpperCase() + effort.slice(1)} Effort
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600 mb-3">{description}</p>

        {actionItems.length > 0 && (
          <div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide Action Items
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  View Action Items ({actionItems.length})
                </>
              )}
            </button>

            {isExpanded && (
              <ul className="mt-3 space-y-2 pl-4 border-l-2 border-slate-200">
                {actionItems.map((item, idx) => (
                  <li key={idx} className="text-sm text-slate-600">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
