import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export function useClient(clientId?: string) {
  return useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      if (!clientId) throw new Error('clientId is required');
      const response = await apiClient.get(`/api/clients/${clientId}`);
      return response.data;
    },
    enabled: Boolean(clientId)
  });
}
