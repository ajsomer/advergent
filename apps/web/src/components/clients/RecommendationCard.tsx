import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Recommendation } from '@/hooks/useClientDetail';

interface RecommendationCardProps {
  recommendation: Recommendation;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isUpdating: boolean;
}

const recommendationTypeColors: Record<string, string> = {
  reduce: 'bg-green-100 text-green-800',
  pause: 'bg-green-200 text-green-900',
  increase: 'bg-red-100 text-red-800',
  maintain: 'bg-blue-100 text-blue-800',
};

const recommendationTypeLabels: Record<string, string> = {
  reduce: 'Reduce Spend',
  pause: 'Pause Campaign',
  increase: 'Increase Spend',
  maintain: 'Maintain',
};

const confidenceLevelColors: Record<string, 'success' | 'warning' | 'secondary'> = {
  high: 'success',
  medium: 'warning',
  low: 'secondary',
};

export function RecommendationCard({
  recommendation,
  onApprove,
  onReject,
  isUpdating,
}: RecommendationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isPending = recommendation.status === 'pending';
  const savingsAmount = recommendation.estimatedMonthlySavings;
  const savingsPercent = recommendation.currentMonthlySpend > 0
    ? ((savingsAmount / recommendation.currentMonthlySpend) * 100).toFixed(1)
    : '0';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{recommendation.queryText}</CardTitle>
            <CardDescription className="mt-1">
              <div className="flex gap-2 mt-2">
                <Badge
                  className={recommendationTypeColors[recommendation.recommendationType]}
                >
                  {recommendationTypeLabels[recommendation.recommendationType]}
                </Badge>
                <Badge variant={confidenceLevelColors[recommendation.confidenceLevel]}>
                  {recommendation.confidenceLevel.toUpperCase()} Confidence
                </Badge>
                <Badge variant="outline">{recommendation.status.toUpperCase()}</Badge>
              </div>
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">
              ${savingsAmount.toFixed(2)}
            </div>
            <div className="text-sm text-slate-500">
              {savingsPercent}% savings
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-sm font-medium text-slate-500">Current Spend</div>
            <div className="text-lg font-semibold">
              ${recommendation.currentMonthlySpend.toFixed(2)}/mo
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Recommended Spend</div>
            <div className="text-lg font-semibold">
              ${recommendation.recommendedMonthlySpend.toFixed(2)}/mo
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-4 border-t pt-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">AI Reasoning</h4>
              <p className="text-sm text-slate-600">{recommendation.reasoning}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Key Factors</h4>
              <ul className="list-disc list-inside space-y-1">
                {recommendation.keyFactors.map((factor, idx) => (
                  <li key={idx} className="text-sm text-slate-600">
                    {factor}
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-xs text-slate-400">
              Created: {new Date(recommendation.createdAt).toLocaleDateString()}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between pt-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              Show Details
            </>
          )}
        </Button>

        {isPending && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReject(recommendation.id)}
              disabled={isUpdating}
            >
              Reject
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => onApprove(recommendation.id)}
              disabled={isUpdating}
            >
              Approve
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
