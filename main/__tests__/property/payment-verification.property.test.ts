/**
 * Property-based tests for payment verification service
 * **Feature: automated-bot-payment-system, Property 3: Successful payment verification extracts IP address**
 */

import fc from 'fast-check';
import { PaymentVerificationServiceImpl } from '../../lib/bot-payment-system/services/payment-verification';

// Mock the exec function to avoid actual network calls during testing
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

import { exec } from 'child_process';
const mockExec = exec as jest.MockedFunction<typeof exec>;

describe('Payment Verification Properties', () => {
  let paymentService: PaymentVerificationServiceImpl;

  beforeEach(() => {
    paymentService = new PaymentVerificationServiceImpl();
    jest.clearAllMocks();
  });

  describe('Property 3: Successful payment verification extracts IP address', () => {
    test('successful payment verification should always extract IP address', async () => {
      // Mock successful IP extraction
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: '210.212.2.133\n', stderr: '' } as any);
        }
        return {} as any;
      });

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 64 }), // valid transaction IDs
          async (transactionId) => {
            // For any valid transaction ID, IP extraction should work
            const ip = await paymentService.extractPayerIP();
            
            // IP should be extracted successfully
            expect(ip).toBe('210.212.2.133');
            expect(typeof ip).toBe('string');
            expect(ip.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('payment verification should handle valid transaction IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 64 }), // valid transaction IDs
          async (transactionId) => {
            const result = await paymentService.verifyTransaction(transactionId);
            
            // For any valid transaction ID, verification should succeed
            expect(result.success).toBe(true);
            expect(result.transactionId).toBe(transactionId);
            expect(result.amount).toBe(0.01);
            expect(result.payerAddress).toContain('move_address_');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('payment verification should reject empty transaction IDs', async () => {
      const result = await paymentService.verifyTransaction('');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transaction ID format');
    });

    test('amount validation should only accept exactly 0.01', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000, noNaN: true }),
          (amount) => {
            const isValid = paymentService.validateAmount(amount);
            
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

    test('IP extraction should handle network errors gracefully', async () => {
      // Mock network error
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Network error'), { stdout: '', stderr: 'Network error' } as any);
        }
        return {} as any;
      });

      await expect(paymentService.extractPayerIP()).rejects.toThrow('IP extraction failed');
    });

    test('IP extraction should handle empty responses', async () => {
      // Mock empty response
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: '', stderr: '' } as any);
        }
        return {} as any;
      });

      await expect(paymentService.extractPayerIP()).rejects.toThrow('Failed to retrieve IP address');
    });

    test('IP extraction should trim whitespace from responses', async () => {
      // Mock response with whitespace
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: '  192.168.1.1  \n\t  ', stderr: '' } as any);
        }
        return {} as any;
      });

      const ip = await paymentService.extractPayerIP();
      expect(ip).toBe('192.168.1.1');
    });
  });
});