import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { useMemo } from 'react';
import { log } from '@/lib/logger';

const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';

// Base axios instance without auth
export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true
});

apiClient.interceptors.request.use((config) => {
  log.debug('api request', { url: config.url, method: config.method });
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    log.error('api error', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message
    });
    return Promise.reject(error);
  }
);

/**
 * Hook to get API client with Clerk authentication
 * This creates an axios instance with automatic Clerk token injection
 */
export function useApiClient() {
  const { getToken } = useAuth();

  // Create a memoized axios instance
  const client = useMemo(() => {
    const instance = axios.create({
      baseURL: apiBaseUrl,
      withCredentials: true
    });

    // Request interceptor to inject Clerk token
    instance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        try {
          const token = await getToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          log.error('Failed to get Clerk token', { error });
        }

        log.debug('api request', { url: config.url, method: config.method });
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        log.error('api error', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message
        });
        return Promise.reject(error);
      }
    );

    return instance;
  }, [getToken]);

  return client;
}
