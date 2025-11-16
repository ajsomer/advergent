import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SearchConsoleQuery } from '@/hooks/useClientDetail';

interface SearchConsoleTableProps {
  queries: SearchConsoleQuery[];
}

type SortField = 'query' | 'impressions' | 'clicks' | 'ctr' | 'position' | 'date' | 'page' | 'device' | 'searchType';
type SortDirection = 'asc' | 'desc';

// Helper functions for formatting
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

const formatPercentage = (decimal: number): string => {
  return `${(decimal * 100).toFixed(2)}%`;
};

const formatPosition = (pos: number): string => {
  return pos.toFixed(1);
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getPositionColorClass = (position: number): string => {
  if (position <= 3) return 'text-green-600 font-semibold';
  if (position <= 10) return 'text-yellow-600 font-semibold';
  return 'text-slate-600';
};

export function SearchConsoleTable({ queries }: SearchConsoleTableProps) {
  const [sortField, setSortField] = useState<SortField>('impressions');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedQueryId, setExpandedQueryId] = useState<string | null>(null);

  if (queries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">No Search Console data available</p>
        <p className="text-sm text-slate-400 mt-2">
          Connect Search Console in the onboarding flow to see organic performance data
        </p>
      </div>
    );
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with default descending for numbers, ascending for text
      setSortField(field);
      setSortDirection(field === 'query' || field === 'date' ? 'asc' : 'desc');
    }
  };

  const sortedQueries = [...queries].sort((a, b) => {
    let compareValue = 0;

    switch (sortField) {
      case 'query':
        compareValue = a.query.localeCompare(b.query);
        break;
      case 'impressions':
        compareValue = a.impressions - b.impressions;
        break;
      case 'clicks':
        compareValue = a.clicks - b.clicks;
        break;
      case 'ctr':
        compareValue = a.ctr - b.ctr;
        break;
      case 'position':
        compareValue = a.position - b.position;
        break;
      case 'date':
        compareValue = new Date(a.date).getTime() - new Date(b.date).getTime();
        break;
    }

    return sortDirection === 'asc' ? compareValue : -compareValue;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-slate-400" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 text-blue-600" />
    ) : (
      <ArrowDown className="h-4 w-4 text-blue-600" />
    );
  };

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="border-b border-slate-200 text-left py-3 px-4 font-medium text-slate-700">
              <button
                onClick={() => handleSort('query')}
                className="flex items-center gap-2 hover:text-blue-600 transition-colors"
              >
                Query Text
                <SortIcon field="query" />
              </button>
            </th>
            <th className="border-b border-slate-200 text-right py-3 px-4 font-medium text-slate-700">
              <button
                onClick={() => handleSort('impressions')}
                className="flex items-center justify-end gap-2 hover:text-blue-600 transition-colors w-full"
              >
                Impressions
                <SortIcon field="impressions" />
              </button>
            </th>
            <th className="border-b border-slate-200 text-right py-3 px-4 font-medium text-slate-700">
              <button
                onClick={() => handleSort('clicks')}
                className="flex items-center justify-end gap-2 hover:text-blue-600 transition-colors w-full"
              >
                Clicks
                <SortIcon field="clicks" />
              </button>
            </th>
            <th className="border-b border-slate-200 text-right py-3 px-4 font-medium text-slate-700">
              <button
                onClick={() => handleSort('ctr')}
                className="flex items-center justify-end gap-2 hover:text-blue-600 transition-colors w-full"
              >
                CTR
                <SortIcon field="ctr" />
              </button>
            </th>
            <th className="border-b border-slate-200 text-right py-3 px-4 font-medium text-slate-700">
              <button
                onClick={() => handleSort('position')}
                className="flex items-center justify-end gap-2 hover:text-blue-600 transition-colors w-full"
              >
                Avg Position
                <SortIcon field="position" />
              </button>
            </th>
            <th className="border-b border-slate-200 text-right py-3 px-4 font-medium text-slate-700">
              <button
                onClick={() => handleSort('date')}
                className="flex items-center justify-end gap-2 hover:text-blue-600 transition-colors w-full"
              >
                Latest Date
                <SortIcon field="date" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {sortedQueries.map((query) => {
            const isExpanded = expandedQueryId === query.id;
            const hasAdditionalData = query.page || query.device || query.country || query.searchAppearance || query.searchType;

            return (
              <>
                <tr
                  key={query.id}
                  className={`hover:bg-slate-50 transition-colors border-b border-slate-100 ${hasAdditionalData ? 'cursor-pointer' : ''}`}
                  onClick={() => hasAdditionalData && setExpandedQueryId(isExpanded ? null : query.id)}
                >
                  <td className="py-3 px-4 text-slate-900 font-medium">
                    <div className="flex items-center gap-2">
                      {query.query}
                      {hasAdditionalData && (
                        <Badge variant="secondary" className="text-xs">
                          {isExpanded ? '−' : '+'}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600 text-right">{formatNumber(query.impressions)}</td>
                  <td className="py-3 px-4 text-slate-600 text-right">{formatNumber(query.clicks)}</td>
                  <td className="py-3 px-4 text-slate-600 text-right">{formatPercentage(query.ctr)}</td>
                  <td className={`py-3 px-4 text-right ${getPositionColorClass(query.position)}`}>
                    {formatPosition(query.position)}
                  </td>
                  <td className="py-3 px-4 text-slate-600 text-right">{formatDate(query.date)}</td>
                </tr>
                {isExpanded && (
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <td colSpan={6} className="py-4 px-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        {query.page && (
                          <div>
                            <div className="text-slate-500 font-medium mb-1">Landing Page</div>
                            <div className="text-slate-900 break-all">{query.page}</div>
                          </div>
                        )}
                        {query.device && (
                          <div>
                            <div className="text-slate-500 font-medium mb-1">Device</div>
                            <div className="text-slate-900">
                              <Badge variant="outline">{query.device}</Badge>
                            </div>
                          </div>
                        )}
                        {query.country && (
                          <div>
                            <div className="text-slate-500 font-medium mb-1">Country</div>
                            <div className="text-slate-900">
                              <Badge variant="outline">{query.country}</Badge>
                            </div>
                          </div>
                        )}
                        {query.searchType && (
                          <div>
                            <div className="text-slate-500 font-medium mb-1">Search Type</div>
                            <div className="text-slate-900">
                              <Badge variant="outline">{query.searchType}</Badge>
                            </div>
                          </div>
                        )}
                        {query.searchAppearance && (
                          <div>
                            <div className="text-slate-500 font-medium mb-1">Search Appearance</div>
                            <div className="text-slate-900">
                              <Badge variant="outline">{query.searchAppearance}</Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
