import { startBotPaymentSystem } from './automated-bot-payment-system';

/**
 * Initialize services when the application starts
 */
export async function initializeServices(): Promise<void> {
  try {
    // Start the automated bot payment system (replaces bot cleanup service)
    await startBotPaymentSystem({
      // Configuration will be read from environment variables
      enableConsoleLogging: true,
      enableFileLogging: false,
      cleanupDelayMs: 60000, // 60 seconds
      monitoringCheckInterval: 5000 // 5 seconds
    });
    
    console.log('Automated bot payment system initialized successfully');
  } catch (error) {
    console.error('Failed to initialize automated bot payment system:', error);
    throw error;
  }
}

// Auto-initialize in both development and production
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development') {
  initializeServices().catch(error => {
    console.error('Failed to initialize services:', error);
    // Don't exit in development to allow for debugging
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });
}