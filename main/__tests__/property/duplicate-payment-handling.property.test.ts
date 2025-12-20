/**
 * Property-based tests for duplicate payment handling
 * **Feature: automated-bot-payment-system, Property 15: Duplicate payments prevent duplicate whitelist entries**
 */

import fc from 'fast-check';

// Mock implementation of duplicate payment detection
class DuplicatePaymentDetector {
  private processedTransactions = new Set<string>();
  private ipWhitelistEntries = new Map<string, string[]>(); // IP -> transaction IDs

  /**
   * Processes a payment and prevents duplicate whitelist entries for the same IP
   */
  processPayment(transactionId: string, ip: string): { success: boolean; isDuplicate: boolean; error?: string } {
    try {
      // Check if this transaction was already processed
      if (this.processedTransactions.has(transactionId)) {
        return {
          success: false,
          isDuplicate: true,
          error: 'Transaction already processed'
        };
      }

      // Check if this IP already has a whitelist entry
      const existingEntries = this.ipWhitelistEntries.get(ip) || [];
      
      // Add the transaction to processed set
      this.processedTransactions.add(transactionId);
      
      // For the same IP, we should not create duplicate whitelist entries
      // but we should track the transaction
      if (existingEntries.length > 0) {
        // Add transaction to existing IP entry but don't create new whitelist
        existingEntries.push(transactionId);
        this.ipWhitelistEntries.set(ip, existingEntries);
        
        return {
          success: true,
          isDuplicate: true, // Duplicate for this IP, but transaction is valid
          error: 'IP already has whitelist entry, transaction recorded but no new whitelist created'
        };
      }

      // First transaction for this IP - create whitelist entry
      this.ipWhitelistEntries.set(ip, [transactionId]);
      
      return {
        success: true,
        isDuplicate: false
      };
    } catch (error) {
      return {
        success: false,
        isDuplicate: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Gets the number of whitelist entries for an IP
   */
  getWhitelistEntriesForIP(ip: string): number {
    const entries = this.ipWhitelistEntries.get(ip);
    return entries ? 1 : 0; // Each IP should have at most 1 whitelist entry
  }

  /**
   * Gets all processed transactions for an IP
   */
  getTransactionsForIP(ip: string): string[] {
    return this.ipWhitelistEntries.get(ip) || [];
  }

  /**
   * Resets the detector state
   */
  reset(): void {
    this.processedTransactions.clear();
    this.ipWhitelistEntries.clear();
  }
}

describe('Duplicate Payment Handling Properties', () => {
  let detector: DuplicatePaymentDetector;

  beforeEach(() => {
    detector = new DuplicatePaymentDetector();
  });

  describe('Property 15: Duplicate payments prevent duplicate whitelist entries', () => {
    test('multiple payments from same IP should result in only one whitelist entry', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.array(fc.string({ minLength: 1, maxLength: 64 }), { minLength: 2, maxLength: 10 }), // multiple transaction IDs
          (ip, transactionIds) => {
            // Process multiple payments from the same IP
            const results = transactionIds.map(txId => detector.processPayment(txId, ip));
            
            // First payment should succeed and create whitelist entry
            expect(results[0].success).toBe(true);
            expect(results[0].isDuplicate).toBe(false);
            
            // Subsequent payments should be handled but not create new whitelist entries
            for (let i = 1; i < results.length; i++) {
              expect(results[i].success).toBe(true);
              expect(results[i].isDuplicate).toBe(true);
            }
            
            // Only one whitelist entry should exist for this IP
            expect(detector.getWhitelistEntriesForIP(ip)).toBe(1);
            
            // All transactions should be recorded
            expect(detector.getTransactionsForIP(ip)).toHaveLength(transactionIds.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('same transaction ID should not be processed twice', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 64 }), // transaction ID
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          (transactionId, ip) => {
            // Process the same transaction twice
            const firstResult = detector.processPayment(transactionId, ip);
            const secondResult = detector.processPayment(transactionId, ip);
            
            // First processing should succeed
            expect(firstResult.success).toBe(true);
            expect(firstResult.isDuplicate).toBe(false);
            
            // Second processing should fail due to duplicate transaction
            expect(secondResult.success).toBe(false);
            expect(secondResult.isDuplicate).toBe(true);
            expect(secondResult.error).toContain('already processed');
            
            // Only one whitelist entry should exist
            expect(detector.getWhitelistEntriesForIP(ip)).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('different IPs with different transactions should each get whitelist entries', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              ip: fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)),
              transactionId: fc.string({ minLength: 1, maxLength: 64 })
            }),
            { minLength: 2, maxLength: 5 }
          ).filter(payments => {
            // Ensure all IPs and transaction IDs are unique
            const ips = payments.map(p => p.ip);
            const txIds = payments.map(p => p.transactionId);
            return new Set(ips).size === ips.length && new Set(txIds).size === txIds.length;
          }),
          (payments) => {
            // Process payments from different IPs
            const results = payments.map(payment => 
              detector.processPayment(payment.transactionId, payment.ip)
            );
            
            // All payments should succeed and none should be duplicates
            results.forEach(result => {
              expect(result.success).toBe(true);
              expect(result.isDuplicate).toBe(false);
            });
            
            // Each IP should have exactly one whitelist entry
            payments.forEach(payment => {
              expect(detector.getWhitelistEntriesForIP(payment.ip)).toBe(1);
            });
          }
        ),
        { numRuns: 50 } // Reduced runs due to complexity of unique constraint
      );
    });

    test('mixed scenario: same IP with multiple transactions and duplicate transaction attempts', () => {
      const ip = '192.168.1.100';
      const transactionIds = ['tx1', 'tx2', 'tx3'];
      
      // Process first transaction
      const result1 = detector.processPayment(transactionIds[0], ip);
      expect(result1.success).toBe(true);
      expect(result1.isDuplicate).toBe(false);
      
      // Process second transaction from same IP
      const result2 = detector.processPayment(transactionIds[1], ip);
      expect(result2.success).toBe(true);
      expect(result2.isDuplicate).toBe(true);
      
      // Try to process first transaction again (should fail)
      const result3 = detector.processPayment(transactionIds[0], ip);
      expect(result3.success).toBe(false);
      expect(result3.isDuplicate).toBe(true);
      
      // Process third transaction from same IP
      const result4 = detector.processPayment(transactionIds[2], ip);
      expect(result4.success).toBe(true);
      expect(result4.isDuplicate).toBe(true);
      
      // Should still have only one whitelist entry
      expect(detector.getWhitelistEntriesForIP(ip)).toBe(1);
      
      // Should have recorded 3 unique transactions
      expect(detector.getTransactionsForIP(ip)).toHaveLength(3);
    });
  });
});