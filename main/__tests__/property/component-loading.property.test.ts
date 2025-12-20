/**
 * **Feature: x402-payment-integration-fix, Property 17: Component loading starts payment system**
 * Property-based tests for ServiceInitializer component loading
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, cleanup } from '@testing-library/react';
import fc from 'fast-check';
import ServiceInitializer from '@/components/ServiceInitializer';

// Mock the automated bot payment system
jest.mock('@/lib/automated-bot-payment-system', () => ({
  startBotPaymentSystem: jest.fn(),
  stopBotPaymentSystem: jest.fn(),
  getBotPaymentSystemStatus: jest.fn(),
}));

// Mock console methods to avoid noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('Component Loading Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  /**
   * **Feature: x402-payment-integration-fix, Property 17: Component loading starts payment system**
   * Property: For any ServiceInitializer component load, the system should start the automated bot payment system services
   */
  it('should always start payment system when component loads', async () => {
    const { startBotPaymentSystem } = await import('@/lib/automated-bot-payment-system');
    const mockStartBotPaymentSystem = startBotPaymentSystem as jest.MockedFunction<typeof startBotPaymentSystem>;

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          enableConsoleLogging: fc.boolean(),
          enableFileLogging: fc.boolean(),
          cleanupDelayMs: fc.integer({ min: 1000, max: 300000 }),
          monitoringCheckInterval: fc.integer({ min: 1000, max: 30000 })
        }),
        async (expectedConfig) => {
          // Mock successful initialization
          mockStartBotPaymentSystem.mockResolvedValueOnce(undefined);

          // Render the ServiceInitializer component
          const { unmount } = render(<ServiceInitializer />);

          // Wait for useEffect to complete
          await new Promise(resolve => setTimeout(resolve, 10));

          // Verify that startBotPaymentSystem was called
          expect(mockStartBotPaymentSystem).toHaveBeenCalledTimes(1);
          
          // Verify it was called with the expected configuration structure
          const actualCall = mockStartBotPaymentSystem.mock.calls[0][0];
          expect(actualCall).toHaveProperty('enableConsoleLogging');
          expect(actualCall).toHaveProperty('enableFileLogging');
          expect(actualCall).toHaveProperty('cleanupDelayMs');
          expect(actualCall).toHaveProperty('monitoringCheckInterval');

          // Verify configuration values are reasonable
          expect(typeof actualCall.enableConsoleLogging).toBe('boolean');
          expect(typeof actualCall.enableFileLogging).toBe('boolean');
          expect(typeof actualCall.cleanupDelayMs).toBe('number');
          expect(typeof actualCall.monitoringCheckInterval).toBe('number');
          expect(actualCall.cleanupDelayMs).toBeGreaterThan(0);
          expect(actualCall.monitoringCheckInterval).toBeGreaterThan(0);

          // Clean up
          unmount();
        }
      ),
      { numRuns: 50 } // Reduced runs for component tests
    );
  });

  /**
   * Property: For any component unmount, the system should attempt graceful shutdown
   */
  it('should attempt graceful shutdown on component unmount', async () => {
    const { startBotPaymentSystem, stopBotPaymentSystem } = await import('@/lib/automated-bot-payment-system');
    const mockStartBotPaymentSystem = startBotPaymentSystem as jest.MockedFunction<typeof startBotPaymentSystem>;
    const mockStopBotPaymentSystem = stopBotPaymentSystem as jest.MockedFunction<typeof stopBotPaymentSystem>;

    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // Whether initialization succeeds
        async (initSuccess) => {
          if (initSuccess) {
            mockStartBotPaymentSystem.mockResolvedValueOnce(undefined);
          } else {
            mockStartBotPaymentSystem.mockRejectedValueOnce(new Error('Init failed'));
          }
          
          mockStopBotPaymentSystem.mockResolvedValueOnce(undefined);

          // Render and immediately unmount the component
          const { unmount } = render(<ServiceInitializer />);
          
          // Wait for useEffect to complete
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Unmount the component
          unmount();
          
          // Wait for cleanup to complete
          await new Promise(resolve => setTimeout(resolve, 10));

          // Verify that stopBotPaymentSystem was called during cleanup
          expect(mockStopBotPaymentSystem).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For any initialization error, the component should handle it gracefully
   */
  it('should handle initialization errors gracefully', async () => {
    const { startBotPaymentSystem } = await import('@/lib/automated-bot-payment-system');
    const mockStartBotPaymentSystem = startBotPaymentSystem as jest.MockedFunction<typeof startBotPaymentSystem>;

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (errorMessage) => {
          // Mock initialization failure
          mockStartBotPaymentSystem.mockRejectedValueOnce(new Error(errorMessage));

          // Render the component
          const { unmount } = render(<ServiceInitializer />);

          // Wait for useEffect to complete
          await new Promise(resolve => setTimeout(resolve, 10));

          // Verify that the component doesn't crash and initialization was attempted
          expect(mockStartBotPaymentSystem).toHaveBeenCalledTimes(1);

          // Component should still render (return null) even with errors
          expect(() => unmount()).not.toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Component should always render null regardless of initialization state
   */
  it('should always render null regardless of initialization state', async () => {
    const { startBotPaymentSystem } = await import('@/lib/automated-bot-payment-system');
    const mockStartBotPaymentSystem = startBotPaymentSystem as jest.MockedFunction<typeof startBotPaymentSystem>;

    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // Whether initialization succeeds
        async (shouldSucceed) => {
          if (shouldSucceed) {
            mockStartBotPaymentSystem.mockResolvedValueOnce(undefined);
          } else {
            mockStartBotPaymentSystem.mockRejectedValueOnce(new Error('Test error'));
          }

          // Render the component
          const { container, unmount } = render(<ServiceInitializer />);

          // Wait for useEffect to complete
          await new Promise(resolve => setTimeout(resolve, 10));

          // Verify component renders nothing (null)
          expect(container.firstChild).toBeNull();

          // Clean up
          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });
});