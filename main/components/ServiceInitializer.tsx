'use client';

/**
 * ServiceInitializer - Client Component
 * Note: Bot payment system initialization is handled server-side via startup.ts
 * This component is kept for potential future client-side status monitoring
 */
export default function ServiceInitializer() {
  // Bot payment system is initialized server-side in startup.ts
  // No client-side initialization needed as it uses Node.js modules (child_process, fs)
  // that are not available in the browser
  
  return null; // This component doesn't render anything
}