import { Badge } from '@/components/ui/badge';
import type { QueryOverlap } from '@/hooks/useClientDetail';

interface QueryOverlapTableProps {
  overlaps: QueryOverlap[];
  onQueryClick?: (queryId: string) => void;
}

export function QueryOverlapTable({ overlaps, onQueryClick }: QueryOverlapTableProps) {
  if (overlaps.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">No query overlaps found</p>
        <p className="text-sm text-slate-400 mt-2">
          Queries will appear here when they exist in both Google Ads and Search Console
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Query
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Organic Position
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Organic CTR
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Ad Spend
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Ad CPC
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Recommendation
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {overlaps.map((overlap) => {
            const hasGoodOrganicPosition = overlap.searchConsole.position <= 5;
            const hasHighSpend = overlap.googleAds.spend > 50;
            const isOptimizationOpportunity = hasGoodOrganicPosition && hasHighSpend;

            return (
              <tr
                key={overlap.queryId}
                className={`hover:bg-slate-50 transition-colors ${
                  onQueryClick ? 'cursor-pointer' : ''
                } ${isOptimizationOpportunity ? 'bg-green-50/30' : ''}`}
                onClick={() => onQueryClick?.(overlap.queryId)}
              >
                <td className="px-4 py-3 text-sm text-slate-900">
                  {overlap.queryText}
                  {isOptimizationOpportunity && (
                    <Badge variant="success" className="ml-2">
                      Opportunity
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  <span
                    className={
                      overlap.searchConsole.position <= 3
                        ? 'font-semibold text-green-600'
                        : overlap.searchConsole.position <= 5
                        ? 'font-semibold text-yellow-600'
                        : ''
                    }
                  >
                    {overlap.searchConsole.position.toFixed(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {(overlap.searchConsole.ctr * 100).toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                  ${overlap.googleAds.spend.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  ${overlap.googleAds.cpc.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm">
                  {overlap.hasRecommendation ? (
                    <Badge variant="default">Has Recommendation</Badge>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
