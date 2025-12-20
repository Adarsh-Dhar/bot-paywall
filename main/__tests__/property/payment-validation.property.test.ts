/**
 * Property-based tests for payment validation
 * **Feature: automated-bot-payment-system, Property 2: Valid payment transactions pass verification**
 */

import fc from 'fast-check';
import { validatePaymentAmount, validatePaymentRecord, validateTransactionId } from '../../lib/bot-payment-system/validation';
import { PaymentRecord } from '../../lib/bot-payment-system/types';

describe('Payment Validation Properties', () => {
  describe('Property 2: Valid payment transactions pass verification', () => {
    test('valid 0.01 MOVE payments should always pass validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 64 }), // transactionId
          fc.string({ minLength: 1, maxLength: 42 }), // payerAddress
          fc.date(), // timestamp
          (transactionId, payerAddress, timestamp) => {
            const paymentRecord: PaymentRecord = {
              transactionId,
              amount: 0.01, // Exactly 0.01 MOVE
              currency: 'MOVE',
              timestamp,
              payerAddress,
              verified: true
            };

            // For any valid payment record with exactly 0.01 MOVE, validation should pass
            const isValid = validatePaymentRecord(paymentRecord);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('payment amount validation should only accept exactly 0.01', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000, noNaN: true }), // random amounts
          (amount) => {
            const isValid = validatePaymentAmount(amount);
            
            // Only exactly 0.01 should be valid
            if (amount === 0.01) {
              expect(isValid).toBe(true);
            } else {
              expect(isValid).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('transaction ID validation should accept non-empty strings', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // non-empty strings
          (transactionId) => {
            const isValid = validateTransactionId(transactionId);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('transaction ID validation should reject empty strings', () => {
      const isValid = validateTransactionId('');
      expect(isValid).toBe(false);
    });

    test('payment records with incorrect amounts should fail validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // transactionId
          fc.string({ minLength: 1 }), // payerAddress
          fc.date(), // timestamp
          fc.float({ min: 0, max: 1000, noNaN: true }).filter(amount => amount !== 0.01), // incorrect amounts
          (transactionId, payerAddress, timestamp, incorrectAmount) => {
            const paymentRecord: PaymentRecord = {
              transactionId,
              amount: incorrectAmount,
              currency: 'MOVE',
              timestamp,
              payerAddress,
              verified: true
            };

            // Payment records with incorrect amounts should fail validation
            const isValid = validatePaymentRecord(paymentRecord);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('payment records with incorrect currency should fail validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // transactionId
          fc.string({ minLength: 1 }), // payerAddress
          fc.date(), // timestamp
          fc.string().filter(currency => currency !== 'MOVE'), // incorrect currency
          (transactionId, payerAddress, timestamp, incorrectCurrency) => {
            const paymentRecord = {
              transactionId,
              amount: 0.01,
              currency: incorrectCurrency as any,
              timestamp,
              payerAddress,
              verified: true
            };

            // Payment records with incorrect currency should fail validation
            const isValid = validatePaymentRecord(paymentRecord);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});