/**
 * Property-based tests for Cloudflare operation logging
 * **Feature: automated-bot-payment-system, Property 12: Cloudflare operations are logged with status**
 */

import fc from 'fast-check';
import { LoggingServiceImpl } from '../../lib/bot-payment-system/services/logging';

describe('Cloudflare Operation Logging Properties', () => {
  let loggingService: LoggingServiceImpl;

  beforeEach(() => {
    loggingService = new LoggingServiceImpl({
      logToConsole: false, // Disable console output for tests
      logToFile: false
    });
  });

  describe('Property 12: Cloudflare operations are logged with status', () => {
    test('any Cloudflare operation should log operation type, IP, and success status', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('create_rule', 'delete_rule', 'list_rules', 'update_rule'), // operation types
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.boolean(), // success status
          fc.option(fc.string({ minLength: 1, maxLength: 100 })), // optional error message
          async (operation, ip, success, error) => {
            const beforeTime = new Date();
            
            // Log Cloudflare operation
            await loggingService.logCloudflareOperation(operation, ip, success, error || undefined);
            
            const afterTime = new Date();
            const logs = loggingService.getRecentLogs(1);
            
            // Verify log was created
            expect(logs).toHaveLength(1);
            const logEntry = logs[0];
            
            // Verify timestamp is within expected range
            expect(logEntry.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
            expect(logEntry.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
            
            // Verify log level matches success status
            expect(logEntry.level).toBe(success ? 'info' : 'error');
            
            // Verify component is correct
            expect(logEntry.component).toBe('CloudflareClient');
            
            // Verify message contains operation, IP, and status
            expect(logEntry.message).toContain(operation);
            expect(logEntry.message).toContain(ip);
            expect(logEntry.message).toContain(success ? 'succeeded' : 'failed');
            
            // If error provided, should be in message
            if (error) {
              expect(logEntry.message).toContain(error);
            }
            
            // Verify context contains all required fields
            expect(logEntry.context).toBeDefined();
            expect(logEntry.context!.operation).toBe(operation);
            expect(logEntry.context!.ip).toBe(ip);
            expect(logEntry.context!.success).toBe(success);
            expect(logEntry.context!.service).toBe('cloudflare');
            
            // Error should be in context if provided
            if (error) {
              expect(logEntry.context!.error).toBe(error);
            } else {
              expect(logEntry.context!.error).toBeUndefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('successful Cloudflare operations should always use info level', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('create_rule', 'delete_rule', 'list_rules', 'update_rule'),
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
          async (operation, ip) => {
            await loggingService.logCloudflareOperation(operation, ip, true);
            
            const logs = loggingService.getRecentLogs(1);
            expect(logs[0].level).toBe('info');
            expect(logs[0].context!.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('failed Cloudflare operations should always use error level', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('create_rule', 'delete_rule', 'list_rules', 'update_rule'),
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
          fc.option(fc.string({ minLength: 1, maxLength: 100 })),
          async (operation, ip, error) => {
            await loggingService.logCloudflareOperation(operation, ip, false, error || undefined);
            
            const logs = loggingService.getRecentLogs(1);
            expect(logs[0].level).toBe('error');
            expect(logs[0].context!.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Cloudflare operation logs should be searchable by operation type', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('create_rule', 'delete_rule', 'list_rules', 'update_rule'),
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
          fc.boolean(),
          async (operation, ip, success) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            // Log Cloudflare operation
            await loggingService.logCloudflareOperation(operation, ip, success);
            
            // Search for logs containing the operation
            const searchResults = loggingService.searchLogs(operation);
            
            // Should find exactly one log
            expect(searchResults).toHaveLength(1);
            expect(searchResults[0].context!.operation).toBe(operation);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Cloudflare operation logs should be filterable by component', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('create_rule', 'delete_rule', 'list_rules', 'update_rule'),
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
          fc.boolean(),
          async (operation, ip, success) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            // Log Cloudflare operation
            await loggingService.logCloudflareOperation(operation, ip, success);
            
            // Add some other component logs to test filtering
            await loggingService.log({
              timestamp: new Date(),
              level: 'info',
              component: 'PaymentVerification',
              message: 'Payment message'
            });
            
            // Filter by CloudflareClient component
            const cloudflareLogs = loggingService.getLogsByComponent('CloudflareClient');
            
            // Should find exactly one Cloudflare log
            expect(cloudflareLogs).toHaveLength(1);
            expect(cloudflareLogs[0].component).toBe('CloudflareClient');
            expect(cloudflareLogs[0].context!.operation).toBe(operation);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('error messages should be properly included in failed operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('create_rule', 'delete_rule', 'list_rules', 'update_rule'),
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
          fc.string({ minLength: 5, maxLength: 100 }), // error message
          async (operation, ip, errorMessage) => {
            await loggingService.logCloudflareOperation(operation, ip, false, errorMessage);
            
            const logs = loggingService.getRecentLogs(1);
            const logEntry = logs[0];
            
            // Error should be in both message and context
            expect(logEntry.message).toContain(errorMessage);
            expect(logEntry.context!.error).toBe(errorMessage);
            expect(logEntry.level).toBe('error');
            expect(logEntry.context!.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('successful operations should not include error in context', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('create_rule', 'delete_rule', 'list_rules', 'update_rule'),
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
          async (operation, ip) => {
            await loggingService.logCloudflareOperation(operation, ip, true);
            
            const logs = loggingService.getRecentLogs(1);
            const context = logs[0].context!;
            
            // Should not have error field for successful operations
            expect(context.error).toBeUndefined();
            expect(context.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple Cloudflare operations should maintain chronological order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              operation: fc.constantFrom('create_rule', 'delete_rule', 'list_rules', 'update_rule'),
              ip: fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
              success: fc.boolean(),
              error: fc.option(fc.string({ minLength: 1, maxLength: 50 }))
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (operations) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            // Log all operations with small delays
            for (const op of operations) {
              await loggingService.logCloudflareOperation(
                op.operation,
                op.ip,
                op.success,
                op.error || undefined
              );
              
              // Small delay to ensure different timestamps
              await new Promise(resolve => setTimeout(resolve, 1));
            }
            
            // Get all Cloudflare logs
            const cloudflareLogs = loggingService.getLogsByComponent('CloudflareClient');
            
            // Should have same number of logs as operations
            expect(cloudflareLogs).toHaveLength(operations.length);
            
            // Verify chronological order
            for (let i = 1; i < cloudflareLogs.length; i++) {
              expect(cloudflareLogs[i].timestamp.getTime()).toBeGreaterThanOrEqual(
                cloudflareLogs[i - 1].timestamp.getTime()
              );
            }
            
            // Verify all operations are present
            const loggedOperations = cloudflareLogs.map(log => log.context!.operation);
            const expectedOperations = operations.map(op => op.operation);
            expect(loggedOperations).toEqual(expectedOperations);
          }
        ),
        { numRuns: 50 } // Reduced due to timing complexity
      );
    });

    test('Cloudflare operation logs should include all required context fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('create_rule', 'delete_rule', 'list_rules', 'update_rule'),
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
          fc.boolean(),
          fc.option(fc.string({ minLength: 1, maxLength: 100 })),
          async (operation, ip, success, error) => {
            await loggingService.logCloudflareOperation(operation, ip, success, error || undefined);
            
            const logs = loggingService.getRecentLogs(1);
            const context = logs[0].context!;
            
            // Verify required context fields are present
            expect(context).toHaveProperty('operation', operation);
            expect(context).toHaveProperty('ip', ip);
            expect(context).toHaveProperty('success', success);
            expect(context).toHaveProperty('service', 'cloudflare');
            
            // Error field should be present only if error was provided
            if (error) {
              expect(context).toHaveProperty('error', error);
              
              // With error, should have exactly 5 fields
              const expectedFields = ['operation', 'ip', 'success', 'service', 'error'];
              const actualFields = Object.keys(context).sort();
              expect(actualFields).toEqual(expectedFields.sort());
            } else {
              expect(context.error).toBeUndefined();
              
              // Without error, should have exactly 4 fields
              const expectedFields = ['operation', 'ip', 'success', 'service'];
              const actualFields = Object.keys(context).sort();
              expect(actualFields).toEqual(expectedFields.sort());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Cloudflare operation logs should contribute to error statistics when failed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              operation: fc.constantFrom('create_rule', 'delete_rule', 'list_rules', 'update_rule'),
              ip: fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
              success: fc.boolean()
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (operations) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            // Log all operations
            for (const op of operations) {
              await loggingService.logCloudflareOperation(
                op.operation,
                op.ip,
                op.success,
                op.success ? undefined : 'Test error'
              );
            }
            
            // Get statistics
            const stats = loggingService.getLogStats();
            
            // Verify total count
            expect(stats.totalLogs).toBe(operations.length);
            
            // Verify component count
            expect(stats.componentCounts['CloudflareClient']).toBe(operations.length);
            
            // Verify level counts
            const successCount = operations.filter(op => op.success).length;
            const failureCount = operations.filter(op => !op.success).length;
            
            expect(stats.infoCount).toBe(successCount); // Successful operations use 'info'
            expect(stats.errorCount).toBe(failureCount); // Failed operations use 'error'
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Cloudflare operation logs should be exportable with all data intact', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('create_rule', 'delete_rule', 'list_rules', 'update_rule'),
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
          fc.boolean(),
          fc.option(fc.string({ minLength: 1, maxLength: 100 })),
          async (operation, ip, success, error) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            await loggingService.logCloudflareOperation(operation, ip, success, error || undefined);
            
            // Export to JSON
            const jsonExport = loggingService.exportLogsAsJSON();
            
            // Parse JSON to verify structure
            const parsedLogs = JSON.parse(jsonExport);
            expect(Array.isArray(parsedLogs)).toBe(true);
            expect(parsedLogs).toHaveLength(1);
            
            const exportedLog = parsedLogs[0];
            expect(exportedLog.component).toBe('CloudflareClient');
            expect(exportedLog.level).toBe(success ? 'info' : 'error');
            expect(exportedLog.context.operation).toBe(operation);
            expect(exportedLog.context.ip).toBe(ip);
            expect(exportedLog.context.success).toBe(success);
            expect(exportedLog.context.service).toBe('cloudflare');
            
            if (error) {
              expect(exportedLog.context.error).toBe(error);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});