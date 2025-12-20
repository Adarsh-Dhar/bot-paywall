/**
 * Automated Bot Payment System - Main entry point
 * Replaces the existing bot-cleanup.ts with the new payment-based system
 */

import { BotPaymentSystemApplication, BotPaymentSystemConfig } from './bot-payment-system/services/main-application';

// Global instance
let botPaymentSystem: BotPaymentSystemApplication | null = null;

/**
 * Initializes the automated bot payment system
 */
export function initializeBotPaymentSystem(config?: BotPaymentSystemConfig): BotPaymentSystemApplication {
  if (botPaymentSystem) {
    return botPaymentSystem;
  }

  botPaymentSystem = new BotPaymentSystemApplication(config);
  return botPaymentSystem;
}

/**
 * Gets the current bot payment system instance
 */
export function getBotPaymentSystem(): BotPaymentSystemApplication | null {
  return botPaymentSystem;
}

/**
 * Starts the automated bot payment system
 */
export async function startBotPaymentSystem(config?: BotPaymentSystemConfig): Promise<void> {
  if (!botPaymentSystem) {
    botPaymentSystem = new BotPaymentSystemApplication(config);
  }

  await botPaymentSystem.start();
}

/**
 * Stops the automated bot payment system
 */
export async function stopBotPaymentSystem(): Promise<void> {
  if (botPaymentSystem) {
    await botPaymentSystem.stop();
  }
}

/**
 * Gets system status
 */
export async function getBotPaymentSystemStatus() {
  if (!botPaymentSystem) {
    return {
      isRunning: false,
      error: 'System not initialized'
    };
  }

  return await botPaymentSystem.getSystemStatus();
}

/**
 * Processes a manual payment (for testing or API endpoints)
 */
export async function processManualPayment(transactionId: string, ip?: string) {
  if (!botPaymentSystem) {
    throw new Error('Bot payment system not initialized');
  }

  return await botPaymentSystem.processPayment(transactionId, ip);
}

/**
 * Forces immediate cleanup of expired entries
 */
export async function forceCleanup(): Promise<void> {
  if (!botPaymentSystem) {
    throw new Error('Bot payment system not initialized');
  }

  await botPaymentSystem.forceCleanup();
}

/**
 * Gets recent system logs
 */
export function getSystemLogs(count?: number) {
  if (!botPaymentSystem) {
    return [];
  }

  return botPaymentSystem.getRecentLogs(count);
}

/**
 * Exports system logs
 */
export function exportSystemLogs(format: 'json' | 'csv' = 'json'): string {
  if (!botPaymentSystem) {
    return format === 'json' ? '[]' : '';
  }

  return botPaymentSystem.exportLogs(format);
}

/**
 * Graceful shutdown handler for process termination
 */
export async function gracefulShutdown(): Promise<void> {
  if (botPaymentSystem) {
    await botPaymentSystem.gracefulShutdown();
    botPaymentSystem = null;
  }
}

// Handle process termination signals
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await gracefulShutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await gracefulShutdown();
    process.exit(0);
  });
}

// Export the main application class for direct use
export { BotPaymentSystemApplication, BotPaymentSystemConfig } from './bot-payment-system/services/main-application';

// Export all interfaces and types for external use
export * from './bot-payment-system/interfaces';
export * from './bot-payment-system/types';
export * from './bot-payment-system/validation';