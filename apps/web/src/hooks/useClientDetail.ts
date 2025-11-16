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
        `/api/clients/${clientId}/analyze`,
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
 * Main hook that aggregates all client detail data
 */
export function useClientDetail(clientId: string, days: number = 30) {
  const client = useClient(clientId);
  const scData = useSearchConsoleData(clientId, days);
  const adsData = useGoogleAdsData(clientId, days);
  const overlaps = useQueryOverlaps(clientId, days);
  const recommendations = useRecommendations(clientId);

  const isLoading =
    client.isLoading ||
    scData.isLoading ||
    adsData.isLoading ||
    overlaps.isLoading ||
    recommendations.isLoading;

  const isError =
    client.isError ||
    scData.isError ||
    adsData.isError ||
    overlaps.isError ||
    recommendations.isError;

  return {
    client: client.data,
    searchConsoleData: scData.data,
    googleAdsData: adsData.data,
    queryOverlaps: overlaps.data,
    recommendations: recommendations.data,
    isLoading,
    isError,
    refetch: {
      client: client.refetch,
      searchConsoleData: scData.refetch,
      googleAdsData: adsData.refetch,
      queryOverlaps: overlaps.refetch,
      recommendations: recommendations.refetch,
    },
  };
}
