/**
 * Property-based tests for incorrect payment rejection
 * **Feature: automated-bot-payment-system, Property 16: Incorrect payment amounts are rejected with error messages**
 */

import fc from 'fast-check';
import { PaymentVerificationServiceImpl } from '../../lib/bot-payment-system/services/payment-verification';

// Mock implementation for testing incorrect payment rejection
class PaymentRejectionService {
  private readonly REQUIRED_AMOUNT = 0.01;
  private readonly REQUIRED_CURRENCY = 'MOVE';

  /**
   * Validates and processes a payment, rejecting incorrect amounts with clear error messages
   */
  processPayment(amount: number, currency: string, transactionId: string): {
    success: boolean;
    error?: string;
    errorCode?: string;
  } {
    // Validate transaction ID
    if (!transactionId || transactionId.trim().length === 0) {
      return {
        success: false,
        error: 'Transaction ID is required and cannot be empty',
        errorCode: 'INVALID_TRANSACTION_ID'
      };
    }

    // Validate currency
    if (currency !== this.REQUIRED_CURRENCY) {
      return {
        success: false,
        error: `Invalid currency. Expected '${this.REQUIRED_CURRENCY}', but received '${currency}'`,
        errorCode: 'INVALID_CURRENCY'
      };
    }

    // Validate amount
    if (amount !== this.REQUIRED_AMOUNT) {
      if (amount < 0) {
        return {
          success: false,
          error: `Payment amount cannot be negative. Received: ${amount}`,
          errorCode: 'NEGATIVE_AMOUNT'
        };
      }
      
      if (amount === 0) {
        return {
          success: false,
          error: 'Payment amount cannot be zero',
          errorCode: 'ZERO_AMOUNT'
        };
      }
      
      if (amount < this.REQUIRED_AMOUNT) {
        return {
          success: false,
          error: `Payment amount too low. Required: ${this.REQUIRED_AMOUNT} ${this.REQUIRED_CURRENCY}, received: ${amount} ${currency}`,
          errorCode: 'INSUFFICIENT_AMOUNT'
        };
      }
      
      if (amount > this.REQUIRED_AMOUNT) {
        return {
          success: false,
          error: `Payment amount too high. Required: ${this.REQUIRED_AMOUNT} ${this.REQUIRED_CURRENCY}, received: ${amount} ${currency}`,
          errorCode: 'EXCESSIVE_AMOUNT'
        };
      }
    }

    // Validate for NaN or infinite values
    if (isNaN(amount) || !isFinite(amount)) {
      return {
        success: false,
        error: `Invalid payment amount: ${amount}`,
        errorCode: 'INVALID_AMOUNT_FORMAT'
      };
    }

    // If all validations pass
    return {
      success: true
    };
  }
}

