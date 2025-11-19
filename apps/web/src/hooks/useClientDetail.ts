import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api';

// ============================================================================
// TYPES
// ============================================================================

export interface SearchConsoleQuery {
  id: string;
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  date: string;
  page?: string;
  device?: string;
  country?: string;
  searchAppearance?: string;
  searchType?: string;
}

export interface SearchConsoleDataResponse {
  queries: SearchConsoleQuery[];
  totalQueries: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface GoogleAdsQuery {
  id: string;
  query: string;
  spend: number;
  clicks: number;
  impressions: number;
  cpc: number;
  conversions: number;
  conversionValue: number;
  date: string;
}

export interface GoogleAdsDataResponse {
  queries: GoogleAdsQuery[];
  totalQueries: number;
  totalSpend: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface GA4Metric {
  date: string;
  sessions: number;
  engagementRate: number;
  viewsPerSession: number;
  conversions: number;
  totalRevenue: number;
  averageSessionDuration: number;
  bounceRate: number;
}

export interface GA4DataResponse {
  metrics: GA4Metric[];
  totalMetrics: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface GA4LandingPageMetric {
  landingPage: string;
  sessionSource: string;
  sessionMedium: string;
  sessions: number;
  engagementRate: number;
  conversions: number;
  totalRevenue: number;
  averageSessionDuration: number;
  bounceRate: number;
  date: string;
}

export interface GA4LandingPageDataResponse {
  pages: GA4LandingPageMetric[];
  totalPages: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}


export interface QueryOverlap {
  queryId: string;
  queryText: string;
  googleAds: {
    spend: number;
    clicks: number;
    cpc: number;
    conversions: number;
  };
  searchConsole: {
    position: number;
    ctr: number;
    impressions: number;
    clicks: number;
  };
  hasRecommendation: boolean;
  recommendationId?: string;
}

export interface QueryOverlapsResponse {
  overlaps: QueryOverlap[];
  totalOverlaps: number;
  potentialSavings: number;
}

export interface Recommendation {
  id: string;
  queryText: string;
  recommendationType: 'reduce' | 'pause' | 'increase' | 'maintain';
  confidenceLevel: 'high' | 'medium' | 'low';
  currentMonthlySpend: number;
  recommendedMonthlySpend: number;
  estimatedMonthlySavings: number;
  reasoning: string;
  keyFactors: string[];
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  createdAt: string;
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  summary: {
    total: number;
    byType: {
      reduce: number;
      pause: number;
      increase: number;
      maintain: number;
    };
    byStatus: {
      pending: number;
      approved: number;
      rejected: number;
      applied: number;
    };
    totalPotentialSavings: number;
  };
}

export interface Client {
  id: string;
  name: string;
  googleAdsCustomerId?: string;
  searchConsoleSiteUrl?: string;
  ga4PropertyId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisConfig {
  minSpend?: number;
  maxQueries?: number;
  batchSize?: number;
  delayMs?: number;
}

export interface AnalysisResult {
  success: boolean;
  clientId: string;
  analyzedQueries: number;
  recommendationsCreated: number;
  estimatedTotalSavings: number;
  processingTime: number;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch client basic info
 */
export function useClient(clientId: string) {
  const apiClient = useApiClient();

  return useQuery<Client>({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data } = await apiClient.get<Client>(`/api/clients/${clientId}`);
      return data;
    },
    enabled: !!clientId,
  });
}

/**
 * Fetch Search Console data for a client
 */
export function useSearchConsoleData(clientId: string, days: number = 30) {
  const apiClient = useApiClient();

  return useQuery<SearchConsoleDataResponse>({
    queryKey: ['client', clientId, 'search-console-data', days],
    queryFn: async () => {
      const { data } = await apiClient.get<SearchConsoleDataResponse>(
        `/api/clients/${clientId}/search-console-data`,
        { params: { days } }
      );
      return data;
    },
    enabled: !!clientId,
  });
}

/**
 * Fetch Google Ads data for a client
 */
export function useGoogleAdsData(clientId: string, days: number = 30) {
  const apiClient = useApiClient();

  return useQuery<GoogleAdsDataResponse>({
    queryKey: ['client', clientId, 'google-ads-data', days],
    queryFn: async () => {
      const { data } = await apiClient.get<GoogleAdsDataResponse>(
        `/api/clients/${clientId}/google-ads-data`,
        { params: { days } }
      );
      return data;
    },
    enabled: !!clientId,
  });
}

/**
 * Fetch GA4 metrics data for a client
 */
export function useGA4Data(clientId: string, days: number = 30) {
  const apiClient = useApiClient();

  return useQuery<GA4DataResponse>({
    queryKey: ['client', clientId, 'ga4-data', days],
    queryFn: async () => {
      const { data } = await apiClient.get<GA4DataResponse>(
        `/api/clients/${clientId}/ga4-data`,
        { params: { days } }
      );
      return data;
    },
    enabled: !!clientId,
  });
}

/**
 * Fetch GA4 landing page metrics data for a client
 */
export function useGA4LandingPageData(clientId: string, days: number = 30) {
  const apiClient = useApiClient();

  return useQuery<GA4LandingPageDataResponse>({
    queryKey: ['client', clientId, 'ga4-landing-pages', days],
    queryFn: async () => {
      const { data } = await apiClient.get<GA4LandingPageDataResponse>(
        `/api/clients/${clientId}/ga4-landing-pages`,
        { params: { days } }
      );
      return data;
    },
    enabled: !!clientId,
  });
}


/**
 * Fetch query overlaps for a client
 */
export function useQueryOverlaps(clientId: string, days: number = 30) {
  const apiClient = useApiClient();

  return useQuery<QueryOverlapsResponse>({
    queryKey: ['client', clientId, 'query-overlaps', days],
    queryFn: async () => {
      const { data } = await apiClient.get<QueryOverlapsResponse>(
        `/api/clients/${clientId}/query-overlaps`,
        { params: { days } }
      );
      return data;
    },
    enabled: !!clientId,
  });
}

/**
 * Fetch recommendations for a client
 */
export function useRecommendations(
  clientId: string,
  filters?: {
    status?: string;
    recommendationType?: string;
    confidenceLevel?: string;
  }
) {
  const apiClient = useApiClient();

  return useQuery<RecommendationsResponse>({
    queryKey: ['client', clientId, 'recommendations', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<RecommendationsResponse>(
        `/api/clients/${clientId}/recommendations`,
        { params: filters }
      );
      return data;
    },
    enabled: !!clientId,
  });
}

/**
 * Trigger AI analysis for a client
 */
export function useRunAnalysis(clientId: string) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<AnalysisResult, Error, AnalysisConfig>({
    mutationFn: async (config: AnalysisConfig) => {
      const { data } = await apiClient.post<AnalysisResult>(
        `/api/analysis/run/${clientId}`,
        config
      );
      return data;
    },
    onSuccess: () => {
      // Invalidate recommendations query to refetch
      queryClient.invalidateQueries({ queryKey: ['client', clientId, 'recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['client', clientId, 'query-overlaps'] });
    },
  });
}

/**
 * Update recommendation status
 */
export function useUpdateRecommendationStatus(clientId: string) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<
    { id: string; status: string },
    Error,
    { recommendationId: string; status: 'pending' | 'approved' | 'rejected' | 'applied' }
  >({
    mutationFn: async ({ recommendationId, status }) => {
      const { data } = await apiClient.patch(
        `/api/recommendations/${recommendationId}/status`,
        { status }
      );
      return data;
    },
    onSuccess: () => {
      // Invalidate recommendations query to refetch
      queryClient.invalidateQueries({ queryKey: ['client', clientId, 'recommendations'] });
    },
  });
}

/**
 * Trigger manual data sync for a client
 */
export function useSyncClientData(clientId: string) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string; jobId: string }, Error>({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/api/clients/${clientId}/sync`);
      return data;
    },
    onSuccess: () => {
      // Invalidate all client data queries to refetch
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
    },
  });
}

/**
 * Main hook that aggregates all client detail data
 */
export function useClientDetail(clientId: string, days: number = 30) {
  const client = useClient(clientId);
  const scData = useSearchConsoleData(clientId, days);
  const adsData = useGoogleAdsData(clientId, days);
  const ga4Data = useGA4Data(clientId, days);
  const ga4LandingPages = useGA4LandingPageData(clientId, days);
  const overlaps = useQueryOverlaps(clientId, days);
  const recommendations = useRecommendations(clientId);

  const isLoading =
    client.isLoading ||
    scData.isLoading ||
    adsData.isLoading ||
    ga4Data.isLoading ||
    ga4LandingPages.isLoading ||
    overlaps.isLoading ||
    recommendations.isLoading;

  const isError =
    client.isError ||
    scData.isError ||
    adsData.isError ||
    ga4Data.isError ||
    ga4LandingPages.isError ||
    overlaps.isError ||
    recommendations.isError;

  return {
    client: client.data,
    searchConsoleData: scData.data,
    googleAdsData: adsData.data,
    ga4Data: ga4Data.data,
    ga4LandingPageData: ga4LandingPages.data,
    queryOverlaps: overlaps.data,
    recommendations: recommendations.data,
    isLoading,
    isError,
    refetch: {
      client: client.refetch,
      searchConsoleData: scData.refetch,
      googleAdsData: adsData.refetch,
      ga4Data: ga4Data.refetch,
      ga4LandingPages: ga4LandingPages.refetch,
      queryOverlaps: overlaps.refetch,
      recommendations: recommendations.refetch,
    },
  };
}

