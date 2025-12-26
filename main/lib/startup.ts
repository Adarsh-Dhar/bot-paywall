/**
 * Initialize services when the application starts
 * This runs server-side only (Node.js environment)
 * 
 * Note: Bot payment system is now initialized on-demand per request with project context.
 * Cloudflare credentials are fetched from the database per operation.
 */
export async function initializeServices(): Promise<void> {
  // Only run in Node.js environment (server-side)
  if (typeof window !== 'undefined') {
    return; // Skip in browser
  }

  // Bot payment system is initialized on-demand by API routes with project context
  // No global initialization needed as Cloudflare credentials come from database
}