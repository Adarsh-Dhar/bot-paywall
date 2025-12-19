import { prisma } from '@/lib/prisma';

/**
 * Cleanup service for automatically removing expired bot IPs
 */
export class BotCleanupService {
  private static instance: BotCleanupService;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 10000; // Check every 10 seconds
  private readonly EXPIRY_TIME_MS = 60000; // 1 minute

  private constructor() {}

  static getInstance(): BotCleanupService {
    if (!BotCleanupService.instance) {
      BotCleanupService.instance = new BotCleanupService();
    }
    return BotCleanupService.instance;
  }

  /**
   * Start the cleanup service
   */
  start(): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    console.log('Starting bot cleanup service...');
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredBots();
    }, this.CLEANUP_INTERVAL_MS);

    // Run initial cleanup
    this.cleanupExpiredBots();
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('Bot cleanup service stopped');
    }
  }

  /**
   * Clean up bots that are older than 1 minute
   */
  private async cleanupExpiredBots(): Promise<void> {
    try {
      const expiryTime = new Date(Date.now() - this.EXPIRY_TIME_MS);
      
      const result = await prisma.botsAllowed.deleteMany({
        where: {
          createdAt: {
            lt: expiryTime,
          },
        },
      });

      if (result.count > 0) {
        console.log(`Cleaned up ${result.count} expired bot IP(s)`);
      }
    } catch (error) {
      console.error('Error during bot cleanup:', error);
    }
  }

  /**
   * Manually trigger cleanup (useful for testing)
   */
  async triggerCleanup(): Promise<number> {
    const expiryTime = new Date(Date.now() - this.EXPIRY_TIME_MS);
    
    const result = await prisma.botsAllowed.deleteMany({
      where: {
        createdAt: {
          lt: expiryTime,
        },
      },
    });

    return result.count;
  }

  /**
   * Get time remaining for a bot IP before it expires
   */
  getTimeRemaining(createdAt: Date): number {
    const expiryTime = new Date(createdAt.getTime() + this.EXPIRY_TIME_MS);
    const now = new Date();
    return Math.max(0, expiryTime.getTime() - now.getTime());
  }

  /**
   * Check if a bot IP has expired
   */
  isExpired(createdAt: Date): boolean {
    return this.getTimeRemaining(createdAt) === 0;
  }
}

// Global instance
export const botCleanupService = BotCleanupService.getInstance();