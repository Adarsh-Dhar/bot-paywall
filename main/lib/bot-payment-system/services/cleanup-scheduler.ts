/**
 * Cleanup Scheduler Service for managing timed whitelist rule removal
 */

import { CleanupScheduler } from '../interfaces';
import { CleanupResult } from '../types';
import { CloudflareClient } from '../interfaces';
import { DatabaseService } from '../interfaces';
import { LoggingService } from '../interfaces';

export class CleanupSchedulerImpl implements CleanupScheduler {
  private scheduledCleanups: Map<string, NodeJS.Timeout> = new Map();
  private readonly CLEANUP_DELAY_MS = 60000; // 60 seconds
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_BASE_DELAY = 1000; // 1 second base delay for exponential backoff

  constructor(
    private cloudflareClient: CloudflareClient,
    private databaseService: DatabaseService,
    private loggingService?: LoggingService
  ) {}

  /**
   * Schedules cleanup for an IP address after the specified delay
   */
  async scheduleCleanup(ip: string, delay: number = this.CLEANUP_DELAY_MS): Promise<void> {
    try {
      // Cancel any existing cleanup for this IP
      await this.cancelCleanup(ip);

      // Schedule new cleanup
      const timeoutId = setTimeout(async () => {
        try {
          await this.executeCleanup(ip);
          this.scheduledCleanups.delete(ip);
        } catch (error) {
          await this.loggingService?.logError('CleanupScheduler', error as Error, { ip });
          this.scheduledCleanups.delete(ip);
        }
      }, delay);

      this.scheduledCleanups.set(ip, timeoutId);

      await this.loggingService?.log({
        timestamp: new Date(),
        level: 'info',
        component: 'CleanupScheduler',
        message: `Scheduled cleanup for IP ${ip} in ${delay}ms`,
        context: { ip, delay }
      });
    } catch (error) {
      throw new Error(`Failed to schedule cleanup for IP ${ip}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancels scheduled cleanup for an IP address
   */
  async cancelCleanup(ip: string): Promise<void> {
    const existingTimeout = this.scheduledCleanups.get(ip);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.scheduledCleanups.delete(ip);

      await this.loggingService?.log({
        timestamp: new Date(),
        level: 'info',
        component: 'CleanupScheduler',
        message: `Cancelled scheduled cleanup for IP ${ip}`,
        context: { ip }
      });
    }
  }

  /**
   * Executes cleanup for an IP address with retry logic
   */
  async executeCleanup(ip: string): Promise<CleanupResult> {
    let lastError: Error | null = null;
    let retryCount = 0;

    while (retryCount <= this.MAX_RETRY_ATTEMPTS) {
      try {
        // Get the database entry to find the whitelist rule ID
        const botEntry = await this.databaseService.getBotEntry(ip);
        
        if (!botEntry) {
          await this.loggingService?.log({
            timestamp: new Date(),
            level: 'warn',
            component: 'CleanupScheduler',
            message: `No database entry found for IP ${ip} during cleanup`,
            context: { ip }
          });
          
          return {
            success: false,
            error: 'No database entry found for IP',
            retryCount
          };
        }

        // Find and remove Cloudflare whitelist rule
        let ruleId: string | undefined;
        
        try {
          // Try to find the rule by IP
          const rules = await this.cloudflareClient.listAccessRules(ip);
          const whitelistRule = rules.find(rule => 
            rule.mode === 'whitelist' && 
            rule.configuration.target === 'ip' && 
            rule.configuration.value === ip
          );

          if (whitelistRule) {
            ruleId = whitelistRule.id;
            await this.cloudflareClient.deleteAccessRule(ruleId);
            
            await this.loggingService?.logCloudflareOperation(
              'delete_rule', 
              ip, 
              true
            );
          } else {
            await this.loggingService?.log({
              timestamp: new Date(),
              level: 'warn',
              component: 'CleanupScheduler',
              message: `No whitelist rule found for IP ${ip}`,
              context: { ip }
            });
          }
        } catch (cloudflareError) {
          await this.loggingService?.logCloudflareOperation(
            'delete_rule', 
            ip, 
            false, 
            cloudflareError instanceof Error ? cloudflareError.message : 'Unknown error'
          );
          throw cloudflareError;
        }

        // Update database entry with expiration timestamp
        const expirationTime = new Date();
        try {
          await this.databaseService.updateBotEntry(botEntry.id, {
            expiresAt: expirationTime,
            cleanedUp: true
          });

          await this.loggingService?.logDatabaseOperation(
            'update_expiration', 
            ip, 
            true
          );
        } catch (dbError) {
          await this.loggingService?.logDatabaseOperation(
            'update_expiration', 
            ip, 
            false, 
            dbError instanceof Error ? dbError.message : 'Unknown error'
          );
          throw dbError;
        }

        // Success
        await this.loggingService?.log({
          timestamp: new Date(),
          level: 'info',
          component: 'CleanupScheduler',
          message: `Successfully cleaned up IP ${ip}`,
          context: { ip, ruleId, retryCount }
        });

        return {
          success: true,
          ruleId,
          retryCount
        };

      } catch (error) {
        lastError = error as Error;
        retryCount++;

        if (retryCount <= this.MAX_RETRY_ATTEMPTS) {
          // Calculate exponential backoff delay
          const delay = this.RETRY_BASE_DELAY * Math.pow(2, retryCount - 1);
          
          await this.loggingService?.log({
            timestamp: new Date(),
            level: 'warn',
            component: 'CleanupScheduler',
            message: `Cleanup attempt ${retryCount} failed for IP ${ip}, retrying in ${delay}ms`,
            context: { ip, retryCount, delay, error: lastError.message }
          });

          // Wait before retry
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    await this.loggingService?.logError('CleanupScheduler', lastError!, { 
      ip, 
      retryCount, 
      operation: 'cleanup_exhausted' 
    });

    // Alert administrators about multiple failures
    await this.alertAdministrators(ip, lastError!);

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      retryCount
    };
  }

  /**
   * Gets the number of currently scheduled cleanups
   */
  getScheduledCleanupCount(): number {
    return this.scheduledCleanups.size;
  }

  /**
   * Gets all currently scheduled IP addresses
   */
  getScheduledIPs(): string[] {
    return Array.from(this.scheduledCleanups.keys());
  }

  /**
   * Checks if cleanup is scheduled for a specific IP
   */
  isCleanupScheduled(ip: string): boolean {
    return this.scheduledCleanups.has(ip);
  }

  /**
   * Cancels all scheduled cleanups (useful for shutdown)
   */
  async cancelAllCleanups(): Promise<void> {
    const ips = Array.from(this.scheduledCleanups.keys());
    
    for (const ip of ips) {
      await this.cancelCleanup(ip);
    }

    await this.loggingService?.log({
      timestamp: new Date(),
      level: 'info',
      component: 'CleanupScheduler',
      message: `Cancelled all scheduled cleanups (${ips.length} total)`,
      context: { cancelledIPs: ips }
    });
  }

  /**
   * Schedules cleanup with the default 60-second delay
   */
  async scheduleDefaultCleanup(ip: string): Promise<void> {
    await this.scheduleCleanup(ip, this.CLEANUP_DELAY_MS);
  }

  /**
   * Manually triggers immediate cleanup (bypasses scheduling)
   */
  async triggerImmediateCleanup(ip: string): Promise<CleanupResult> {
    await this.cancelCleanup(ip); // Cancel any scheduled cleanup
    return await this.executeCleanup(ip);
  }

  /**
   * Private helper to sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Alerts administrators about cleanup failures
   */
  private async alertAdministrators(ip: string, error: Error): Promise<void> {
    try {
      await this.loggingService?.log({
        timestamp: new Date(),
        level: 'error',
        component: 'CleanupScheduler',
        message: `ALERT: Multiple cleanup failures for IP ${ip}`,
        context: { 
          ip, 
          error: error.message,
          alertType: 'cleanup_failure',
          requiresAdminAttention: true
        }
      });

      // In a real implementation, this could send emails, Slack notifications, etc.
      console.error(`ADMIN ALERT: Cleanup failed for IP ${ip} after ${this.MAX_RETRY_ATTEMPTS} attempts: ${error.message}`);
    } catch (alertError) {
      console.error('Failed to send administrator alert:', alertError);
    }
  }

  /**
   * Gets cleanup statistics
   */
  getCleanupStats(): {
    scheduledCount: number;
    scheduledIPs: string[];
    defaultDelayMs: number;
    maxRetryAttempts: number;
  } {
    return {
      scheduledCount: this.scheduledCleanups.size,
      scheduledIPs: Array.from(this.scheduledCleanups.keys()),
      defaultDelayMs: this.CLEANUP_DELAY_MS,
      maxRetryAttempts: this.MAX_RETRY_ATTEMPTS
    };
  }
}