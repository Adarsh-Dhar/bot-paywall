/**
 * Property-based tests for payment verification logging
 * **Feature: automated-bot-payment-system, Property 11: Payment verification events are logged completely**
 */

import fc from 'fast-check';
import { LoggingServiceImpl } from '../../lib/bot-payment-system/services/logging';

describe('Payment Logging Properties', () => {
  let loggingService: LoggingServiceImpl;

  beforeEach(() => {
    loggingService = new LoggingServiceImpl({
      logToConsole: false, // Disable console output for tests
      logToFile: false
    });
  });

  describe('Property 11: Payment verification events are logged completely', () => {
    test('any payment verification should log transaction details, IP address, and timestamp', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 64 }), // transaction ID
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.boolean(), // success status
          async (transactionId, ip, success) => {
            const beforeTime = new Date();
            
            // Log payment verification
            await loggingService.logPaymentVerification(transactionId, ip, success);
            
            const afterTime = new Date();
            const logs = loggingService.getRecentLogs(1);
            
            // Verify log was created
            expect(logs).toHaveLength(1);
            const logEntry = logs[0];
            
            // Verify timestamp is within expected range
            expect(logEntry.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
            expect(logEntry.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
            
            // Verify log level matches success status
            expect(logEntry.level).toBe(success ? 'info' : 'warn');
            
            // Verify component is correct
            expect(logEntry.component).toBe('PaymentVerification');
            
            // Verify message contains transaction ID and status
            expect(logEntry.message).toContain(transactionId);
            expect(logEntry.message).toContain(success ? 'succeeded' : 'failed');
            
            // Verify context contains all required fields
            expect(logEntry.context).toBeDefined();
            expect(logEntry.context!.transactionId).toBe(transactionId);
            expect(logEntry.context!.ip).toBe(ip);
            expect(logEntry.context!.success).toBe(success);
            expect(logEntry.context!.operation).toBe('payment_verification');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('successful payment verification should always use info level', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 64 }), // transaction ID
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (transactionId, ip) => {
            await loggingService.logPaymentVerification(transactionId, ip, true);
            
            const logs = loggingService.getRecentLogs(1);
            expect(logs[0].level).toBe('info');
            expect(logs[0].context!.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('failed payment verification should always use warn level', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 64 }), // transaction ID
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (transactionId, ip) => {
            await loggingService.logPaymentVerification(transactionId, ip, false);
            
            const logs = loggingService.getRecentLogs(1);
            expect(logs[0].level).toBe('warn');
            expect(logs[0].context!.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('payment verification logs should be searchable by transaction ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 64 }), // transaction ID (longer for better search)
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.boolean(), // success status
          async (transactionId, ip, success) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            // Log payment verification
            await loggingService.logPaymentVerification(transactionId, ip, success);
            
            // Search for logs containing the transaction ID
            const searchResults = loggingService.searchLogs(transactionId);
            
            // Should find exactly one log
            expect(searchResults).toHaveLength(1);
            expect(searchResults[0].context!.transactionId).toBe(transactionId);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('payment verification logs should be filterable by component', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 64 }), // transaction ID
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.boolean(), // success status
          async (transactionId, ip, success) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            // Log payment verification
            await loggingService.logPaymentVerification(transactionId, ip, success);
            
            // Add some other component logs to test filtering
            await loggingService.log({
              timestamp: new Date(),
              level: 'info',
              component: 'OtherComponent',
              message: 'Other message'
            });
            
            // Filter by PaymentVerification component
            const paymentLogs = loggingService.getLogsByComponent('PaymentVerification');
            
            // Should find exactly one payment verification log
            expect(paymentLogs).toHaveLength(1);
            expect(paymentLogs[0].component).toBe('PaymentVerification');
            expect(paymentLogs[0].context!.transactionId).toBe(transactionId);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple payment verification logs should maintain chronological order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              transactionId: fc.string({ minLength: 1, maxLength: 64 }),
              ip: fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
              success: fc.boolean()
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (paymentEvents) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            const timestamps: Date[] = [];
            
            // Log all payment events with small delays to ensure different timestamps
            for (const event of paymentEvents) {
              const beforeLog = new Date();
              await loggingService.logPaymentVerification(
                event.transactionId,
                event.ip,
                event.success
              );
              timestamps.push(beforeLog);
              
              // Small delay to ensure different timestamps
              await new Promise(resolve => setTimeout(resolve, 1));
            }
            
            // Get all payment verification logs
            const paymentLogs = loggingService.getLogsByComponent('PaymentVerification');
            
            // Should have same number of logs as events
            expect(paymentLogs).toHaveLength(paymentEvents.length);
            
            // Verify chronological order
            for (let i = 1; i < paymentLogs.length; i++) {
              expect(paymentLogs[i].timestamp.getTime()).toBeGreaterThanOrEqual(
                paymentLogs[i - 1].timestamp.getTime()
              );
            }
            
            // Verify all transaction IDs are present
            const loggedTransactionIds = paymentLogs.map(log => log.context!.transactionId);
            const expectedTransactionIds = paymentEvents.map(event => event.transactionId);
            expect(loggedTransactionIds).toEqual(expectedTransactionIds);
          }
        ),
        { numRuns: 50 } // Reduced due to timing complexity
      );
    });

    test('payment verification logs should include all context fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 64 }), // transaction ID
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.boolean(), // success status
          async (transactionId, ip, success) => {
            await loggingService.logPaymentVerification(transactionId, ip, success);
            
            const logs = loggingService.getRecentLogs(1);
            const context = logs[0].context!;
            
            // Verify all required context fields are present
            expect(context).toHaveProperty('transactionId', transactionId);
            expect(context).toHaveProperty('ip', ip);
            expect(context).toHaveProperty('success', success);
            expect(context).toHaveProperty('operation', 'payment_verification');
            
            // Verify context has exactly these fields (no extra fields)
            const expectedFields = ['transactionId', 'ip', 'success', 'operation'];
            const actualFields = Object.keys(context).sort();
            expect(actualFields).toEqual(expectedFields.sort());
          }
        ),
        { numRuns: 100 }
      );
    });

    test('payment verification logs should be exportable to JSON', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 64 }), // transaction ID
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.boolean(), // success status
          async (transactionId, ip, success) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            await loggingService.logPaymentVerification(transactionId, ip, success);
            
            // Export to JSON
            const jsonExport = loggingService.exportLogsAsJSON();
            
            // Parse JSON to verify structure
            const parsedLogs = JSON.parse(jsonExport);
            expect(Array.isArray(parsedLogs)).toBe(true);
            expect(parsedLogs).toHaveLength(1);
            
            const exportedLog = parsedLogs[0];
            expect(exportedLog.component).toBe('PaymentVerification');
            expect(exportedLog.context.transactionId).toBe(transactionId);
            expect(exportedLog.context.ip).toBe(ip);
            expect(exportedLog.context.success).toBe(success);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('payment verification logs should contribute to statistics', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              transactionId: fc.string({ minLength: 1, maxLength: 64 }),
              ip: fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
              success: fc.boolean()
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (paymentEvents) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            // Log all payment events
            for (const event of paymentEvents) {
              await loggingService.logPaymentVerification(
                event.transactionId,
                event.ip,
                event.success
              );
            }
            
            // Get statistics
            const stats = loggingService.getLogStats();
            
            // Verify total count
            expect(stats.totalLogs).toBe(paymentEvents.length);
            
            // Verify component count
            expect(stats.componentCounts['PaymentVerification']).toBe(paymentEvents.length);
            
            // Verify level counts
            const successCount = paymentEvents.filter(e => e.success).length;
            const failureCount = paymentEvents.filter(e => !e.success).length;
            
            expect(stats.infoCount).toBe(successCount); // Successful payments use 'info'
            expect(stats.warnCount).toBe(failureCount); // Failed payments use 'warn'
            expect(stats.errorCount).toBe(0); // Payment verification doesn't use 'error'
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});