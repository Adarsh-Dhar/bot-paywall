/**
 * Authentication Module
 * Client-compatible exports only
 * 
 * NOTE: Server-side code should import directly from './auth' instead of this file
 * This file is safe for client components as it doesn't import server-only modules
 */

// For backward compatibility - these are no longer used but kept for reference
export const MOCK_USER_ID = 'test-user-123';
export const MOCK_USER_EMAIL = 'test@example.com';

// Re-export useUser from client hook file (client-safe)
export { useUser } from './use-user';

// Re-export types that are safe for client components
export type { AuthResult } from './auth-edge';