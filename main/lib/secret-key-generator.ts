/**
 * Secret Key Generator
 * Generates unique backdoor passwords for Gatekeeper projects
 */

import { randomUUID } from 'crypto';

/**
 * Generate a 32-character secret key for bot backdoor access
 * Format: gk_live_{24-char-uuid}
 */
export function generateSecretKey(): string {
  // Generate a UUID and remove hyphens to get 32 characters
  const uuid = randomUUID().replace(/-/g, '');
  return `gk_live_${uuid}`;
}

/**
 * Validate that a secret key has the correct format
 */
export function isValidSecretKey(key: string): boolean {
  // Should start with gk_live_ and be exactly 40 characters total
  // gk_live_ = 8 chars + 32 char uuid = 40 chars
  return /^gk_live_[a-f0-9]{32}$/.test(key);
}

/**
 * Obscure a secret key for display (show only prefix and bullets)
 * Example: gk_live_•••••••••••••••••••••••••••••••
 */
export function obscureSecretKey(secretKey: string): string {
  if (!isValidSecretKey(secretKey)) {
    return '••••••••••••••••••••••••••••••••';
  }

  const prefix = secretKey.substring(0, 8); // "gk_live_"
  const hiddenPart = '•'.repeat(32);
  return `${prefix}${hiddenPart}`;
}
