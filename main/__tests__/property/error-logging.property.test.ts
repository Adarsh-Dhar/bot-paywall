/**
 * Property-based tests for error logging
 * **Feature: automated-bot-payment-system, Property 14: Errors are logged with detailed context**
 */

import fc from 'fast-check';
import { LoggingServiceImpl } from '../../lib/bot-payment-system/services/logging';

describe('Error Logging Properties', () => {
  let loggingService: LoggingServiceImpl;

  beforeEach(() => {
    loggingService = new LoggingServiceImpl({
      logToConsole: false, // Disable console output for tests
      logToFile: false
    });
  });

  describe('Property 14: Errors are logged with detailed context', () => {
    test('any error should be logged with component, error details, and context', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }), // component name
          fc.string({ minLength: 1, maxLength: 100 }), // error message
          fc.string({ minLength: 1, maxLength: 30 }), // error name
          fc.option(fc.record({
            ip: fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
            operation: fc.string({ minLength: 1, maxLength: 30 }),
            transactionId: fc.string({ minLength: 1, maxLength: 64 })
          })), // optional context
          async (component, errorMessage, errorName, context) => {
            // Create error object
            const error = new Error(errorMessage);
            error.name = errorName;
            
            const beforeTime = new Date();
            
            // Log error
            await loggingService.logError(component, error, context || undefined);
            
            const afterTime = new Date();
            const logs = loggingService.getRecentLogs(1);
            
            // Verify log was created
            expect(logs).toHaveLength(1);
            const logEntry = logs[0];
            
            // Verify timestamp is within expected range
            expect(logEntry.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
            expect(logEntry.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
            
            // Verify log level is error
            expect(logEntry.level).toBe('error');
            
            // Verify component matches
            expect(logEntry.component).toBe(component);
            
            // Verify message contains component and error message
            expect(logEntry.message).toContain(component);
            expect(logEntry.message).toContain(errorMessage);
            
            // Verify context contains all error details
            expect(logEntry.context).toBeDefined();
            expect(logEntry.context!.errorName).toBe(errorName);
            expect(logEntry.context!.errorMessage).toBe(errorMessage);
            expect(logEntry.context!.errorStack).toBe(error.stack);
            expect(logEntry.context!.errorType).toBe('exception');
            
            // Verify additional context is preserved
            if (context) {
              Object.keys(context).forEach(key => {
                expect(logEntry.context![key]).toBe(context[key]);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('error logs should always use error level', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (component, errorMessage) => {
            const error = new Error(errorMessage);
            
            await loggingService.logError(component, error);
            
            const logs = loggingService.getRecentLogs(1);
            expect(logs[0].level).toBe('error');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('error logs should preserve stack traces', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (component, errorMessage) => {
            const error = new Error(errorMessage);
            
            await loggingService.logError(component, error);
            
            const logs = loggingService.getRecentLogs(1);
            const context = logs[0].context!;
            
            // Stack trace should be preserved
            expect(context.errorStack).toBeDefined();
            expect(typeof context.errorStack).toBe('string');
            expect(context.errorStack).toContain('Error');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('error logs should be searchable by error message', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 8, maxLength: 100 }), // Longer for better search
          async (component, errorMessage) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            const error = new Error(errorMessage);
            await loggingService.logError(component, error);
            
            // Search for logs containing the error message
            const searchResults = loggingService.searchLogs(errorMessage);
            
            // Should find exactly one log
            expect(searchResults).toHaveLength(1);
            expect(searchResults[0].context!.errorMessage).toBe(errorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('error logs should be filterable by component', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (component, errorMessage) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            const error = new Error(errorMessage);
            await loggingService.logError(component, error);
            
            // Add some other component logs to test filtering
            await loggingService.log({
              timestamp: new Date(),
              level: 'info',
              component: 'OtherComponent',
              message: 'Other message'
            });
            
            // Filter by error component
            const componentLogs = loggingService.getLogsByComponent(component);
            
            // Should find exactly one log for this component
            expect(componentLogs).toHaveLength(1);
            expect(componentLogs[0].component).toBe(component);
            expect(componentLogs[0].level).toBe('error');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('error logs should be retrievable by error level filter', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (component, errorMessage) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            const error = new Error(errorMessage);
            await loggingService.logError(component, error);
            
            // Add some non-error logs
            await loggingService.log({
              timestamp: new Date(),
              level: 'info',
              component: 'TestComponent',
              message: 'Info message'
            });
            
            // Filter by error level
            const errorLogs = loggingService.getLogsByLevel('error');
            
            // Should find exactly one error log
            expect(errorLogs).toHaveLength(1);
            expect(errorLogs[0].level).toBe('error');
            expect(errorLogs[0].context!.errorMessage).toBe(errorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('error logs with context should preserve all context fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.record({
            ip: fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
            operation: fc.string({ minLength: 1, maxLength: 30 }),
            transactionId: fc.string({ minLength: 1, maxLength: 64 }),
            userId: fc.string({ minLength: 1, maxLength: 20 })
          }),
          async (component, errorMessage, additionalContext) => {
            const error = new Error(errorMessage);
            
            await loggingService.logError(component, error, additionalContext);
            
            const logs = loggingService.getRecentLogs(1);
            const context = logs[0].context!;
            
            // Verify all additional context fields are preserved
            expect(context.ip).toBe(additionalContext.ip);
            expect(context.operation).toBe(additionalContext.operation);
            expect(context.transactionId).toBe(additionalContext.transactionId);
            expect(context.userId).toBe(additionalContext.userId);
            
            // Verify error-specific fields are also present
            expect(context.errorName).toBe(error.name);
            expect(context.errorMessage).toBe(errorMessage);
            expect(context.errorStack).toBeDefined();
            expect(context.errorType).toBe('exception');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple error logs should maintain chronological order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              component: fc.string({ minLength: 1, maxLength: 30 }),
              errorMessage: fc.string({ minLength: 1, maxLength: 50 }),
              errorName: fc.string({ minLength: 1, maxLength: 20 })
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (errorEvents) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            // Log all errors with small delays
            for (const event of errorEvents) {
              const error = new Error(event.errorMessage);
              error.name = event.errorName;
              
              await loggingService.logError(event.component, error);
              
              // Small delay to ensure different timestamps
              await new Promise(resolve => setTimeout(resolve, 1));
            }
            
            // Get all error logs
            const errorLogs = loggingService.getLogsByLevel('error');
            
            // Should have same number of logs as events
            expect(errorLogs).toHaveLength(errorEvents.length);
            
            // Verify chronological order
            for (let i = 1; i < errorLogs.length; i++) {
              expect(errorLogs[i].timestamp.getTime()).toBeGreaterThanOrEqual(
                errorLogs[i - 1].timestamp.getTime()
              );
            }
            
            // Verify all error messages are present
            const loggedMessages = errorLogs.map(log => log.context!.errorMessage);
            const expectedMessages = errorEvents.map(event => event.errorMessage);
            expect(loggedMessages).toEqual(expectedMessages);
          }
        ),
        { numRuns: 50 } // Reduced due to timing complexity
      );
    });

    test('error logs should include all required context fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.option(fc.record({
            customField: fc.string({ minLength: 1, maxLength: 20 })
          })),
          async (component, errorMessage, errorName, additionalContext) => {
            const error = new Error(errorMessage);
            error.name = errorName;
            
            await loggingService.logError(component, error, additionalContext || undefined);
            
            const logs = loggingService.getRecentLogs(1);
            const context = logs[0].context!;
            
            // Verify required error context fields are present
            expect(context).toHaveProperty('errorName', errorName);
            expect(context).toHaveProperty('errorMessage', errorMessage);
            expect(context).toHaveProperty('errorStack');
            expect(context).toHaveProperty('errorType', 'exception');
            
            // Verify stack trace is a string
            expect(typeof context.errorStack).toBe('string');
            
            // If additional context provided, should be included
            if (additionalContext) {
              expect(context.customField).toBe(additionalContext.customField);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('error logs should contribute to error statistics', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              component: fc.string({ minLength: 1, maxLength: 30 }),
              errorMessage: fc.string({ minLength: 1, maxLength: 50 })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (errorEvents) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            // Log all errors
            for (const event of errorEvents) {
              const error = new Error(event.errorMessage);
              await loggingService.logError(event.component, error);
            }
            
            // Get statistics
            const stats = loggingService.getLogStats();
            
            // Verify total count
            expect(stats.totalLogs).toBe(errorEvents.length);
            
            // Verify error count
            expect(stats.errorCount).toBe(errorEvents.length);
            expect(stats.infoCount).toBe(0);
            expect(stats.warnCount).toBe(0);
            
            // Verify component counts
            const componentCounts: Record<string, number> = {};
            for (const event of errorEvents) {
              componentCounts[event.component] = (componentCounts[event.component] || 0) + 1;
            }
            
            Object.keys(componentCounts).forEach(component => {
              expect(stats.componentCounts[component]).toBe(componentCounts[component]);
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    test('error logs should be retrievable with stack traces', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (component, errorMessage) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            const error = new Error(errorMessage);
            await loggingService.logError(component, error);
            
            // Add some non-error logs
            await loggingService.log({
              timestamp: new Date(),
              level: 'info',
              component: 'TestComponent',
              message: 'Info message'
            });
            
            // Get error logs with stack traces
            const errorLogsWithStacks = loggingService.getErrorLogsWithStackTraces();
            
            // Should find exactly one error log with stack trace
            expect(errorLogsWithStacks).toHaveLength(1);
            expect(errorLogsWithStacks[0].level).toBe('error');
            expect(errorLogsWithStacks[0].context!.errorStack).toBeDefined();
            expect(typeof errorLogsWithStacks[0].context!.errorStack).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('error logs should be exportable with all error details', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 30 }),
          async (component, errorMessage, errorName) => {
            // Clear previous logs
            loggingService.clearLogs();
            
            const error = new Error(errorMessage);
            error.name = errorName;
            
            await loggingService.logError(component, error);
            
            // Export to JSON
            const jsonExport = loggingService.exportLogsAsJSON();
            
            // Parse JSON to verify structure
            const parsedLogs = JSON.parse(jsonExport);
            expect(Array.isArray(parsedLogs)).toBe(true);
            expect(parsedLogs).toHaveLength(1);
            
            const exportedLog = parsedLogs[0];
            expect(exportedLog.component).toBe(component);
            expect(exportedLog.level).toBe('error');
            expect(exportedLog.context.errorName).toBe(errorName);
            expect(exportedLog.context.errorMessage).toBe(errorMessage);
            expect(exportedLog.context.errorStack).toBeDefined();
            expect(exportedLog.context.errorType).toBe('exception');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});