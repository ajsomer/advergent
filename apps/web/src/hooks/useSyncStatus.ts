import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api';

interface SyncStatusResponse {
  sync: {
    status: 'never_synced' | 'pending' | 'running' | 'completed' | 'failed';
    jobId: string | null;
    startedAt: string | null;
    completedAt: string | null;
    errorMessage: string | null;
  };
  report: {
    status: 'none' | 'pending' | 'researching' | 'analyzing' | 'completed' | 'failed';
    reportId: string | null;
    createdAt: string | null;
    completedAt: string | null;
    errorMessage: string | null;
  } | null;
  isReady: boolean;
  syncStartedAt: string | null;
}

interface UseSyncStatusOptions {
  enabled?: boolean;
}

// Track consecutive errors to stop polling after repeated failures
const MAX_CONSECUTIVE_ERRORS = 3;

export function useSyncStatus(clientId: string | undefined, options?: UseSyncStatusOptions) {
  const api = useApiClient();

  return useQuery<SyncStatusResponse, Error>({
    queryKey: ['sync-status', clientId],
    queryFn: async () => {
      const response = await api.get(`/api/clients/${clientId}/sync-status`);
      return response.data;
    },
    refetchInterval: (query) => {
      // Stop polling on errors after MAX_CONSECUTIVE_ERRORS attempts
      if (query.state.fetchFailureCount >= MAX_CONSECUTIVE_ERRORS) {
        return false;
      }

      // Stop polling when ready or failed
      const data = query.state.data;
      if (data?.isReady) return false;
      if (data?.sync.status === 'failed') return false;
      if (data?.report?.status === 'failed') return false;

      return 5000; // Poll every 5 seconds
    },
    retry: 2, // Retry failed requests up to 2 times before marking as error
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
    enabled: !!clientId && (options?.enabled !== false),
  });
}
