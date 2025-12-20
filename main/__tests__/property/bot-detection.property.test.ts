/**
 * Property-based tests for bot execution detection
 * **Feature: automated-bot-payment-system, Property 1: Bot execution detection triggers payment verification**
 */

import fc from 'fast-check';
import { BotExecutionMonitorImpl } from '../../lib/bot-payment-system/services/bot-execution-monitor';
import { LoggingService } from '../../lib/bot-payment-system/interfaces';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

// Mock logging service
const mockLoggingService: jest.Mocked<LoggingService> = {
  log: jest.fn(),
  logPaymentVerification: jest.fn(),
  logCloudflareOperation: jest.fn(),
  logDatabaseOperation: jest.fn(),
  logError: jest.fn()
};

describe('Bot Detection Properties', () => {
  let tempDir: string;
  let tempLogFile: string;
  let botMonitor: BotExecutionMonitorImpl;

  beforeEach(async () => {
    // Create temporary directory and log file for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bot-monitor-test-'));
    tempLogFile = path.join(tempDir, 'test-webscrapper.log');
    
    // Create empty log file
    await fs.writeFile(tempLogFile, '');
    
    botMonitor = new BotExecutionMonitorImpl(mockLoggingService, {
      webscrapperPath: tempDir,
      logFilePath: tempLogFile,
      checkInterval: 100 // Fast interval for testing
    });
    
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Stop monitoring and cleanup
    await botMonitor.stopMonitoring();
    
    // Clean up temporary files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Property 1: Bot execution detection triggers payment verification', () => {
    test('any bot execution event should trigger all registered callbacks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.integer({ min: 1, max: 5 }), // number of callbacks to register
          async (ip, callbackCount) => {
            const callbackResults: string[] = [];
            
            // Register multiple callbacks
            for (let i = 0; i < callbackCount; i++) {
              botMonitor.onBotExecution(async (detectedIP: string) => {
                callbackResults.push(`callback-${i}-${detectedIP}`);
              });
            }
            
            // Trigger bot execution manually
            await botMonitor.triggerBotExecution(ip);
            
            // Verify all callbacks were triggered
            expect(callbackResults).toHaveLength(callbackCount);
            
            // Verify each callback received the correct IP
            for (let i = 0; i < callbackCount; i++) {
              expect(callbackResults[i]).toBe(`callback-${i}-${ip}`);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('bot execution detection should log the event with IP and callback count', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.integer({ min: 0, max: 3 }), // number of callbacks
          async (ip, callbackCount) => {
            // Register callbacks
            for (let i = 0; i < callbackCount; i++) {
              botMonitor.onBotExecution(async () => {
                // Empty callback for testing
              });
            }
            
            // Trigger bot execution
            await botMonitor.triggerBotExecution(ip);
            
            // Verify logging was called with correct parameters
            expect(mockLoggingService.log).toHaveBeenCalledWith(
              expect.objectContaining({
                level: 'info',
                component: 'BotExecutionMonitor',
                message: 'Bot execution detected, triggering callbacks',
                context: expect.objectContaining({
                  ip,
                  callbackCount
                })
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('callback execution failures should be logged without stopping other callbacks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.integer({ min: 1, max: 3 }), // failing callback index
          fc.string({ minLength: 5, maxLength: 50 }), // error message
          async (ip, failingCallbackIndex, errorMessage) => {
            const callbackResults: string[] = [];
            const totalCallbacks = 4;
            
            // Register callbacks, with one that fails
            for (let i = 0; i < totalCallbacks; i++) {
              if (i === failingCallbackIndex) {
                // Failing callback
                botMonitor.onBotExecution(async () => {
                  throw new Error(errorMessage);
                });
              } else {
                // Successful callback
                botMonitor.onBotExecution(async (detectedIP: string) => {
                  callbackResults.push(`success-${i}-${detectedIP}`);
                });
              }
            }
            
            // Trigger bot execution
            await botMonitor.triggerBotExecution(ip);
            
            // Verify successful callbacks still executed
            expect(callbackResults).toHaveLength(totalCallbacks - 1);
            
            // Verify error was logged
            expect(mockLoggingService.logError).toHaveBeenCalledWith(
              'BotExecutionMonitor',
              expect.any(Error),
              expect.objectContaining({
                operation: 'callback_execution',
                ip,
                callbackIndex: failingCallbackIndex
              })
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    test('monitoring status should be trackable', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // whether to start monitoring
          async (shouldStartMonitoring) => {
            // Initial state should be not monitoring
            expect(botMonitor.isCurrentlyMonitoring()).toBe(false);
            
            if (shouldStartMonitoring) {
              await botMonitor.startMonitoring();
              expect(botMonitor.isCurrentlyMonitoring()).toBe(true);
              
              await botMonitor.stopMonitoring();
              expect(botMonitor.isCurrentlyMonitoring()).toBe(false);
            } else {
              // Should remain false if not started
              expect(botMonitor.isCurrentlyMonitoring()).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('monitoring statistics should reflect current state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 5 }), // number of callbacks to register
          async (callbackCount) => {
            // Register callbacks
            for (let i = 0; i < callbackCount; i++) {
              botMonitor.onBotExecution(async () => {
                // Empty callback
              });
            }
            
            const stats = botMonitor.getMonitoringStats();
            
            // Verify statistics
            expect(stats.callbackCount).toBe(callbackCount);
            expect(stats.isMonitoring).toBe(false); // Not started yet
            expect(stats.webscrapperPath).toBe(tempDir);
            expect(stats.logFilePath).toBe(tempLogFile);
            expect(typeof stats.monitoredProcessCount).toBe('number');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('log file changes should trigger bot detection when monitoring', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }), // log content to append
          async (logContent) => {
            let detectedIP: string | null = null;
            
            // Register callback to capture detected IP
            botMonitor.onBotExecution(async (ip: string) => {
              detectedIP = ip;
            });
            
            // Start monitoring
            await botMonitor.startMonitoring();
            
            // Wait a bit for monitoring to initialize
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Append to log file to simulate webscraper activity
            await fs.appendFile(tempLogFile, logContent + '\n');
            
            // Wait for file change detection
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Stop monitoring
            await botMonitor.stopMonitoring();
            
            // Should have detected bot execution and captured IP
            expect(detectedIP).toBeTruthy();
            expect(typeof detectedIP).toBe('string');
          }
        ),
        { numRuns: 20 } // Reduced due to file system operations
      );
    });

    test('callback registration and removal should work correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.integer({ min: 2, max: 5 }), // number of callbacks
          async (ip, totalCallbacks) => {
            const callbacks: Array<(ip: string) => Promise<void>> = [];
            const callbackResults: string[] = [];
            
            // Create and register callbacks
            for (let i = 0; i < totalCallbacks; i++) {
              const callback = async (detectedIP: string) => {
                callbackResults.push(`callback-${i}-${detectedIP}`);
              };
              callbacks.push(callback);
              botMonitor.onBotExecution(callback);
            }
            
            // Remove one callback
            const callbackToRemove = callbacks[0];
            botMonitor.removeCallback(callbackToRemove);
            
            // Trigger bot execution
            await botMonitor.triggerBotExecution(ip);
            
            // Should have one less callback result
            expect(callbackResults).toHaveLength(totalCallbacks - 1);
            
            // The removed callback should not have been called
            expect(callbackResults.find(result => result.startsWith('callback-0-'))).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('webscraper path validation should work correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // whether path should exist
          async (pathShouldExist) => {
            let testMonitor: BotExecutionMonitorImpl;
            
            if (pathShouldExist) {
              // Use existing temp directory
              testMonitor = new BotExecutionMonitorImpl(mockLoggingService, {
                webscrapperPath: tempDir
              });
              
              const isValid = await testMonitor.validateWebscrapperPath();
              expect(isValid).toBe(true);
            } else {
              // Use non-existent directory
              const nonExistentPath = path.join(tempDir, 'non-existent-dir');
              testMonitor = new BotExecutionMonitorImpl(mockLoggingService, {
                webscrapperPath: nonExistentPath
              });
              
              const isValid = await testMonitor.validateWebscrapperPath();
              expect(isValid).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('log size tracking should work correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }), // content to append
          async (contentLines) => {
            // Get initial log size
            const initialSize = await botMonitor.getCurrentLogSize();
            expect(initialSize).toBe(0); // Should be empty initially
            
            let expectedSize = 0;
            
            // Append content and verify size tracking
            for (const content of contentLines) {
              await fs.appendFile(tempLogFile, content + '\n');
              expectedSize += content.length + 1; // +1 for newline
              
              const currentSize = await botMonitor.getCurrentLogSize();
              expect(currentSize).toBe(expectedSize);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('multiple start monitoring calls should not cause issues', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }), // number of start calls
          async (startCalls) => {
            // Call start monitoring multiple times
            for (let i = 0; i < startCalls; i++) {
              await botMonitor.startMonitoring();
              expect(botMonitor.isCurrentlyMonitoring()).toBe(true);
            }
            
            // Should still be monitoring
            expect(botMonitor.isCurrentlyMonitoring()).toBe(true);
            
            // Should have logged warning about already started
            expect(mockLoggingService.log).toHaveBeenCalledWith(
              expect.objectContaining({
                level: 'warn',
                component: 'BotExecutionMonitor',
                message: 'Monitoring already started'
              })
            );
            
            // Stop should work normally
            await botMonitor.stopMonitoring();
            expect(botMonitor.isCurrentlyMonitoring()).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('force check should work when monitoring is active', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // whether monitoring is active
          async (isMonitoringActive) => {
            if (isMonitoringActive) {
              await botMonitor.startMonitoring();
              
              // Force check should work
              await expect(botMonitor.forceCheck()).resolves.not.toThrow();
              
              await botMonitor.stopMonitoring();
            } else {
              // Force check should throw when not monitoring
              await expect(botMonitor.forceCheck()).rejects.toThrow('Monitoring is not active');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});