describe('Incorrect Payment Rejection Properties', () => {
  let paymentService: PaymentRejectionService;
  let verificationService: PaymentVerificationServiceImpl;

  beforeEach(() => {
    paymentService = new PaymentRejectionService();
    verificationService = new PaymentVerificationServiceImpl();
  });

  describe('Property 16: Incorrect payment amounts are rejected with error messages', () => {
    test('any amount other than 0.01 should be rejected with clear error message', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000, noNaN: true }).filter(amount => amount !== 0.01),
          fc.string({ minLength: 1, maxLength: 64 }), // transaction ID
          (incorrectAmount, transactionId) => {
            const result = paymentService.processPayment(incorrectAmount, 'MOVE', transactionId);
            
            // Payment should be rejected
            expect(result.success).toBe(false);
            
            // Should have a clear error message
            expect(result.error).toBeDefined();
            expect(result.error!.length).toBeGreaterThan(0);
            
            // Should have an error code
            expect(result.errorCode).toBeDefined();
            
            // Error message should mention the amount issue
            expect(result.error!.toLowerCase()).toMatch(/amount|payment/);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('negative amounts should be rejected with specific error message', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -1000, max: -0.001 }),
          fc.string({ minLength: 1, maxLength: 64 }),
          (negativeAmount, transactionId) => {
            const result = paymentService.processPayment(negativeAmount, 'MOVE', transactionId);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('cannot be negative');
            expect(result.errorCode).toBe('NEGATIVE_AMOUNT');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('zero amount should be rejected with specific error message', () => {
      const result = paymentService.processPayment(0, 'MOVE', 'test_tx');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be zero');
      expect(result.errorCode).toBe('ZERO_AMOUNT');
    });

    test('amounts below 0.01 should be rejected as insufficient', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0.001, max: 0.009, noNaN: true }),
          fc.string({ minLength: 1, maxLength: 64 }),
          (lowAmount, transactionId) => {
            const result = paymentService.processPayment(lowAmount, 'MOVE', transactionId);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('too low');
            expect(result.errorCode).toBe('INSUFFICIENT_AMOUNT');
            expect(result.error).toContain('0.01');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('amounts above 0.01 should be rejected as excessive', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0.011, max: 100, noNaN: true }),
          fc.string({ minLength: 1, maxLength: 64 }),
          (highAmount, transactionId) => {
            const result = paymentService.processPayment(highAmount, 'MOVE', transactionId);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('too high');
            expect(result.errorCode).toBe('EXCESSIVE_AMOUNT');
            expect(result.error).toContain('0.01');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('incorrect currency should be rejected with clear error message', () => {
      fc.assert(
        fc.property(
          fc.string().filter(currency => currency !== 'MOVE'),
          fc.string({ minLength: 1, maxLength: 64 }),
          (incorrectCurrency, transactionId) => {
            const result = paymentService.processPayment(0.01, incorrectCurrency, transactionId);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid currency');
            expect(result.error).toContain('MOVE');
            expect(result.error).toContain(incorrectCurrency);
            expect(result.errorCode).toBe('INVALID_CURRENCY');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('empty or invalid transaction IDs should be rejected', () => {
      const invalidTransactionIds = ['', '   ', '\t', '\n'];
      
      invalidTransactionIds.forEach(invalidId => {
        const result = paymentService.processPayment(0.01, 'MOVE', invalidId);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Transaction ID');
        expect(result.errorCode).toBe('INVALID_TRANSACTION_ID');
      });
    });

    test('NaN amounts should be rejected with clear error message', () => {
      const result = paymentService.processPayment(NaN, 'MOVE', 'test_tx');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid payment amount');
      expect(result.errorCode).toBe('INVALID_AMOUNT_FORMAT');
    });

    test('infinite amounts should be rejected with clear error message', () => {
      const positiveInfinityResult = paymentService.processPayment(Infinity, 'MOVE', 'test_tx');
      const negativeInfinityResult = paymentService.processPayment(-Infinity, 'MOVE', 'test_tx');
      
      expect(positiveInfinityResult.success).toBe(false);
      expect(positiveInfinityResult.error).toContain('Invalid payment amount');
      expect(positiveInfinityResult.errorCode).toBe('INVALID_AMOUNT_FORMAT');
      
      expect(negativeInfinityResult.success).toBe(false);
      expect(negativeInfinityResult.error).toContain('Invalid payment amount');
      expect(negativeInfinityResult.errorCode).toBe('INVALID_AMOUNT_FORMAT');
    });

    test('exactly 0.01 MOVE should be accepted', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 64 }),
          (transactionId) => {
            const result = paymentService.processPayment(0.01, 'MOVE', transactionId);
            
            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.errorCode).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('verification service amount validation matches payment service', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -1000, max: 1000, noNaN: true }),
          (amount) => {
            const verificationResult = verificationService.validateAmount(amount);
            const paymentResult = paymentService.processPayment(amount, 'MOVE', 'test_tx');
            
            // Both services should agree on what constitutes a valid amount
            if (amount === 0.01) {
              expect(verificationResult).toBe(true);
              expect(paymentResult.success).toBe(true);
            } else {
              expect(verificationResult).toBe(false);
              expect(paymentResult.success).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});