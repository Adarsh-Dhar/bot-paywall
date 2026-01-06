/**
 * **Feature: x402-payment-integration-fix, Property 21: IP determination uses configured address**
 * Property-based tests for IP configuration management
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';
import { PaymentVerificationServiceImpl } from '@/lib/bot-payment-system/services/payment-verification';

// Mock child_process exec for IP detection
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

const { exec } = require('child_process');

describe('IP Configuration Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: x402-payment-integration-fix, Property 21: IP determination uses configured address**
   * Property: For any client IP determination, the system should use the configured IP if provided
   */
  it('should always use configured IP when provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.ipV4(),
        async (configuredIP) => {
          const paymentService = new PaymentVerificationServiceImpl(configuredIP);

          const extractedIP = await paymentService.extractPayerIP();

          expect(extractedIP).toBe(configuredIP);
          expect(exec).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any valid IP address configuration, the system should use it consistently
   */
  it('should consistently use any valid configured IP address', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.ipV4(),
        async (configuredIP) => {
          // Create payment verification service with configured IP
          const paymentService = new PaymentVerificationServiceImpl(configuredIP);

          // Extract IP address multiple times
          const ip1 = await paymentService.extractPayerIP();
          const ip2 = await paymentService.extractPayerIP();
          const ip3 = await paymentService.extractPayerIP();

          // Verify consistency
          expect(ip1).toBe(configuredIP);
          expect(ip2).toBe(configuredIP);
          expect(ip3).toBe(configuredIP);
          expect(ip1).toBe(ip2);
          expect(ip2).toBe(ip3);

          // Verify that curl was NOT called
          expect(exec).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any system without configured IP, fallback to curl should work
   */
  it('should fallback to curl when no IP is configured', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.ipV4(),
        async (dynamicIP) => {
          // Mock curl response
          exec.mockImplementation((command: string, callback: Function) => {
            if (command === 'curl -s icanhazip.com') {
              callback(null, { stdout: dynamicIP });
            } else {
              callback(new Error('Unknown command'));
            }
          });

          // Create payment verification service without configured IP
          const paymentService = new PaymentVerificationServiceImpl();

          // Extract IP address
          const extractedIP = await paymentService.extractPayerIP();

          // Verify that the dynamic IP from curl is used
          expect(extractedIP).toBe(dynamicIP);

          // Verify that curl was called
          expect(exec).toHaveBeenCalledWith('curl -s icanhazip.com', expect.any(Function));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any configured IP, it should take precedence over curl
   */
  it('should prioritize configured IP over curl response', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.ipV4(),
        fc.ipV4(),
        async (configuredIP, curlIP) => {
          // Ensure IPs are different for this test
          if (configuredIP === curlIP) {
            return;
          }

          // Mock curl response (should not be used)
          exec.mockImplementation((command: string, callback: Function) => {
            if (command === 'curl -s icanhazip.com') {
              callback(null, { stdout: curlIP });
            } else {
              callback(new Error('Unknown command'));
            }
          });

          // Create payment verification service with configured IP
          const paymentService = new PaymentVerificationServiceImpl(configuredIP);

          // Extract IP address
          const extractedIP = await paymentService.extractPayerIP();

          // Verify that configured IP takes precedence
          expect(extractedIP).toBe(configuredIP);
          expect(extractedIP).not.toBe(curlIP);

          // Verify that curl was NOT called
          expect(exec).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any curl failure, appropriate error should be thrown when no IP is configured
   */
  it('should handle curl failures gracefully when no IP is configured', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (errorMessage) => {
          // Mock curl failure
          exec.mockImplementation((command: string, callback: Function) => {
            callback(new Error(errorMessage));
          });

          // Create payment verification service without configured IP
          const paymentService = new PaymentVerificationServiceImpl();

          // Attempt to extract IP address
          let thrownError: Error | null = null;
          try {
            await paymentService.extractPayerIP();
          } catch (error) {
            thrownError = error as Error;
          }

          // Verify that an error was thrown
          expect(thrownError).toBeInstanceOf(Error);
          expect(thrownError?.message).toContain('IP extraction failed');

          // Verify that curl was called
          expect(exec).toHaveBeenCalledWith('curl -s icanhazip.com', expect.any(Function));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any empty curl response, appropriate error should be thrown
   */
  it('should handle empty curl responses gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant('\n'),
          fc.constant('\t')
        ),
        async (emptyResponse) => {
          // Mock empty curl response
          exec.mockImplementation((command: string, callback: Function) => {
            callback(null, { stdout: emptyResponse });
          });

          // Create payment verification service without configured IP
          const paymentService = new PaymentVerificationServiceImpl();

          // Attempt to extract IP address
          let thrownError: Error | null = null;
          try {
            await paymentService.extractPayerIP();
          } catch (error) {
            thrownError = error as Error;
          }

          // Verify that an error was thrown
          expect(thrownError).toBeInstanceOf(Error);
          expect(thrownError?.message).toContain('Failed to retrieve IP address');

          // Verify that curl was called
          expect(exec).toHaveBeenCalledWith('curl -s icanhazip.com', expect.any(Function));
        }
      ),
      { numRuns: 100 }
    );
  });

  // Removed hardcoded-specific IP property; generic configured IP coverage above
});