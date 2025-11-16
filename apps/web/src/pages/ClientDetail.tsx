import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useClientDetail, useRunAnalysis, useUpdateRecommendationStatus } from '@/hooks/useClientDetail';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { RecommendationCard } from '@/components/clients/RecommendationCard';
import { QueryOverlapTable } from '@/components/clients/QueryOverlapTable';
import { AnalysisRunForm } from '@/components/clients/AnalysisRunForm';
import { ArrowLeft, RefreshCw } from 'lucide-react';

type TabType = 'overview' | 'recommendations' | 'query-data' | 'analysis';

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [recommendationFilters, setRecommendationFilters] = useState({
    status: undefined as string | undefined,
    recommendationType: undefined as string | undefined,
    confidenceLevel: undefined as string | undefined,
  });

  if (!clientId) {
    return <div>Client ID not found</div>;
  }

  const { client, searchConsoleData, googleAdsData, queryOverlaps, recommendations, isLoading, isError, refetch } =
    useClientDetail(clientId);

  const runAnalysis = useRunAnalysis(clientId);
  const updateStatus = useUpdateRecommendationStatus(clientId);

  if (isLoading) {
    return (
      <main className="p-10">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-32 w-full" />
      </main>
    );
  }

  if (isError || !client) {
    return (
      <main className="p-10">
        <Alert variant="destructive">
          <p>Error loading client details</p>
        </Alert>
      </main>
    );
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'recommendations' as const, label: 'Recommendations', badge: recommendations?.summary.total },
    { id: 'query-data' as const, label: 'Query Data' },
    { id: 'analysis' as const, label: 'Analysis' },
  ];

  return (
    <main className="p-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link to="/dashboard" className="hover:text-slate-700 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{client.name}</h1>
            <div className="flex gap-2 mt-2">
              <Badge variant={client.googleAdsCustomerId ? 'success' : 'secondary'}>
                Google Ads: {client.googleAdsCustomerId ? 'Connected' : 'Not Connected'}
              </Badge>
              <Badge variant={client.searchConsoleSiteUrl ? 'success' : 'secondary'}>
                Search Console: {client.searchConsoleSiteUrl ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetch.client();
              refetch.searchConsoleData();
              refetch.googleAdsData();
              refetch.queryOverlaps();
              refetch.recommendations();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Ad Spend</CardDescription>
            <CardTitle className="text-2xl">${googleAdsData?.totalSpend.toFixed(2) || '0.00'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Potential Savings</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              ${recommendations?.summary.totalPotentialSavings.toFixed(2) || '0.00'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Recommendations</CardDescription>
            <CardTitle className="text-2xl">{recommendations?.summary.byStatus.pending || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Query Overlaps</CardDescription>
            <CardTitle className="text-2xl">{queryOverlaps?.totalOverlaps || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <Badge variant="secondary" className="ml-2">
                  {tab.badge}
                </Badge>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Query Overlaps</CardTitle>
                <CardDescription>Queries with both organic rankings and paid ads</CardDescription>
              </CardHeader>
              <CardContent>
                <QueryOverlapTable overlaps={queryOverlaps?.overlaps.slice(0, 10) || []} />
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <select
                    className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                    value={recommendationFilters.recommendationType || ''}
                    onChange={(e) =>
                      setRecommendationFilters({ ...recommendationFilters, recommendationType: e.target.value || undefined })
                    }
                  >
                    <option value="">All Types</option>
                    <option value="reduce">Reduce</option>
                    <option value="pause">Pause</option>
                    <option value="increase">Increase</option>
                    <option value="maintain">Maintain</option>
                  </select>

                  <select
                    className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                    value={recommendationFilters.status || ''}
                    onChange={(e) => setRecommendationFilters({ ...recommendationFilters, status: e.target.value || undefined })}
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="applied">Applied</option>
                  </select>

                  <select
                    className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                    value={recommendationFilters.confidenceLevel || ''}
                    onChange={(e) =>
                      setRecommendationFilters({ ...recommendationFilters, confidenceLevel: e.target.value || undefined })
                    }
                  >
                    <option value="">All Confidence Levels</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations List */}
            <div className="space-y-4">
              {recommendations?.recommendations.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onApprove={(id) => updateStatus.mutate({ recommendationId: id, status: 'approved' })}
                  onReject={(id) => updateStatus.mutate({ recommendationId: id, status: 'rejected' })}
                  isUpdating={updateStatus.isPending}
                />
              ))}

              {recommendations?.recommendations.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-slate-500">No recommendations found</p>
                    <p className="text-sm text-slate-400 mt-2">Run an analysis to generate recommendations</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {activeTab === 'query-data' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Query Overlaps</CardTitle>
                <CardDescription>Combined view of queries in both Google Ads and Search Console</CardDescription>
              </CardHeader>
              <CardContent>
                <QueryOverlapTable overlaps={queryOverlaps?.overlaps || []} />
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-6">
            <AnalysisRunForm
              clientId={clientId}
              onAnalysisComplete={(results) => {
                console.log('Analysis complete:', results);
                refetch.recommendations();
              }}
              isRunning={runAnalysis.isPending}
              onRun={(config) => runAnalysis.mutate(config)}
            />
          </div>
        )}
      </div>
    </main>
  );
}
