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

// Auto-initialize in production
if (process.env.NODE_ENV === 'production') {
  initializeServices().catch(error => {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  });
}