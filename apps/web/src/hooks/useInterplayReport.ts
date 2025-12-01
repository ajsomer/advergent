import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api';
import type { InterplayReportResponse } from '@advergent/shared';

// Re-export the type for convenience
export type { InterplayReportResponse } from '@advergent/shared';

/**
 * Fetch interplay report for a client
 * Returns null if no report exists (404), throws on other errors
 */
export function useInterplayReport(clientId: string) {
  const apiClient = useApiClient();

  return useQuery<InterplayReportResponse | null>({
    queryKey: ['client', clientId, 'interplay-report'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<InterplayReportResponse>(
          `/api/clients/${clientId}/interplay-report`
        );
        return data;
      } catch (error: unknown) {
        // Return null if no report exists (404)
        if (
          error &&
          typeof error === 'object' &&
          'response' in error &&
          error.response &&
          typeof error.response === 'object' &&
          'status' in error.response &&
          error.response.status === 404
        ) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!clientId,
  });
}
