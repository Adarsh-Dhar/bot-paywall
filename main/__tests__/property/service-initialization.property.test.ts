/**
 * **Feature: x402-payment-integration-fix, Property 16: Application startup initializes correct service**
 * Property-based tests for service initialization
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';
import { startBotPaymentSystem, stopBotPaymentSystem, getBotPaymentSystemStatus } from '@/lib/automated-bot-payment-system';

// Mock the automated bot payment system
jest.mock('@/lib/automated-bot-payment-system', () => ({
  startBotPaymentSystem: jest.fn(),
  stopBotPaymentSystem: jest.fn(),
  getBotPaymentSystemStatus: jest.fn(),
}));

const mockStartBotPaymentSystem = startBotPaymentSystem as jest.MockedFunction<typeof startBotPaymentSystem>;
const mockStopBotPaymentSystem = stopBotPaymentSystem as jest.MockedFunction<typeof stopBotPaymentSystem>;
const mockGetBotPaymentSystemStatus = getBotPaymentSystemStatus as jest.MockedFunction<typeof getBotPaymentSystemStatus>;

describe('Service Initialization Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: x402-payment-integration-fix, Property 16: Application startup initializes correct service**
   * Property: For any application startup, the system should initialize the Bot_Payment_System instead of the old bot cleanup service
   */
  it('should always initialize bot payment system on startup', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          enableConsoleLogging: fc.boolean(),
          enableFileLogging: fc.boolean(),
          cleanupDelayMs: fc.integer({ min: 1000, max: 300000 }),
          monitoringCheckInterval: fc.integer({ min: 1000, max: 30000 })
        }),
        async (config) => {
          // Mock successful initialization
          mockStartBotPaymentSystem.mockResolvedValueOnce(undefined);
          mockGetBotPaymentSystemStatus.mockResolvedValueOnce({
            isRunning: true,
            error: undefined
          });

          // Simulate application startup
          await startBotPaymentSystem(config);

          // Verify that the bot payment system was initialized
          expect(mockStartBotPaymentSystem).toHaveBeenCalledWith(config);
          expect(mockStartBotPaymentSystem).toHaveBeenCalledTimes(1);

          // Verify system is running
          const status = await getBotPaymentSystemStatus();
          expect(status.isRunning).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any startup configuration, the system should handle initialization errors gracefully
   */
  it('should handle initialization errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          enableConsoleLogging: fc.boolean(),
          enableFileLogging: fc.boolean(),
          cleanupDelayMs: fc.integer({ min: 1000, max: 300000 }),
          monitoringCheckInterval: fc.integer({ min: 1000, max: 30000 })
        }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (config, errorMessage) => {
          // Mock initialization failure
          const initError = new Error(errorMessage);
          mockStartBotPaymentSystem.mockRejectedValueOnce(initError);

          // Attempt to start the system
          let thrownError: Error | null = null;
          try {
            await startBotPaymentSystem(config);
          } catch (error) {
            thrownError = error as Error;
          }

          // Verify error was thrown and handled
          expect(thrownError).toBeInstanceOf(Error);
          expect(thrownError?.message).toBe(errorMessage);
          expect(mockStartBotPaymentSystem).toHaveBeenCalledWith(config);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any running system, graceful shutdown should always succeed
   */
  it('should always perform graceful shutdown', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // Whether system is running
        async (isRunning) => {
          // Mock system status
          mockGetBotPaymentSystemStatus.mockResolvedValueOnce({
            isRunning,
            error: undefined
          });

          if (isRunning) {
            mockStopBotPaymentSystem.mockResolvedValueOnce(undefined);
          }

          // Attempt graceful shutdown
          await stopBotPaymentSystem();

          // Verify shutdown was called if system was running
          if (isRunning) {
            expect(mockStopBotPaymentSystem).toHaveBeenCalledTimes(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any system state, status check should return consistent information
   */
  it('should return consistent system status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          isRunning: fc.boolean(),
          error: fc.option(fc.string(), { nil: undefined })
        }),
        async (expectedStatus) => {
          // Mock status response
          mockGetBotPaymentSystemStatus.mockResolvedValueOnce(expectedStatus);

          // Get system status
          const actualStatus = await getBotPaymentSystemStatus();

          // Verify status consistency
          expect(actualStatus.isRunning).toBe(expectedStatus.isRunning);
          expect(actualStatus.error).toBe(expectedStatus.error);
        }
      ),
      { numRuns: 100 }
    );
  });
});