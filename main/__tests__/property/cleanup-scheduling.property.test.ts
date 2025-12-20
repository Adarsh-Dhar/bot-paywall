/**
 * Property-based tests for cleanup scheduling
 * **Feature: automated-bot-payment-system, Property 6: Whitelist rules are scheduled for 60-second removal**
 */

import fc from 'fast-check';
import { CleanupSchedulerImpl } from '../../lib/bot-payment-system/services/cleanup-scheduler';
import { CloudflareClient, DatabaseService, LoggingService } from '../../lib/bot-payment-system/interfaces';
import { BotAllowedEntry, PaymentRecord, AccessRule, CleanupResult } from '../../lib/bot-payment-system/types';

// Mock implementations
const mockCloudflareClient: jest.Mocked<CloudflareClient> = {
  createAccessRule: jest.fn(),
  deleteAccessRule: jest.fn(),
  listAccessRules: jest.fn()
};

const mockDatabaseService: jest.Mocked<DatabaseService> = {
  addBotEntry: jest.fn(),
  updateBotEntry: jest.fn(),
  getBotEntry: jest.fn()
};

const mockLoggingService: jest.Mocked<LoggingService> = {
  log: jest.fn(),
  logPaymentVerification: jest.fn(),
  logCloudflareOperation: jest.fn(),
  logDatabaseOperation: jest.fn(),
  logError: jest.fn()
};

