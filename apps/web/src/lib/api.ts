import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { useMemo, useState, useEffect } from 'react';
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
 * Custom error for authentication failures
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Hook to get API client with Clerk authentication
 * This creates an axios instance with automatic Clerk token injection
 */
export function useApiClient() {
  const { getToken, isLoaded } = useAuth();

  // Create a memoized axios instance
  // Note: We intentionally don't include getToken in deps because
  // the interceptor should always call the latest getToken
  const client = useMemo(() => {
    const instance = axios.create({
      baseURL: apiBaseUrl,
      withCredentials: true
    });

    // Request interceptor to inject Clerk token
    instance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        // Wait for Clerk to be loaded before making authenticated requests
        if (!isLoaded) {
          log.warn('Clerk not loaded, request may fail authentication');
        }

        try {
          // Try to get a fresh token
          // Per Clerk docs: use skipCache: true to force a fresh token when needed
          // https://clerk.com/docs/guides/sessions/force-token-refresh
          let token = await getToken();

          // If token is null, try with skipCache to force a fresh token
          if (!token) {
            log.warn('Token null on first attempt, forcing fresh token with skipCache...', { url: config.url });
            await new Promise(resolve => setTimeout(resolve, 300));
            token = await getToken({ skipCache: true });
          }

          // Second retry with longer delay and skipCache
          if (!token) {
            log.warn('Token null on second attempt, retrying with skipCache after longer delay...', { url: config.url });
            await new Promise(resolve => setTimeout(resolve, 800));
            token = await getToken({ skipCache: true });
          }

          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          } else {
            // Token is null - block the request, don't send unauthenticated
            log.error('No Clerk token available after retries - blocking request', { url: config.url });
            throw new AuthenticationError('Session not ready. Please wait a moment and try again.');
          }
        } catch (error) {
          if (error instanceof AuthenticationError) {
            throw error;
          }
          log.error('Failed to get Clerk token', { error });
          throw new AuthenticationError('Failed to get authentication token. Please try again.');
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
  }, [getToken, isLoaded]);

  return client;
}

/**
 * Hook to check if authentication is ready for API calls
 * This actively verifies that getToken() returns a real token,
 * not just that Clerk says it's loaded.
 */
export function useAuthReady() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [tokenVerified, setTokenVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    // Only verify once Clerk says we're loaded and signed in
    if (!isLoaded || !isSignedIn) {
      setTokenVerified(false);
      return;
    }

    // Don't re-verify if already verified
    if (tokenVerified || isVerifying) {
      return;
    }

    async function verifyToken() {
      setIsVerifying(true);
      try {
        // Use skipCache to ensure we get a fresh token after redirects
        const token = await getToken({ skipCache: true });
        if (token) {
          log.info('useAuthReady: Token verified successfully');
          setTokenVerified(true);
        } else {
          log.warn('useAuthReady: Token is null despite isSignedIn=true');
          // Keep tokenVerified false, will retry on next render
        }
      } catch (err) {
        log.error('useAuthReady: Failed to verify token', { error: err });
      } finally {
        setIsVerifying(false);
      }
    }

    verifyToken();
  }, [isLoaded, isSignedIn, getToken, tokenVerified, isVerifying]);

  // Reset tokenVerified if user signs out
  useEffect(() => {
    if (!isSignedIn) {
      setTokenVerified(false);
    }
  }, [isSignedIn]);

  return {
    isReady: isLoaded && isSignedIn && tokenVerified,
    isLoaded,
    isSignedIn,
    tokenVerified,
    isVerifying
  };
}
