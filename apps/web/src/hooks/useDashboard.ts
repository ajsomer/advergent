import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api';

export interface DashboardStats {
  totalClients: number;
  totalMonthlySpend: number;
  totalEstimatedSavings: number;
  activeRecommendations: number;
}

export interface DashboardClient {
  id: string;
  name: string;
  googleAdsConnected: boolean;
  searchConsoleConnected: boolean;
  monthlySpend: number;
  estimatedSavings: number;
  recommendationsCount: number;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface DashboardClientsResponse {
  clients: DashboardClient[];
}

export function useDashboardStats() {
  const apiClient = useApiClient();

  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardStats>('/api/dashboard/stats');
      return data;
    },
  });
}

export function useDashboardClients() {
  const apiClient = useApiClient();

  return useQuery<DashboardClientsResponse>({
    queryKey: ['dashboard', 'clients'],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardClientsResponse>('/api/dashboard/clients');
      return data;
    },
  });
}
