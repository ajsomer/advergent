import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export function useAuth() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await apiClient.get('/api/auth/me');
      return response.data;
    },
    staleTime: 1000 * 60,
    retry: false
  });
}
