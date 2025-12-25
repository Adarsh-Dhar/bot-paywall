'use client';

/**
 * Client-side user hook
 * For client components that need user information
 * Note: This is a simplified version - in production you might want to use React Query or SWR
 */

import { useState, useEffect } from 'react';
import { clientTokenStorage } from './token-storage';

interface User {
  id: string;
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
}

interface UseUserResult {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: User | null;
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      try {
        const token = clientTokenStorage.getAccessToken();
        if (!token) {
          setIsLoaded(true);
          return;
        }

        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include', // Include cookies
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          // Token might be expired, try to refresh
          const refreshToken = clientTokenStorage.getRefreshToken();
          if (refreshToken) {
            try {
              const refreshResponse = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include', // Include cookies
                body: JSON.stringify({ refreshToken }),
              });

              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                clientTokenStorage.setTokens(
                  refreshData.accessToken,
                  refreshData.refreshToken
                );

                // Retry fetching user
                const retryResponse = await fetch('/api/auth/me', {
                  headers: {
                    Authorization: `Bearer ${refreshData.accessToken}`,
                  },
                  credentials: 'include', // Include cookies
                });

                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  setUser(retryData.user);
                }
              } else {
                // Refresh failed, clear tokens
                clientTokenStorage.clearTokens();
              }
            } catch (error) {
              console.error('Token refresh error:', error);
              clientTokenStorage.clearTokens();
            }
          }
        }
      } catch (error) {
        console.error('Fetch user error:', error);
      } finally {
        setIsLoaded(true);
      }
    }

    fetchUser();
  }, []);

  return {
    isLoaded,
    isSignedIn: user !== null,
    user,
  };
}

