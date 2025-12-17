/**
 * Nameserver Utilities
 * Utilities for formatting and displaying nameservers
 */

/**
 * Format nameservers for display
 * Returns a formatted string suitable for copy-paste
 */
export function formatNameserversForDisplay(nameservers: string[] | null): string {
  if (!nameservers || nameservers.length === 0) {
    return '';
  }
  return nameservers.join('\n');
}

/**
 * Format nameservers for HTML display
 * Returns an array of formatted nameserver entries
 */
export function formatNameserversForHTML(nameservers: string[] | null): string[] {
  if (!nameservers || nameservers.length === 0) {
    return [];
  }
  return nameservers;
}

/**
 * Validate nameserver format
 */
export function isValidNameserver(nameserver: string): boolean {
  // Basic validation: should be a valid domain name
  const nameserverRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  return nameserverRegex.test(nameserver);
}

/**
 * Validate nameserver array
 */
export function isValidNameserverArray(nameservers: string[] | null): boolean {
  if (!nameservers || nameservers.length === 0) {
    return false;
  }
  return nameservers.every(isValidNameserver);
}

/**
 * Get nameserver count
 */
export function getNameserverCount(nameservers: string[] | null): number {
  return nameservers?.length || 0;
}

/**
 * Check if nameservers are Cloudflare nameservers
 */
export function isCloudflareNameserver(nameserver: string): boolean {
  return nameserver.toLowerCase().includes('cloudflare.com');
}

/**
 * Check if all nameservers are from Cloudflare
 */
export function areAllCloudflareNameservers(nameservers: string[] | null): boolean {
  if (!nameservers || nameservers.length === 0) {
    return false;
  }
  return nameservers.every(isCloudflareNameserver);
}
