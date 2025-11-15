import { useUser } from '@clerk/clerk-react';

/**
 * Hook to get current user from Clerk
 * This replaces the old JWT-based auth
 */
export function useAuth() {
  const { user, isLoaded, isSignedIn } = useUser();

  return {
    user,
    isLoaded,
    isSignedIn,
    // For backwards compatibility with existing code that expects these fields
    data: user ? {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      name: user.fullName || user.firstName || 'User',
    } : null,
    isLoading: !isLoaded,
    error: null,
  };
}
