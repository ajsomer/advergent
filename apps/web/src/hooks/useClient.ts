import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api';

export function useClient(clientId?: string) {
  const api = useApiClient();

  return useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      if (!clientId) throw new Error('clientId is required');
      const response = await api.get(`/api/clients/${clientId}`);
      return response.data;
    },
    enabled: Boolean(clientId)
  });
}