describe('Cleanup Scheduling Properties', () => {
  let cleanupScheduler: CleanupSchedulerImpl;

  beforeEach(() => {
    cleanupScheduler = new CleanupSchedulerImpl(
      mockCloudflareClient,
      mockDatabaseService,
      mockLoggingService
    );
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Property 6: Whitelist rules are scheduled for 60-second removal', () => {
    test('any IP address should be scheduled for cleanup after exactly 60 seconds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (ip) => {
            // Schedule cleanup with default delay (60 seconds)
            await cleanupScheduler.scheduleDefaultCleanup(ip);

            // Verify cleanup is scheduled
            expect(cleanupScheduler.isCleanupScheduled(ip)).toBe(true);
            expect(cleanupScheduler.getScheduledIPs()).toContain(ip);
            expect(cleanupScheduler.getScheduledCleanupCount()).toBeGreaterThan(0);

            // Verify logging was called
            expect(mockLoggingService.log).toHaveBeenCalledWith(
              expect.objectContaining({
                level: 'info',
                component: 'CleanupScheduler',
                message: expect.stringContaining(`Scheduled cleanup for IP ${ip} in 60000ms`),
                context: expect.objectContaining({ ip, delay: 60000 })
              })
            );

            // Clean up
            await cleanupScheduler.cancelCleanup(ip);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('scheduled cleanup should execute after the specified delay', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.integer({ min: 1000, max: 10000 }), // custom delay
          async (ip, customDelay) => {
            // Mock successful database and Cloudflare operations
            const mockBotEntry: BotAllowedEntry = {
              id: 'test-id',
              ipAddress: ip,
              reason: 'Payment verified',
              paymentRecord: {
                transactionId: 'tx-123',
                amount: 0.01,
                currency: 'MOVE',
                timestamp: new Date(),
                payerAddress: 'addr-123',
                verified: true
              },
              createdAt: new Date(),
              cleanedUp: false
            };

            const mockAccessRule: AccessRule = {
              id: 'rule-123',
              mode: 'whitelist',
              configuration: {
                target: 'ip',
                value: ip
              },
              notes: 'Test rule'
            };

            mockDatabaseService.getBotEntry.mockResolvedValue(mockBotEntry);
            mockCloudflareClient.listAccessRules.mockResolvedValue([mockAccessRule]);
            mockCloudflareClient.deleteAccessRule.mockResolvedValue();
            mockDatabaseService.updateBotEntry.mockResolvedValue();

            // Schedule cleanup with custom delay
            await cleanupScheduler.scheduleCleanup(ip, customDelay);

            // Verify cleanup is scheduled
            expect(cleanupScheduler.isCleanupScheduled(ip)).toBe(true);

            // Fast-forward time to trigger cleanup
            jest.advanceTimersByTime(customDelay);

            // Wait for async operations to complete
            await new Promise(resolve => setImmediate(resolve));

            // Verify cleanup was executed
            expect(mockDatabaseService.getBotEntry).toHaveBeenCalledWith(ip);
            expect(mockCloudflareClient.listAccessRules).toHaveBeenCalledWith(ip);
            expect(mockCloudflareClient.deleteAccessRule).toHaveBeenCalledWith('rule-123');
            expect(mockDatabaseService.updateBotEntry).toHaveBeenCalledWith(
              'test-id',
              expect.objectContaining({
                expiresAt: expect.any(Date),
                cleanedUp: true
              })
            );

            // Verify cleanup is no longer scheduled
            expect(cleanupScheduler.isCleanupScheduled(ip)).toBe(false);
          }
        ),
        { numRuns: 50 } // Reduced runs due to timer operations
      );
    });

    test('multiple IP addresses can be scheduled simultaneously', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
            { minLength: 2, maxLength: 5 }
          ).filter(ips => new Set(ips).size === ips.length), // ensure unique IPs
          async (ips) => {
            // Schedule cleanup for all IPs
            for (const ip of ips) {
              await cleanupScheduler.scheduleDefaultCleanup(ip);
            }

            // Verify all IPs are scheduled
            expect(cleanupScheduler.getScheduledCleanupCount()).toBe(ips.length);
            
            const scheduledIPs = cleanupScheduler.getScheduledIPs();
            for (const ip of ips) {
              expect(scheduledIPs).toContain(ip);
              expect(cleanupScheduler.isCleanupScheduled(ip)).toBe(true);
            }

            // Clean up all
            await cleanupScheduler.cancelAllCleanups();
            expect(cleanupScheduler.getScheduledCleanupCount()).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('cancelling cleanup should remove scheduled timer', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (ip) => {
            // Schedule cleanup
            await cleanupScheduler.scheduleDefaultCleanup(ip);
            expect(cleanupScheduler.isCleanupScheduled(ip)).toBe(true);

            // Cancel cleanup
            await cleanupScheduler.cancelCleanup(ip);

            // Verify cleanup is no longer scheduled
            expect(cleanupScheduler.isCleanupScheduled(ip)).toBe(false);
            expect(cleanupScheduler.getScheduledIPs()).not.toContain(ip);

            // Verify cancellation was logged
            expect(mockLoggingService.log).toHaveBeenCalledWith(
              expect.objectContaining({
                level: 'info',
                component: 'CleanupScheduler',
                message: expect.stringContaining(`Cancelled scheduled cleanup for IP ${ip}`),
                context: expect.objectContaining({ ip })
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rescheduling an IP should cancel previous timer and create new one', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.integer({ min: 1000, max: 5000 }), // first delay
          fc.integer({ min: 1000, max: 5000 }), // second delay
          async (ip, firstDelay, secondDelay) => {
            // Schedule first cleanup
            await cleanupScheduler.scheduleCleanup(ip, firstDelay);
            expect(cleanupScheduler.isCleanupScheduled(ip)).toBe(true);

            // Schedule second cleanup (should cancel first)
            await cleanupScheduler.scheduleCleanup(ip, secondDelay);
            expect(cleanupScheduler.isCleanupScheduled(ip)).toBe(true);

            // Should still have only one scheduled cleanup for this IP
            expect(cleanupScheduler.getScheduledCleanupCount()).toBe(1);
            expect(cleanupScheduler.getScheduledIPs()).toEqual([ip]);

            // Verify both schedule calls were logged
            expect(mockLoggingService.log).toHaveBeenCalledWith(
              expect.objectContaining({
                message: expect.stringContaining(`Scheduled cleanup for IP ${ip} in ${firstDelay}ms`)
              })
            );
            expect(mockLoggingService.log).toHaveBeenCalledWith(
              expect.objectContaining({
                message: expect.stringContaining(`Scheduled cleanup for IP ${ip} in ${secondDelay}ms`)
              })
            );

            // Clean up
            await cleanupScheduler.cancelCleanup(ip);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('cleanup stats should accurately reflect scheduled state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
            { minLength: 0, maxLength: 3 }
          ).filter(ips => new Set(ips).size === ips.length), // ensure unique IPs
          async (ips) => {
            // Schedule cleanup for all IPs
            for (const ip of ips) {
              await cleanupScheduler.scheduleDefaultCleanup(ip);
            }

            // Get stats
            const stats = cleanupScheduler.getCleanupStats();

            // Verify stats accuracy
            expect(stats.scheduledCount).toBe(ips.length);
            expect(stats.scheduledIPs).toHaveLength(ips.length);
            expect(stats.defaultDelayMs).toBe(60000);
            expect(stats.maxRetryAttempts).toBe(3);

            // Verify all IPs are in stats
            for (const ip of ips) {
              expect(stats.scheduledIPs).toContain(ip);
            }

            // Clean up all
            await cleanupScheduler.cancelAllCleanups();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('immediate cleanup should bypass scheduling', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (ip) => {
            // Mock successful operations
            const mockBotEntry: BotAllowedEntry = {
              id: 'test-id',
              ipAddress: ip,
              reason: 'Payment verified',
              paymentRecord: {
                transactionId: 'tx-123',
                amount: 0.01,
                currency: 'MOVE',
                timestamp: new Date(),
                payerAddress: 'addr-123',
                verified: true
              },
              createdAt: new Date(),
              cleanedUp: false
            };

            mockDatabaseService.getBotEntry.mockResolvedValue(mockBotEntry);
            mockCloudflareClient.listAccessRules.mockResolvedValue([]);
            mockDatabaseService.updateBotEntry.mockResolvedValue();

            // First schedule a cleanup
            await cleanupScheduler.scheduleDefaultCleanup(ip);
            expect(cleanupScheduler.isCleanupScheduled(ip)).toBe(true);

            // Trigger immediate cleanup
            const result = await cleanupScheduler.triggerImmediateCleanup(ip);

            // Verify cleanup was executed immediately
            expect(result.success).toBe(true);
            expect(mockDatabaseService.getBotEntry).toHaveBeenCalledWith(ip);
            expect(mockDatabaseService.updateBotEntry).toHaveBeenCalled();

            // Verify scheduled cleanup was cancelled
            expect(cleanupScheduler.isCleanupScheduled(ip)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});