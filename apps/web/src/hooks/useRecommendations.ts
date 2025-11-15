import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api';

export function useRecommendations(clientId?: string) {
  const api = useApiClient();

  return useQuery({
    queryKey: ['recommendations', clientId],
    queryFn: async () => {
      if (!clientId) throw new Error('clientId is required');
      const response = await api.get(`/api/clients/${clientId}/recommendations`);
      return response.data;
    },
    enabled: Boolean(clientId)
  });
}
