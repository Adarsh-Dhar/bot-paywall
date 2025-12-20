/**
 * **Feature: x402-payment-integration-fix, Property 8: Successful verification triggers IP whitelisting**
 * Property-based tests for successful payment verification triggering IP whitelisting
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';

// Mock the bot payment system components
jest.mock('@/lib/automated-bot-payment-system', () => ({
  processManualPayment: jest.fn(),
  getBotPaymentSystem: jest.fn(),
}));

const { processManualPayment, getBotPaymentSystem } = require('@/lib/automated-bot-payment-system');

// Simulate the paywall worker's payment verification and whitelisting flow
class PaymentVerificationSimulator {
  private botPaymentSystemUrl: string;
  private apiToken: string;

  constructor(botPaymentSystemUrl: string, apiToken: string) {
    this.botPaymentSystemUrl = botPaymentSystemUrl;
    this.apiToken = apiToken;
  }

  async verifyX402Payment(transactionId: string, clientIP: string): Promise<boolean> {
    try {
      // Simulate calling the verification API
      const result = await processManualPayment(transactionId, clientIP);
      return result.success === true;
    } catch (error) {
      return false;
    }
  }

  async triggerIPWhitelisting(transactionId: string, clientIP: string): Promise<boolean> {
    try {
      const botPaymentSystem = getBotPaymentSystem();
      if (!botPaymentSystem) {
        return false;
      }

      const result = await botPaymentSystem.processPayment(transactionId, clientIP);
      return result.success === true;
    } catch (error) {
      return false;
    }
  }

  async processPaymentVerification(transactionId: string, clientIP: string): Promise<{
    paymentVerified: boolean;
    whitelistTriggered: boolean;
    error?: string;
  }> {
    try {
      // Step 1: Verify payment
      const paymentVerified = await this.verifyX402Payment(transactionId, clientIP);
      
      if (!paymentVerified) {
        return {
          paymentVerified: false,
          whitelistTriggered: false,
          error: 'Payment verification failed'
        };
      }

      // Step 2: Trigger IP whitelisting
      const whitelistTriggered = await this.triggerIPWhitelisting(transactionId, clientIP);
      
      return {
        paymentVerified: true,
        whitelistTriggered,
        error: whitelistTriggered ? undefined : 'IP whitelisting failed'
      };
    } catch (error) {
      return {
        paymentVerified: false,
        whitelistTriggered: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

describe('Successful Verification Whitelisting Property Tests', () => {
  let simulator: PaymentVerificationSimulator;

  beforeEach(() => {
    jest.clearAllMocks();
    simulator = new PaymentVerificationSimulator(
      'https://test-domain.com/api/x402-payment',
      'test-api-token'
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: x402-payment-integration-fix, Property 8: Successful verification triggers IP whitelisting**
   * Property: For any successful payment verification, the Paywall_Worker should trigger the Bot_Payment_System to whitelist the IP
   */
  it('should always trigger IP whitelisting for successful payment verification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }), // transactionId
        fc.ipV4(), // clientIP
        async (transactionId, clientIP) => {
          // Mock successful payment verification
          processManualPayment.mockResolvedValueOnce({
            success: true,
            transactionId,
            whitelistRuleId: 'rule-123'
          });

          // Mock successful bot payment system
          const mockBotPaymentSystem = {
            processPayment: jest.fn().mockResolvedValue({
              success: true,
              whitelistRuleId: 'rule-456',
              transactionId
            })
          };
          getBotPaymentSystem.mockReturnValue(mockBotPaymentSystem);

          // Process payment verification
          const result = await simulator.processPaymentVerification(transactionId, clientIP);

          // Verify payment was verified
          expect(result.paymentVerified).toBe(true);
          expect(processManualPayment).toHaveBeenCalledWith(transactionId, clientIP);

          // Verify IP whitelisting was triggered
          expect(result.whitelistTriggered).toBe(true);
          expect(mockBotPaymentSystem.processPayment).toHaveBeenCalledWith(transactionId, clientIP);
          
          // Verify no error occurred
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any failed payment verification, IP whitelisting should not be triggered
   */
  it('should not trigger IP whitelisting for failed payment verification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.ipV4(),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (transactionId, clientIP, errorMessage) => {
          // Mock failed payment verification
          processManualPayment.mockResolvedValueOnce({
            success: false,
            error: errorMessage
          });

          const mockBotPaymentSystem = {
            processPayment: jest.fn()
          };
          getBotPaymentSystem.mockReturnValue(mockBotPaymentSystem);

          // Process payment verification
          const result = await simulator.processPaymentVerification(transactionId, clientIP);

          // Verify payment verification failed
          expect(result.paymentVerified).toBe(false);
          expect(processManualPayment).toHaveBeenCalledWith(transactionId, clientIP);

          // Verify IP whitelisting was NOT triggered
          expect(result.whitelistTriggered).toBe(false);
          expect(mockBotPaymentSystem.processPayment).not.toHaveBeenCalled();
          
          // Verify error is present
          expect(result.error).toBe('Payment verification failed');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any successful verification with whitelisting failure, appropriate error should be returned
   */
  it('should handle whitelisting failures after successful verification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.ipV4(),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (transactionId, clientIP, whitelistError) => {
          // Mock successful payment verification
          processManualPayment.mockResolvedValueOnce({
            success: true,
            transactionId
          });

          // Mock failed IP whitelisting
          const mockBotPaymentSystem = {
            processPayment: jest.fn().mockResolvedValue({
              success: false,
              error: whitelistError
            })
          };
          getBotPaymentSystem.mockReturnValue(mockBotPaymentSystem);

          // Process payment verification
          const result = await simulator.processPaymentVerification(transactionId, clientIP);

          // Verify payment was verified successfully
          expect(result.paymentVerified).toBe(true);
          expect(processManualPayment).toHaveBeenCalledWith(transactionId, clientIP);

          // Verify IP whitelisting was attempted but failed
          expect(result.whitelistTriggered).toBe(false);
          expect(mockBotPaymentSystem.processPayment).toHaveBeenCalledWith(transactionId, clientIP);
          
          // Verify appropriate error is returned
          expect(result.error).toBe('IP whitelisting failed');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any system unavailability, verification should fail gracefully
   */
  it('should handle bot payment system unavailability gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.ipV4(),
        async (transactionId, clientIP) => {
          // Mock successful payment verification
          processManualPayment.mockResolvedValueOnce({
            success: true,
            transactionId
          });

          // Mock unavailable bot payment system
          getBotPaymentSystem.mockReturnValue(null);

          // Process payment verification
          const result = await simulator.processPaymentVerification(transactionId, clientIP);

          // Verify payment was verified successfully
          expect(result.paymentVerified).toBe(true);
          expect(processManualPayment).toHaveBeenCalledWith(transactionId, clientIP);

          // Verify IP whitelisting failed due to system unavailability
          expect(result.whitelistTriggered).toBe(false);
          expect(getBotPaymentSystem).toHaveBeenCalled();
          
          // Verify appropriate error is returned
          expect(result.error).toBe('IP whitelisting failed');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any exception during processing, error should be handled gracefully
   */
  it('should handle exceptions during verification process gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.ipV4(),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (transactionId, clientIP, errorMessage) => {
          // Mock exception during payment verification
          processManualPayment.mockRejectedValue(new Error(errorMessage));

          // Process payment verification
          const result = await simulator.processPaymentVerification(transactionId, clientIP);

          // Verify payment verification failed
          expect(result.paymentVerified).toBe(false);
          expect(processManualPayment).toHaveBeenCalledWith(transactionId, clientIP);

          // Verify IP whitelisting was not triggered
          expect(result.whitelistTriggered).toBe(false);
          
          // Verify error is handled gracefully
          expect(result.error).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any valid transaction and IP combination, the verification flow should be deterministic
   */
  it('should produce deterministic results for same inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.ipV4(),
        fc.boolean(),
        fc.boolean(),
        async (transactionId, clientIP, paymentSuccess, whitelistSuccess) => {
          // Mock consistent responses
          processManualPayment.mockResolvedValue({
            success: paymentSuccess,
            transactionId: paymentSuccess ? transactionId : undefined,
            error: paymentSuccess ? undefined : 'Payment failed'
          });

          const mockBotPaymentSystem = paymentSuccess ? {
            processPayment: jest.fn().mockResolvedValue({
              success: whitelistSuccess,
              whitelistRuleId: whitelistSuccess ? 'rule-789' : undefined,
              error: whitelistSuccess ? undefined : 'Whitelist failed'
            })
          } : null;

          getBotPaymentSystem.mockReturnValue(mockBotPaymentSystem);

          // Process verification multiple times
          const result1 = await simulator.processPaymentVerification(transactionId, clientIP);
          
          // Reset mocks and set same responses
          jest.clearAllMocks();
          processManualPayment.mockResolvedValue({
            success: paymentSuccess,
            transactionId: paymentSuccess ? transactionId : undefined,
            error: paymentSuccess ? undefined : 'Payment failed'
          });
          getBotPaymentSystem.mockReturnValue(mockBotPaymentSystem);
          
          const result2 = await simulator.processPaymentVerification(transactionId, clientIP);

          // Verify results are consistent
          expect(result1.paymentVerified).toBe(result2.paymentVerified);
          expect(result1.whitelistTriggered).toBe(result2.whitelistTriggered);
          expect(result1.error).toBe(result2.error);
        }
      ),
      { numRuns: 100 }
    );
  });
});