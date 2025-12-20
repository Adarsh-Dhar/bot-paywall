/**
 * **Feature: x402-payment-integration-fix, Property 7: X402 payments undergo verification**
 * Property-based tests for X402 payment verification
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';
import { NextRequest } from 'next/server';
import { POST as verifyPayment } from '@/app/api/x402-payment/verify/route';
import { POST as whitelistIP } from '@/app/api/x402-payment/whitelist/route';

// Mock the automated bot payment system
jest.mock('@/lib/automated-bot-payment-system', () => ({
  processManualPayment: jest.fn(),
  getBotPaymentSystem: jest.fn(),
}));

const { processManualPayment, getBotPaymentSystem } = require('@/lib/automated-bot-payment-system');

describe('X402 Payment Verification Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: x402-payment-integration-fix, Property 7: X402 payments undergo verification**
   * Property: For any received X402 payment, the Paywall_Worker should verify the transaction amount and authenticity
   */
  it('should verify all received X402 payments', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }), // transactionId
        fc.ipV4(), // clientIP
        fc.constant(0.01), // expectedAmount
        fc.constant('MOVE'), // expectedCurrency
        fc.boolean(), // verification success
        async (transactionId, clientIP, expectedAmount, expectedCurrency, shouldSucceed) => {
          // Mock the payment processing result
          processManualPayment.mockResolvedValueOnce({
            success: shouldSucceed,
            error: shouldSucceed ? undefined : 'Payment verification failed',
            transactionId,
            whitelistRuleId: shouldSucceed ? 'rule-123' : undefined
          });

          // Create a mock request
          const requestBody = {
            transactionId,
            clientIP,
            expectedAmount,
            expectedCurrency
          };

          const request = new NextRequest('http://localhost/api/x402-payment/verify', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
              'Content-Type': 'application/json'
            }
          });

          // Call the verification endpoint
          const response = await verifyPayment(request);
          const responseData = await response.json();

          // Verify that payment processing was called
          expect(processManualPayment).toHaveBeenCalledWith(transactionId, clientIP);
          expect(processManualPayment).toHaveBeenCalledTimes(1);

          // Verify response based on expected outcome
          if (shouldSucceed) {
            expect(response.status).toBe(200);
            expect(responseData.verified).toBe(true);
            expect(responseData.transactionId).toBe(transactionId);
            expect(responseData.clientIP).toBe(clientIP);
            expect(responseData.amount).toBe(expectedAmount);
            expect(responseData.currency).toBe(expectedCurrency);
          } else {
            expect(response.status).toBe(403);
            expect(responseData.verified).toBe(false);
            expect(responseData.error).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any invalid payment parameters, verification should fail
   */
  it('should reject payments with invalid parameters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.ipV4(),
        fc.oneof(
          fc.float({ min: 0.001, max: 0.009 }), // Too small
          fc.float({ min: 0.011, max: 1.0 }), // Too large
          fc.float({ min: -1.0, max: -0.001 }) // Negative
        ),
        fc.oneof(
          fc.constant('BTC'),
          fc.constant('ETH'),
          fc.constant('USD'),
          fc.constant(''),
          fc.string({ minLength: 1, maxLength: 10 }).filter(s => s !== 'MOVE')
        ),
        async (transactionId, clientIP, invalidAmount, invalidCurrency) => {
          const requestBody = {
            transactionId,
            clientIP,
            expectedAmount: invalidAmount,
            expectedCurrency: invalidCurrency
          };

          const request = new NextRequest('http://localhost/api/x402-payment/verify', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
              'Content-Type': 'application/json'
            }
          });

          const response = await verifyPayment(request);
          const responseData = await response.json();

          // Should reject invalid parameters
          expect(response.status).toBe(400);
          expect(responseData.verified).toBe(false);
          expect(responseData.error).toContain('Invalid payment parameters');
          
          // Should not call payment processing for invalid parameters
          expect(processManualPayment).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any missing required fields, verification should fail
   */
  it('should reject requests with missing required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        fc.option(fc.ipV4(), { nil: undefined }),
        async (transactionId, clientIP) => {
          // Skip test if both fields are present (valid case)
          if (transactionId && clientIP) {
            return;
          }

          const requestBody = {
            transactionId,
            clientIP,
            expectedAmount: 0.01,
            expectedCurrency: 'MOVE'
          };

          const request = new NextRequest('http://localhost/api/x402-payment/verify', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
              'Content-Type': 'application/json'
            }
          });

          const response = await verifyPayment(request);
          const responseData = await response.json();

          // Should reject missing required fields
          expect(response.status).toBe(400);
          expect(responseData.verified).toBe(false);
          expect(responseData.error).toContain('Missing required fields');
          
          // Should not call payment processing for missing fields
          expect(processManualPayment).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any successful verification, IP whitelisting should be triggered
   */
  it('should trigger IP whitelisting for successful verifications', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.ipV4(),
        fc.integer({ min: 30, max: 300 }),
        async (transactionId, clientIP, duration) => {
          // Mock successful bot payment system
          const mockBotPaymentSystem = {
            processPayment: jest.fn().mockResolvedValue({
              success: true,
              whitelistRuleId: 'rule-456',
              transactionId
            })
          };

          getBotPaymentSystem.mockReturnValue(mockBotPaymentSystem);

          const requestBody = {
            transactionId,
            clientIP,
            duration
          };

          const request = new NextRequest('http://localhost/api/x402-payment/whitelist', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
              'Content-Type': 'application/json'
            }
          });

          const response = await whitelistIP(request);
          const responseData = await response.json();

          // Verify whitelisting was triggered
          expect(mockBotPaymentSystem.processPayment).toHaveBeenCalledWith(transactionId, clientIP);
          expect(mockBotPaymentSystem.processPayment).toHaveBeenCalledTimes(1);

          // Verify successful response
          expect(response.status).toBe(200);
          expect(responseData.success).toBe(true);
          expect(responseData.transactionId).toBe(transactionId);
          expect(responseData.clientIP).toBe(clientIP);
          expect(responseData.duration).toBe(duration);
          expect(responseData.whitelistRuleId).toBe('rule-456');
          expect(responseData.expiresAt).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any system error, appropriate error response should be returned
   */
  it('should handle system errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.ipV4(),
        fc.string({ minLength: 1, maxLength: 200 }),
        async (transactionId, clientIP, errorMessage) => {
          // Mock system error
          processManualPayment.mockRejectedValue(new Error(errorMessage));

          const requestBody = {
            transactionId,
            clientIP,
            expectedAmount: 0.01,
            expectedCurrency: 'MOVE'
          };

          const request = new NextRequest('http://localhost/api/x402-payment/verify', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
              'Content-Type': 'application/json'
            }
          });

          const response = await verifyPayment(request);
          const responseData = await response.json();

          // Should handle error gracefully
          expect(response.status).toBe(500);
          expect(responseData.verified).toBe(false);
          expect(responseData.error).toContain('Internal server error');
          
          // Should still attempt payment processing
          expect(processManualPayment).toHaveBeenCalledWith(transactionId, clientIP);
        }
      ),
      { numRuns: 100 }
    );
  });
});