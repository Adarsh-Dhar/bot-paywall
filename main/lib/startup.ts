import { botCleanupService } from './bot-cleanup';

/**
 * Initialize services when the application starts
 */
export function initializeServices(): void {
  // Start the bot cleanup service
  botCleanupService.start();
  
  console.log('Application services initialized');
}

// Auto-initialize in production
if (process.env.NODE_ENV === 'production') {
  initializeServices();
}