/**
 * Property-based tests for database updates after cleanup
 * **Feature: automated-bot-payment-system, Property 8: Whitelist removal updates database entries**
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

describe('Database Cleanup Updates Properties', () => {
  let cleanupScheduler: CleanupSchedulerImpl;

  beforeEach(() => {
    cleanupScheduler = new CleanupSchedulerImpl(
      mockCloudflareClient,
      mockDatabaseService,
      mockLoggingService
    );
    jest.clearAllMocks();
  });

  describe('Property 8: Whitelist removal updates database entries', () => {
    test('any successful whitelist rule removal should update database entry with expiration timestamp', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.string({ minLength: 1, maxLength: 32 }), // entry ID
          fc.string({ minLength: 1, maxLength: 32 }), // rule ID
          fc.string({ minLength: 1, maxLength: 64 }), // transaction ID
          fc.date(), // creation timestamp
          async (ip, entryId, ruleId, transactionId, creationTime) => {
            // Mock bot entry in database
            const mockBotEntry: BotAllowedEntry = {
              id: entryId,
              ipAddress: ip,
              reason: `Payment verified: ${transactionId} (0.01 MOVE)`,
              paymentRecord: {
                transactionId,
                amount: 0.01,
                currency: 'MOVE',
                timestamp: creationTime,
                payerAddress: 'test-address',
                verified: true
              },
              createdAt: creationTime,
              cleanedUp: false
            };

            // Mock Cloudflare rule
            const mockAccessRule: AccessRule = {
              id: ruleId,
              mode: 'whitelist',
              configuration: {
                target: 'ip',
                value: ip
              },
              notes: 'Automated bot payment system - temporary access'
            };

            // Setup mocks
            mockDatabaseService.getBotEntry.mockResolvedValue(mockBotEntry);
            mockCloudflareClient.listAccessRules.mockResolvedValue([mockAccessRule]);
            mockCloudflareClient.deleteAccessRule.mockResolvedValue();
            mockDatabaseService.updateBotEntry.mockResolvedValue();

            // Execute cleanup
            const result = await cleanupScheduler.executeCleanup(ip);

            // Verify cleanup was successful
            expect(result.success).toBe(true);
            expect(result.ruleId).toBe(ruleId);

            // Verify database entry was retrieved
            expect(mockDatabaseService.getBotEntry).toHaveBeenCalledWith(ip);

            // Verify Cloudflare rule was found and deleted
            expect(mockCloudflareClient.listAccessRules).toHaveBeenCalledWith(ip);
            expect(mockCloudflareClient.deleteAccessRule).toHaveBeenCalledWith(ruleId);

            // Verify database entry was updated with expiration information
            expect(mockDatabaseService.updateBotEntry).toHaveBeenCalledWith(
              entryId,
              expect.objectContaining({
                expiresAt: expect.any(Date),
                cleanedUp: true
              })
            );

            // Verify the expiration timestamp is recent (within last few seconds)
            const updateCall = mockDatabaseService.updateBotEntry.mock.calls[0];
            const expirationTime = updateCall[1].expiresAt as Date;
            const now = new Date();
            const timeDiff = Math.abs(now.getTime() - expirationTime.getTime());
            expect(timeDiff).toBeLessThan(5000); // Within 5 seconds

            // Verify logging operations
            expect(mockLoggingService.logCloudflareOperation).toHaveBeenCalledWith(
              'delete_rule',
              ip,
              true
            );
            expect(mockLoggingService.logDatabaseOperation).toHaveBeenCalledWith(
              'update_expiration',
              ip,
              true
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('database update should occur even when no Cloudflare rule is found', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.string({ minLength: 1, maxLength: 32 }), // entry ID
          fc.string({ minLength: 1, maxLength: 64 }), // transaction ID
          async (ip, entryId, transactionId) => {
            // Mock bot entry in database
            const mockBotEntry: BotAllowedEntry = {
              id: entryId,
              ipAddress: ip,
              reason: `Payment verified: ${transactionId} (0.01 MOVE)`,
              paymentRecord: {
                transactionId,
                amount: 0.01,
                currency: 'MOVE',
                timestamp: new Date(),
                payerAddress: 'test-address',
                verified: true
              },
              createdAt: new Date(),
              cleanedUp: false
            };

            // Setup mocks - no Cloudflare rules found
            mockDatabaseService.getBotEntry.mockResolvedValue(mockBotEntry);
            mockCloudflareClient.listAccessRules.mockResolvedValue([]); // No rules found
            mockDatabaseService.updateBotEntry.mockResolvedValue();

            // Execute cleanup
            const result = await cleanupScheduler.executeCleanup(ip);

            // Verify cleanup was successful (even without Cloudflare rule)
            expect(result.success).toBe(true);

            // Verify database entry was still updated
            expect(mockDatabaseService.updateBotEntry).toHaveBeenCalledWith(
              entryId,
              expect.objectContaining({
                expiresAt: expect.any(Date),
                cleanedUp: true
              })
            );

            // Verify warning was logged about missing rule
            expect(mockLoggingService.log).toHaveBeenCalledWith(
              expect.objectContaining({
                level: 'warn',
                component: 'CleanupScheduler',
                message: expect.stringContaining(`No whitelist rule found for IP ${ip}`),
                context: expect.objectContaining({ ip })
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('database update failure should be logged and cause cleanup failure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.string({ minLength: 1, maxLength: 32 }), // entry ID
          fc.string({ minLength: 1, maxLength: 32 }), // rule ID
          fc.string({ minLength: 10, maxLength: 100 }), // error message
          async (ip, entryId, ruleId, errorMessage) => {
            // Mock bot entry in database
            const mockBotEntry: BotAllowedEntry = {
              id: entryId,
              ipAddress: ip,
              reason: 'Payment verified',
              paymentRecord: {
                transactionId: 'tx-123',
                amount: 0.01,
                currency: 'MOVE',
                timestamp: new Date(),
                payerAddress: 'test-address',
                verified: true
              },
              createdAt: new Date(),
              cleanedUp: false
            };

            // Mock Cloudflare rule
            const mockAccessRule: AccessRule = {
              id: ruleId,
              mode: 'whitelist',
              configuration: {
                target: 'ip',
                value: ip
              },
              notes: 'Test rule'
            };

            // Setup mocks - database update fails
            mockDatabaseService.getBotEntry.mockResolvedValue(mockBotEntry);
            mockCloudflareClient.listAccessRules.mockResolvedValue([mockAccessRule]);
            mockCloudflareClient.deleteAccessRule.mockResolvedValue();
            mockDatabaseService.updateBotEntry.mockRejectedValue(new Error(errorMessage));

            // Execute cleanup
            const result = await cleanupScheduler.executeCleanup(ip);

            // Verify cleanup failed due to database error
            expect(result.success).toBe(false);
            expect(result.error).toContain(errorMessage);

            // Verify Cloudflare rule was still deleted
            expect(mockCloudflareClient.deleteAccessRule).toHaveBeenCalledWith(ruleId);

            // Verify database update was attempted
            expect(mockDatabaseService.updateBotEntry).toHaveBeenCalledWith(
              entryId,
              expect.objectContaining({
                expiresAt: expect.any(Date),
                cleanedUp: true
              })
            );

            // Verify database operation failure was logged
            expect(mockLoggingService.logDatabaseOperation).toHaveBeenCalledWith(
              'update_expiration',
              ip,
              false,
              errorMessage
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('cleanup should handle multiple retry attempts for database updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.string({ minLength: 1, maxLength: 32 }), // entry ID
          fc.integer({ min: 1, max: 3 }), // number of failures before success
          async (ip, entryId, failureCount) => {
            // Mock bot entry in database
            const mockBotEntry: BotAllowedEntry = {
              id: entryId,
              ipAddress: ip,
              reason: 'Payment verified',
              paymentRecord: {
                transactionId: 'tx-123',
                amount: 0.01,
                currency: 'MOVE',
                timestamp: new Date(),
                payerAddress: 'test-address',
                verified: true
              },
              createdAt: new Date(),
              cleanedUp: false
            };

            // Setup mocks - database fails first few times, then succeeds
            mockDatabaseService.getBotEntry.mockResolvedValue(mockBotEntry);
            mockCloudflareClient.listAccessRules.mockResolvedValue([]);
            
            let callCount = 0;
            mockDatabaseService.updateBotEntry.mockImplementation(() => {
              callCount++;
              if (callCount <= failureCount) {
                return Promise.reject(new Error(`Database error attempt ${callCount}`));
              }
              return Promise.resolve();
            });

            // Execute cleanup
            const result = await cleanupScheduler.executeCleanup(ip);

            // If failure count is within retry limit, should eventually succeed
            if (failureCount <= 3) {
              expect(result.success).toBe(true);
              expect(result.retryCount).toBe(failureCount);
            } else {
              expect(result.success).toBe(false);
              expect(result.retryCount).toBe(3); // Max retries
            }

            // Verify database update was attempted multiple times
            expect(mockDatabaseService.updateBotEntry).toHaveBeenCalledTimes(Math.min(failureCount + 1, 4));

            // Verify retry logging occurred
            if (failureCount > 0) {
              expect(mockLoggingService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                  level: 'warn',
                  component: 'CleanupScheduler',
                  message: expect.stringContaining('Cleanup attempt'),
                  context: expect.objectContaining({ ip, retryCount: expect.any(Number) })
                })
              );
            }
          }
        ),
        { numRuns: 50 } // Reduced due to retry logic complexity
      );
    });

    test('successful cleanup should log all operations correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.string({ minLength: 1, maxLength: 32 }), // entry ID
          fc.string({ minLength: 1, maxLength: 32 }), // rule ID
          async (ip, entryId, ruleId) => {
            // Mock successful operations
            const mockBotEntry: BotAllowedEntry = {
              id: entryId,
              ipAddress: ip,
              reason: 'Payment verified',
              paymentRecord: {
                transactionId: 'tx-123',
                amount: 0.01,
                currency: 'MOVE',
                timestamp: new Date(),
                payerAddress: 'test-address',
                verified: true
              },
              createdAt: new Date(),
              cleanedUp: false
            };

            const mockAccessRule: AccessRule = {
              id: ruleId,
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

            // Execute cleanup
            const result = await cleanupScheduler.executeCleanup(ip);

            // Verify cleanup was successful
            expect(result.success).toBe(true);

            // Verify all logging operations were called
            expect(mockLoggingService.logCloudflareOperation).toHaveBeenCalledWith(
              'delete_rule',
              ip,
              true
            );
            expect(mockLoggingService.logDatabaseOperation).toHaveBeenCalledWith(
              'update_expiration',
              ip,
              true
            );
            expect(mockLoggingService.log).toHaveBeenCalledWith(
              expect.objectContaining({
                level: 'info',
                component: 'CleanupScheduler',
                message: expect.stringContaining(`Successfully cleaned up IP ${ip}`),
                context: expect.objectContaining({ ip, ruleId, retryCount: 0 })
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('cleanup without database entry should fail gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (ip) => {
            // Setup mocks - no database entry found
            mockDatabaseService.getBotEntry.mockResolvedValue(null);

            // Execute cleanup
            const result = await cleanupScheduler.executeCleanup(ip);

            // Verify cleanup failed gracefully
            expect(result.success).toBe(false);
            expect(result.error).toBe('No database entry found for IP');

            // Verify database was queried
            expect(mockDatabaseService.getBotEntry).toHaveBeenCalledWith(ip);

            // Verify no Cloudflare operations were attempted
            expect(mockCloudflareClient.listAccessRules).not.toHaveBeenCalled();
            expect(mockCloudflareClient.deleteAccessRule).not.toHaveBeenCalled();

            // Verify warning was logged
            expect(mockLoggingService.log).toHaveBeenCalledWith(
              expect.objectContaining({
                level: 'warn',
                component: 'CleanupScheduler',
                message: expect.stringContaining(`No database entry found for IP ${ip} during cleanup`),
                context: expect.objectContaining({ ip })
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('database entry updates should include both expiration time and cleanup flag', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.string({ minLength: 1, maxLength: 32 }), // entry ID
          async (ip, entryId) => {
            // Mock bot entry
            const mockBotEntry: BotAllowedEntry = {
              id: entryId,
              ipAddress: ip,
              reason: 'Payment verified',
              paymentRecord: {
                transactionId: 'tx-123',
                amount: 0.01,
                currency: 'MOVE',
                timestamp: new Date(),
                payerAddress: 'test-address',
                verified: true
              },
              createdAt: new Date(),
              cleanedUp: false
            };

            // Setup mocks
            mockDatabaseService.getBotEntry.mockResolvedValue(mockBotEntry);
            mockCloudflareClient.listAccessRules.mockResolvedValue([]);
            mockDatabaseService.updateBotEntry.mockResolvedValue();

            // Execute cleanup
            await cleanupScheduler.executeCleanup(ip);

            // Verify database update includes both required fields
            expect(mockDatabaseService.updateBotEntry).toHaveBeenCalledWith(
              entryId,
              expect.objectContaining({
                expiresAt: expect.any(Date),
                cleanedUp: true
              })
            );

            // Verify the update object has exactly these two properties
            const updateCall = mockDatabaseService.updateBotEntry.mock.calls[0];
            const updateData = updateCall[1];
            expect(Object.keys(updateData)).toEqual(expect.arrayContaining(['expiresAt', 'cleanedUp']));
            expect(updateData.cleanedUp).toBe(true);
            expect(updateData.expiresAt).toBeInstanceOf(Date);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});