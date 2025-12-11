import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useClientDetail, useRunAnalysis, useUpdateRecommendationStatus, useSyncClientData } from '@/hooks/useClientDetail';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { RecommendationCard } from '@/components/clients/RecommendationCard';
import { QueryOverlapTable } from '@/components/clients/QueryOverlapTable';
import { SearchConsoleTable } from '@/components/clients/SearchConsoleTable';
import { GA4MetricsTable } from '@/components/clients/GA4MetricsTable';
import { AnalysisRunForm } from '@/components/clients/AnalysisRunForm';
import { GA4LandingPageTable } from '@/components/clients/GA4LandingPageTable';
import { FullAnalysisModal } from '@/components/clients/FullAnalysisModal';
import { ArrowLeft, RefreshCw, FileText, Settings } from 'lucide-react';
import { ReportsTab } from '@/components/clients/ReportsTab';
import { ClientSettings } from '@/components/clients/settings';
import type { BusinessType } from '@/components/clients/BusinessTypeSelector';

type TabType = 'overview' | 'recommendations' | 'query-data' | 'search-console' | 'ga4' | 'analysis' | 'reports' | 'settings';

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [recommendationFilters, setRecommendationFilters] = useState({
    status: undefined as string | undefined,
    recommendationType: undefined as string | undefined,
    confidenceLevel: undefined as string | undefined,
  });

  // Handle tab from URL query param
  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabType | null;
    if (tabParam && ['overview', 'recommendations', 'query-data', 'search-console', 'ga4', 'analysis', 'reports', 'settings'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // Update URL without full navigation
    const newParams = new URLSearchParams(searchParams);
    if (tab === 'overview') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', tab);
    }
    setSearchParams(newParams, { replace: true });
  };

  if (!clientId) {
    return <div>Client ID not found</div>;
  }

  const {
    client,
    searchConsoleData,
    googleAdsData,
    ga4Data,
    ga4LandingPageData,
    queryOverlaps,
    recommendations,
    isLoading,
    isError,
    refetch,
  } = useClientDetail(clientId, 30);

  const runAnalysis = useRunAnalysis(clientId);
  const updateStatus = useUpdateRecommendationStatus(clientId);
  const syncData = useSyncClientData(clientId);

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
    { id: 'search-console' as const, label: 'Search Console', badge: searchConsoleData?.totalQueries },
    { id: 'ga4' as const, label: 'GA4 Analytics', badge: ga4Data?.totalMetrics },
    { id: 'analysis' as const, label: 'Analysis' },
    { id: 'reports' as const, label: 'Reports', icon: FileText },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <main className="p-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link to="/" className="hover:text-slate-700 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{client?.name || 'Loading...'}</h1>
            <p className="text-slate-500 mt-1">
              {client?.googleAdsCustomerId && `Google Ads: ${client.googleAdsCustomerId}`}
              {client?.searchConsoleSiteUrl && ` • Search Console: ${client.searchConsoleSiteUrl}`}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                syncData.mutate(undefined, {
                  onSuccess: () => {
                    // After sync job is queued, refetch the data
                    setTimeout(() => {
                      refetch.client();
                      refetch.searchConsoleData();
                      refetch.googleAdsData();
                      refetch.ga4Data();
                      refetch.queryOverlaps();
                      refetch.recommendations();
                    }, 2000); // Wait 2 seconds for job to process
                  },
                });
              }}
              disabled={syncData.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncData.isPending ? 'animate-spin' : ''}`} />
              {syncData.isPending ? 'Syncing...' : 'Refresh Data'}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsAnalysisModalOpen(true)}
              disabled={runAnalysis.isPending}
            >
              {runAnalysis.isPending ? 'Analyzing...' : 'Run AI Analysis'}
            </Button>
          </div>
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
              onClick={() => handleTabChange(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
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

        {activeTab === 'search-console' && (
          <div className="space-y-6">
            {searchConsoleData && searchConsoleData.queries.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Search Console Performance</CardTitle>
                  <CardDescription>
                    Organic search performance from Google Search Console over the last 30 days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SearchConsoleTable queries={searchConsoleData.queries} clientId={clientId} />
                  <div className="mt-4 text-sm text-slate-500 text-right">
                    Data from {new Date(searchConsoleData.dateRange.startDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    to{' '}
                    {new Date(searchConsoleData.dateRange.endDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-slate-500 text-lg">No Search Console data available</p>
                  <p className="text-sm text-slate-400 mt-2">
                    Connect Search Console in the onboarding flow to see organic performance data
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'ga4' && (
          <div className="space-y-6">
            {ga4Data && ga4Data.metrics.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>GA4 Analytics</CardTitle>
                  <CardDescription>
                    Website performance metrics from Google Analytics 4 over the last 30 days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GA4MetricsTable metrics={ga4Data.metrics} />
                  <div className="mt-4 text-sm text-slate-500 text-right">
                    Data from {new Date(ga4Data.dateRange.startDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    to{' '}
                    {new Date(ga4Data.dateRange.endDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-slate-500 text-lg">No GA4 data available</p>
                  <p className="text-sm text-slate-400 mt-2">
                    Connect GA4 in the onboarding flow to see analytics data
                  </p>
                </CardContent>
              </Card>
            )}

            {/* GA4 Landing Pages */}
            {ga4LandingPageData && ga4LandingPageData.pages.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Landing Page Performance (Organic)</CardTitle>
                  <CardDescription>
                    Organic traffic engagement metrics by landing page from GA4
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GA4LandingPageTable pages={ga4LandingPageData.pages} />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Analysis Tab - Simple AI Analysis button */}
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

        {/* Reports Tab - SEO/SEM Interplay Reports */}
        {activeTab === 'reports' && client && (
          <ReportsTab clientId={clientId} client={client} />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && client && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Client Settings</CardTitle>
                <CardDescription>
                  Configure settings for {client.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ClientSettings
                  clientId={clientId}
                  currentBusinessType={(client.businessType as BusinessType) || 'ecommerce'}
                  onUpdate={() => {
                    refetch.client();
                  }}
                />
              </CardContent>
            </Card>
          </div>
        )}

      </div>

      {/* Full Analysis Modal */}
      <FullAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => {
          setIsAnalysisModalOpen(false);
          refetch.recommendations();
        }}
        onRunAnalysis={async () => {
          return new Promise((resolve, reject) => {
            runAnalysis.mutate({}, {
              onSuccess: (data) => resolve(data),
              onError: (error) => reject(error),
            });
          });
        }}
      />
    </main>
  );
}
