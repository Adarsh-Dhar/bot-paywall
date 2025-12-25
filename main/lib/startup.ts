import { startBotPaymentSystem } from './automated-bot-payment-system';

/**
 * Initialize services when the application starts
 * This runs server-side only (Node.js environment)
 */
export async function initializeServices(): Promise<void> {
  // Only run in Node.js environment (server-side)
  if (typeof window !== 'undefined') {
    return; // Skip in browser
  }

  try {
    // Start the automated bot payment system (replaces bot cleanup service)
    await startBotPaymentSystem({
      // Configuration will be read from environment variables
      enableConsoleLogging: true,
      enableFileLogging: false,
      cleanupDelayMs: 60000, // 60 seconds
      monitoringCheckInterval: 5000, // 5 seconds
      configuredClientIP: process.env.CLIENT_IP || '210.212.2.133'
    });
    
    console.log('Automated bot payment system initialized successfully');
  } catch (error) {
    console.error('Failed to initialize automated bot payment system:', error);
    // Don't throw in production to prevent app crashes
    if (process.env.NODE_ENV === 'development') {
      throw error;
    }
  }
}

// Auto-initialize in both development and production (server-side only)
if (typeof window === 'undefined' && (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development')) {
  initializeServices().catch(error => {
    console.error('Failed to initialize services:', error);
    // Don't exit in development to allow for debugging
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });
}