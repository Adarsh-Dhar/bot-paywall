/**
 * Client-side Token Storage Utilities
 * Manage JWT tokens in localStorage (client-side only)
 */

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

/**
 * Client-side token storage (for API calls from client components)
 * Uses localStorage
 */
export const clientTokenStorage = {
  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACCESS_TOKEN_COOKIE, accessToken);
      localStorage.setItem(REFRESH_TOKEN_COOKIE, refreshToken);
    }
  },

  getAccessToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(ACCESS_TOKEN_COOKIE);
    }
    return null;
  },

  getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(REFRESH_TOKEN_COOKIE);
    }
    return null;
  },

  clearTokens(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACCESS_TOKEN_COOKIE);
      localStorage.removeItem(REFRESH_TOKEN_COOKIE);
    }
  },
};
