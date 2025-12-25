/**
 * Server-side Token Storage Utilities
 * Manage JWT tokens in HTTP-only cookies (server-side only)
 */

import { cookies } from 'next/headers';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

// Cookie options
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * Set tokens in HTTP-only cookies (server-side)
 */
export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  const cookieStore = await cookies();
  
  // Set access token (15 minutes)
  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60, // 15 minutes
  });

  // Set refresh token (7 days)
  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

/**
 * Get access token from cookies (server-side)
 */
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value || null;
}

/**
 * Get refresh token from cookies (server-side)
 */
export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value || null;
}

/**
 * Clear tokens from cookies (server-side)
 */
export async function clearTokens(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}

