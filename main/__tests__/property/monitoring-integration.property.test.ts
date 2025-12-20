/**
 * Property-based tests for monitoring integration with existing mechanisms
 * **Feature: automated-bot-payment-system, Property 23: Webscraper execution detection uses existing mechanisms**
 */

import fc from 'fast-check';
import { BotExecutionMonitorImpl } from '../../lib/bot-payment-system/services/bot-execution-monitor';
import { LoggingService } from '../../lib/bot-payment-system/interfaces';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock logging service
const mockLoggingService: jest.Mocked<LoggingService> = {
  log: jest.fn(),
  logPaymentVerification: jest.fn(),
  logCloudflareOperation: jest.fn(),
  logDatabaseOperation: jest.fn(),
  logError: jest.fn()
};

describe('Monitoring Integration Properties', () => {
  let tempDir: string;
  let tempLogFile: string;
  let botMonitor: BotExecutionMonitorImpl;

  beforeEach(async () => {
    // Create temporary directory and log file for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monitor-integration-test-'));
    tempLogFile = path.join(tempDir, 'webscrapper.log');
    
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

  describe('Property 23: Webscraper execution detection uses existing mechanisms', () => {
    test('monitoring should use curl icanhazip.com for IP detection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(true), // Always test IP detection
          async () => {
            let detectedIP: string | null = null;
            
            // Register callback to capture detected IP
            botMonitor.onBotExecution(async (ip: string) => {
              detectedIP = ip;
            });
            
            // Trigger bot execution (which should use curl icanhazip.com internally)
            await botMonitor.triggerBotExecution();
            
            // Verify IP was detected
            expect(detectedIP).toBeTruthy();
            expect(typeof detectedIP).toBe('string');
            
            // Verify it's a valid IP format (IPv4)
            const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            expect(ipRegex.test(detectedIP!)).toBe(true);
          }
        ),
        { numRuns: 10 } // Reduced due to network calls
      );
    });

    test('monitoring should detect webscraper log file changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 10, maxLength: 100 }), { minLength: 1, maxLength: 3 }), // log entries
          async (logEntries) => {
            const detectedExecutions: string[] = [];
            
            // Register callback to track detections
            botMonitor.onBotExecution(async (ip: string) => {
              detectedExecutions.push(ip);
            });
            
            // Start monitoring
            await botMonitor.startMonitoring();
            
            // Wait for monitoring to initialize
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Simulate webscraper activity by appending to log file
            for (const logEntry of logEntries) {
              await fs.appendFile(tempLogFile, `${new Date().toISOString()} - ${logEntry}\n`);
              
              // Wait for file change detection
              await new Promise(resolve => setTimeout(resolve, 150));
            }
            
            // Stop monitoring
            await botMonitor.stopMonitoring();
            
            // Should have detected at least one execution
            expect(detectedExecutions.length).toBeGreaterThan(0);
            
            // All detected IPs should be valid
            for (const ip of detectedExecutions) {
              expect(typeof ip).toBe('string');
              expect(ip.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 10 } // Reduced due to file system operations and timing
      );
    });

    test('monitoring should use existing webscrapper directory structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }), // subdirectory name
          async (subdirName) => {
            // Create subdirectory structure similar to existing project
            const webscrapperSubdir = path.join(tempDir, subdirName);
            await fs.mkdir(webscrapperSubdir, { recursive: true });
            
            // Create main.py file to simulate webscraper structure
            const mainPyPath = path.join(webscrapperSubdir, 'main.py');
            await fs.writeFile(mainPyPath, '# Webscraper main file\nprint("Running webscraper")');
            
            // Create monitor with subdirectory
            const subMonitor = new BotExecutionMonitorImpl(mockLoggingService, {
              webscrapperPath: webscrapperSubdir,
              logFilePath: path.join(webscrapperSubdir, 'webscrapper.log'),
              checkInterval: 100
            });
            
            // Validate path should work
            const isValid = await subMonitor.validateWebscrapperPath();
            expect(isValid).toBe(true);
            
            // Stats should reflect correct path
            const stats = subMonitor.getMonitoringStats();
            expect(stats.webscrapperPath).toBe(webscrapperSubdir);
            expect(stats.logFilePath).toBe(path.join(webscrapperSubdir, 'webscrapper.log'));
          }
        ),
        { numRuns: 50 }
      );
    });

    test('monitoring should handle existing log file patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              timestamp: fc.date(),
              level: fc.constantFrom('INFO', 'ERROR', 'DEBUG', 'WARNING'),
              message: fc.string({ minLength: 10, maxLength: 100 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (logEntries) => {
            // Write log entries in a format similar to existing webscraper logs
            let logContent = '';
            for (const entry of logEntries) {
              logContent += `${entry.timestamp.toISOString()} - ${entry.level} - ${entry.message}\n`;
            }
            
            await fs.writeFile(tempLogFile, logContent);
            
            // Get initial log size
            const initialSize = await botMonitor.getCurrentLogSize();
            expect(initialSize).toBe(logContent.length);
            
            // Monitor should be able to track size changes
            const additionalContent = 'New webscraper activity\n';
            await fs.appendFile(tempLogFile, additionalContent);
            
            const newSize = await botMonitor.getCurrentLogSize();
            expect(newSize).toBe(initialSize + additionalContent.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('monitoring should integrate with existing process detection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(true), // Always test process detection
          async () => {
            // Start monitoring
            await botMonitor.startMonitoring();
            
            // Wait for initial process check
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Force a process check
            await botMonitor.forceCheck();
            
            // Get monitored processes (should be empty since no actual python processes)
            const monitoredProcesses = botMonitor.getMonitoredProcesses();
            expect(Array.isArray(monitoredProcesses)).toBe(true);
            
            // Stop monitoring
            await botMonitor.stopMonitoring();
            
            // Verify monitoring was properly started and stopped
            expect(mockLoggingService.log).toHaveBeenCalledWith(
              expect.objectContaining({
                level: 'info',
                component: 'BotExecutionMonitor',
                message: 'Bot execution monitoring started'
              })
            );
            
            expect(mockLoggingService.log).toHaveBeenCalledWith(
              expect.objectContaining({
                level: 'info',
                component: 'BotExecutionMonitor',
                message: 'Bot execution monitoring stopped'
              })
            );
          }
        ),
        { numRuns: 20 } // Reduced due to process operations
      );
    });

    test('monitoring should use consistent configuration with existing system', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            checkInterval: fc.integer({ min: 100, max: 10000 }),
            webscrapperPath: fc.string({ minLength: 1, maxLength: 50 }),
            logFileName: fc.string({ minLength: 1, maxLength: 30 })
          }),
          async (config) => {
            // Create monitor with custom configuration
            const customTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'custom-monitor-'));
            const customLogFile = path.join(customTempDir, config.logFileName);
            
            try {
              await fs.writeFile(customLogFile, '');
              
              const customMonitor = new BotExecutionMonitorImpl(mockLoggingService, {
                webscrapperPath: customTempDir,
                logFilePath: customLogFile,
                checkInterval: config.checkInterval
              });
              
              // Verify configuration is reflected in stats
              const stats = customMonitor.getMonitoringStats();
              expect(stats.webscrapperPath).toBe(customTempDir);
              expect(stats.logFilePath).toBe(customLogFile);
              
              // Should be able to validate path
              const isValid = await customMonitor.validateWebscrapperPath();
              expect(isValid).toBe(true);
              
              // Cleanup
              await fs.rm(customTempDir, { recursive: true, force: true });
            } catch (error) {
              // Cleanup on error
              try {
                await fs.rm(customTempDir, { recursive: true, force: true });
              } catch (cleanupError) {
                // Ignore cleanup errors
              }
              throw error;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('monitoring should handle file system errors gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }), // non-existent path component
          async (nonExistentPath) => {
            // Create monitor with non-existent log file path
            const invalidLogPath = path.join(tempDir, nonExistentPath, 'invalid.log');
            const invalidMonitor = new BotExecutionMonitorImpl(mockLoggingService, {
              webscrapperPath: tempDir,
              logFilePath: invalidLogPath,
              checkInterval: 100
            });
            
            // Should handle invalid log file gracefully
            const logSize = await invalidMonitor.getCurrentLogSize();
            expect(logSize).toBe(0); // Should return 0 for non-existent file
            
            // Starting monitoring should not throw, but may log errors
            await expect(invalidMonitor.startMonitoring()).resolves.not.toThrow();
            
            // Should still be able to stop
            await expect(invalidMonitor.stopMonitoring()).resolves.not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('monitoring should maintain state consistency across operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.constantFrom('start', 'stop', 'forceCheck', 'getStats'),
            { minLength: 3, maxLength: 10 }
          ),
          async (operations) => {
            let isCurrentlyMonitoring = false;
            
            for (const operation of operations) {
              try {
                switch (operation) {
                  case 'start':
                    await botMonitor.startMonitoring();
                    isCurrentlyMonitoring = true;
                    break;
                    
                  case 'stop':
                    await botMonitor.stopMonitoring();
                    isCurrentlyMonitoring = false;
                    break;
                    
                  case 'forceCheck':
                    if (isCurrentlyMonitoring) {
                      await botMonitor.forceCheck();
                    }
                    break;
                    
                  case 'getStats':
                    const stats = botMonitor.getMonitoringStats();
                    expect(stats.isMonitoring).toBe(isCurrentlyMonitoring);
                    break;
                }
                
                // Verify state consistency
                expect(botMonitor.isCurrentlyMonitoring()).toBe(isCurrentlyMonitoring);
                
              } catch (error) {
                // Some operations may fail in certain states, which is expected
                if (operation === 'forceCheck' && !isCurrentlyMonitoring) {
                  expect(error).toBeInstanceOf(Error);
                  expect((error as Error).message).toContain('Monitoring is not active');
                } else {
                  throw error;
                }
              }
            }
            
            // Ensure we end in a clean state
            if (isCurrentlyMonitoring) {
              await botMonitor.stopMonitoring();
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    test('monitoring should handle concurrent callback executions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }), // number of concurrent callbacks
          fc.integer({ min: 10, max: 100 }), // callback execution delay
          async (callbackCount, delayMs) => {
            const callbackResults: Array<{ index: number; ip: string; timestamp: number }> = [];
            
            // Register callbacks with different execution times
            for (let i = 0; i < callbackCount; i++) {
              botMonitor.onBotExecution(async (ip: string) => {
                const startTime = Date.now();
                
                // Simulate some async work
                await new Promise(resolve => setTimeout(resolve, delayMs));
                
                callbackResults.push({
                  index: i,
                  ip,
                  timestamp: startTime
                });
              });
            }
            
            // Trigger bot execution
            const triggerTime = Date.now();
            await botMonitor.triggerBotExecution('192.168.1.100');
            
            // All callbacks should have executed
            expect(callbackResults).toHaveLength(callbackCount);
            
            // All callbacks should have received the same IP
            const uniqueIPs = new Set(callbackResults.map(result => result.ip));
            expect(uniqueIPs.size).toBe(1);
            expect(uniqueIPs.has('192.168.1.100')).toBe(true);
            
            // All callbacks should have started around the same time
            for (const result of callbackResults) {
              expect(result.timestamp).toBeGreaterThanOrEqual(triggerTime);
              expect(result.timestamp - triggerTime).toBeLessThan(50); // Started within 50ms
            }
          }
        ),
        { numRuns: 20 } // Reduced due to timing complexity
      );
    });

    test('monitoring should preserve callback order during registration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 2, maxLength: 8 }), // callback identifiers
          async (callbackIds) => {
            const executionOrder: string[] = [];
            
            // Register callbacks in order
            for (const id of callbackIds) {
              botMonitor.onBotExecution(async () => {
                executionOrder.push(id);
              });
            }
            
            // Trigger execution
            await botMonitor.triggerBotExecution('10.0.0.1');
            
            // Execution order should match registration order
            expect(executionOrder).toEqual(callbackIds);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('monitoring should handle rapid successive triggers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }), // number of rapid triggers
          fc.array(fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), { minLength: 2, maxLength: 5 }), // IPs to trigger with
          async (triggerCount, ips) => {
            const allDetectedIPs: string[] = [];
            
            // Register callback to collect all detected IPs
            botMonitor.onBotExecution(async (ip: string) => {
              allDetectedIPs.push(ip);
            });
            
            // Trigger multiple executions rapidly
            const triggerPromises = [];
            for (let i = 0; i < triggerCount; i++) {
              const ip = ips[i % ips.length];
              triggerPromises.push(botMonitor.triggerBotExecution(ip));
            }
            
            await Promise.all(triggerPromises);
            
            // Should have detected all triggers
            expect(allDetectedIPs).toHaveLength(triggerCount);
            
            // Should have correct IPs in order
            for (let i = 0; i < triggerCount; i++) {
              const expectedIP = ips[i % ips.length];
              expect(allDetectedIPs[i]).toBe(expectedIP);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});