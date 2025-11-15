import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export function useRecommendations(clientId?: string) {
  return useQuery({
    queryKey: ['recommendations', clientId],
    queryFn: async () => {
      if (!clientId) throw new Error('clientId is required');
      const response = await apiClient.get(`/api/clients/${clientId}/recommendations`);
      return response.data;
    },
    enabled: Boolean(clientId)
  });
}
