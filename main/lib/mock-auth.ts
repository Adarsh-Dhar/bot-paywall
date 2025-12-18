/**
 * Mock Authentication for Testing
 * Simple hardcoded user ID for development/testing
 */

// Mock user for testing - no real authentication
export const MOCK_USER_ID = 'test-user-123';
export const MOCK_USER_EMAIL = 'test@example.com';

/**
 * Mock auth function that returns a hardcoded user ID
 * Replace Clerk's auth() function
 */
export async function auth() {
  return {
    userId: MOCK_USER_ID,
  };
}

/**
 * Mock user hook for client components
 * Replace Clerk's useUser hook
 */
export function useUser() {
  return {
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: MOCK_USER_ID,
      emailAddresses: [{ emailAddress: MOCK_USER_EMAIL }],
    },
  };
}