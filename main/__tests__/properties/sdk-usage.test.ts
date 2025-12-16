/**
 * Property-based tests for dummy transaction system
 */

import fc from 'fast-check';
import { TransactionSimulator } from '../../lib/transaction-simulator';
import type { DummyMovementTransaction, DummyAptosTransaction } from '../../types/dummy-transactions';

describe('Dummy Transaction Property Tests', () => {
  /**
   * Feature: dummy-transaction-mode, Property 1: Network isolation in dummy mode
   * 
   * Property: For any payment verification operation when dummy mode is enabled, 
   * the system should complete without making external network calls to blockchain endpoints
   * 
   * Validates: Requirements 1.1
   */
  test('Property 1: Network isolation in dummy mode', () => {
    fc.assert(fc.asyncProperty(
      fc.record({
        txHash: fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`),
        seed: fc.string({ minLength: 1, maxLength: 20 })
      }),
      async (testData) => {
        // Mock fetch to detect any network calls
        const originalFetch = global.fetch;
        const networkCalls: string[] = [];
        
        global.fetch = jest.fn().mockImplementation((url: string) => {
          networkCalls.push(url);
          throw new Error(`Network call detected to: ${url}`);
        });

        try {
          // Import the verification function that should work in dummy mode
          const { verifyPayment } = require('../../lib/dummy-payment-verification');
          
          // Property: Payment verification should complete without network calls
          const result = await verifyPayment(testData.txHash);
          
          // Property: No network calls should have been made
          expect(networkCalls).toHaveLength(0);
          
          // Property: Function should return a valid result structure
          expect(result).toBeDefined();
          expect(typeof result.valid).toBe('boolean');
          if (!result.valid) {
            expect(typeof result.reason).toBe('string');
          }
          
          return true;
        } finally {
          // Restore original fetch
          global.fetch = originalFetch;
        }
      }
    ), { numRuns: 100 });
  });
  /**
   * Feature: dummy-transaction-mode, Property 2: Deterministic transaction generation
   * 
   * Property: For any given seed value, the Transaction Simulator should generate 
   * identical dummy transactions across multiple runs
   * 
   * Validates: Requirements 1.2, 5.2
   */
  test('Property 2: Deterministic transaction generation', () => {
    fc.assert(fc.property(
      fc.record({
        seed: fc.string({ minLength: 1, maxLength: 20 }),
        recipient: fc.oneof(
          // Movement EVM address (20 bytes, 40 hex chars)
          fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          // Aptos address (32 bytes, 64 hex chars)  
          fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`)
        ),
        amount: fc.bigInt({ min: BigInt(1), max: BigInt("1000000000000000000") }), // 1 wei to 1 ETH
        blockchainType: fc.constantFrom('movement', 'aptos') as fc.Arbitrary<'movement' | 'aptos'>,
        sender: fc.option(fc.hexaString({ minLength: 40, maxLength: 64 }).map(s => `0x${s}`))
      }),
      (testData) => {
        // Create two simulators with the same seed
        const simulator1 = new TransactionSimulator({ seed: testData.seed });
        const simulator2 = new TransactionSimulator({ seed: testData.seed });
        
        const params = {
          recipient: testData.recipient,
          amount: testData.amount,
          blockchainType: testData.blockchainType,
          sender: testData.sender || undefined
        };

        // Generate transactions with both simulators
        const transaction1 = simulator1.generateDummyTransaction(params);
        const transaction2 = simulator2.generateDummyTransaction(params);

        // Property: Transactions should be identical when using the same seed
        expect(transaction1).toEqual(transaction2);

        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Feature: dummy-transaction-mode, Property 4: Blockchain format compliance
   * 
   * Property: For any generated dummy transaction, the transaction structure should 
   * conform to the appropriate blockchain format specification (Movement EVM or Aptos)
   * 
   * Validates: Requirements 2.1, 4.1, 4.2
   */
  test('Property 4: Blockchain format compliance', () => {
    fc.assert(fc.property(
      fc.record({
        recipient: fc.oneof(
          // Movement EVM address (20 bytes, 40 hex chars)
          fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          // Aptos address (32 bytes, 64 hex chars)  
          fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`)
        ),
        amount: fc.bigInt({ min: BigInt(1), max: BigInt("1000000000000000000") }), // 1 wei to 1 ETH
        blockchainType: fc.constantFrom('movement', 'aptos') as fc.Arbitrary<'movement' | 'aptos'>,
        seed: fc.string({ minLength: 1, maxLength: 20 })
      }),
      (testData) => {
        const simulator = new TransactionSimulator({ seed: testData.seed });
        
        const transaction = simulator.generateDummyTransaction({
          recipient: testData.recipient,
          amount: testData.amount,
          blockchainType: testData.blockchainType
        });

        if (testData.blockchainType === 'movement') {
          const moveTx = transaction as DummyMovementTransaction;
          
          // Property: Movement transactions should have EVM format
          expect(moveTx.hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
          expect(moveTx.to).toBe(testData.recipient.toLowerCase());
          expect(moveTx.from).toMatch(/^0x[0-9a-fA-F]{40}$/);
          expect(moveTx.value).toMatch(/^0x[0-9a-fA-F]+$/);
          expect(moveTx.gas).toMatch(/^0x[0-9a-fA-F]+$/);
          expect(moveTx.gasPrice).toMatch(/^0x[0-9a-fA-F]+$/);
          expect(moveTx.nonce).toMatch(/^0x[0-9a-fA-F]+$/);
          expect(moveTx.blockNumber).toMatch(/^0x[0-9a-fA-F]+$/);
          expect(moveTx.blockHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
          expect(moveTx.transactionIndex).toMatch(/^0x[0-9a-fA-F]+$/);
          expect(['0x1', '0x0']).toContain(moveTx.status);
          
          // Property: Amount should match input
          expect(BigInt(moveTx.value)).toBe(testData.amount);
        } else {
          const aptosTx = transaction as DummyAptosTransaction;
          
          // Property: Aptos transactions should have Aptos format
          expect(aptosTx.hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
          expect(aptosTx.sender).toMatch(/^0x[0-9a-fA-F]{64}$/);
          expect(aptosTx.sequence_number).toMatch(/^\d+$/);
          expect(typeof aptosTx.success).toBe('boolean');
          expect(aptosTx.payload.type).toBe('entry_function_payload');
          expect(aptosTx.payload.function).toBe('0x1::coin::transfer');
          expect(aptosTx.payload.arguments).toHaveLength(2);
          expect(aptosTx.payload.arguments[0]).toBe(testData.recipient);
          expect(aptosTx.payload.arguments[1]).toBe(testData.amount.toString());
          expect(aptosTx.payload.type_arguments).toEqual(['0x1::aptos_coin::AptosCoin']);
          expect(aptosTx.timestamp).toMatch(/^\d+$/);
          expect(aptosTx.version).toMatch(/^\d+$/);
          expect(aptosTx.max_gas_amount).toMatch(/^\d+$/);
          expect(aptosTx.gas_unit_price).toMatch(/^\d+$/);
          expect(aptosTx.gas_used).toMatch(/^\d+$/);
          expect(typeof aptosTx.vm_status).toBe('string');
          
          // Property: Amount should match input
          expect(BigInt(aptosTx.payload.arguments[1])).toBe(testData.amount);
        }

        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Feature: dummy-transaction-mode, Property 5: Validation rule consistency
   * 
   * Property: For any payment validation scenario, the validation logic should produce 
   * identical results in both real and dummy modes for equivalent transaction data
   * 
   * Validates: Requirements 2.2, 4.3, 4.4
   */
  test('Property 5: Validation rule consistency', () => {
    fc.assert(fc.property(
      fc.record({
        seed: fc.string({ minLength: 1, maxLength: 20 }),
        recipient: fc.oneof(
          // Movement EVM address (20 bytes, 40 hex chars)
          fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          // Aptos address (32 bytes, 64 hex chars)  
          fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`)
        ),
        expectedAmount: fc.bigInt({ min: BigInt(1), max: BigInt("1000000000000000000") }),
        actualAmount: fc.bigInt({ min: BigInt(1), max: BigInt("2000000000000000000") }),
        blockchainType: fc.constantFrom('movement', 'aptos') as fc.Arbitrary<'movement' | 'aptos'>,
        shouldSucceed: fc.boolean(),
        sender: fc.option(fc.hexaString({ minLength: 40, maxLength: 64 }).map(s => `0x${s}`))
      }),
      (testData) => {
        // Create two simulators with the same seed for consistency
        const simulator1 = new TransactionSimulator({ 
          seed: testData.seed, 
          successRate: testData.shouldSucceed ? 1.0 : 0.0 
        });
        const simulator2 = new TransactionSimulator({ 
          seed: testData.seed, 
          successRate: testData.shouldSucceed ? 1.0 : 0.0 
        });
        
        // Generate identical transactions with both simulators
        const params = {
          recipient: testData.recipient,
          amount: testData.actualAmount,
          blockchainType: testData.blockchainType,
          sender: testData.sender || undefined
        };

        const transaction1 = simulator1.generateDummyTransaction(params);
        const transaction2 = simulator2.generateDummyTransaction(params);

        // Property: Validation should be consistent across simulators with same seed
        const result1 = simulator1.validateDummyPayment(
          transaction1.hash, 
          testData.expectedAmount, 
          testData.recipient
        );
        const result2 = simulator2.validateDummyPayment(
          transaction2.hash, 
          testData.expectedAmount, 
          testData.recipient
        );

        // Property: Same validation logic should produce same results
        expect(result1.valid).toBe(result2.valid);
        if (!result1.valid && !result2.valid) {
          expect(result1.reason).toBe(result2.reason);
        }

        // Property: Validation should follow consistent rules
        if (testData.shouldSucceed && testData.actualAmount >= testData.expectedAmount) {
          // Should succeed when transaction succeeds and amount is sufficient
          expect(result1.valid).toBe(true);
          expect(result2.valid).toBe(true);
        } else if (!testData.shouldSucceed) {
          // Should fail when transaction fails on-chain
          expect(result1.valid).toBe(false);
          expect(result2.valid).toBe(false);
          expect(result1.reason).toContain("failed on-chain");
          expect(result2.reason).toContain("failed on-chain");
        } else if (testData.actualAmount < testData.expectedAmount) {
          // Should fail when amount is insufficient
          expect(result1.valid).toBe(false);
          expect(result2.valid).toBe(false);
          expect(result1.reason).toContain("Insufficient payment");
          expect(result2.reason).toContain("Insufficient payment");
        }

        // Property: Validation should be deterministic for same inputs
        const result1Repeat = simulator1.validateDummyPayment(
          transaction1.hash, 
          testData.expectedAmount, 
          testData.recipient
        );
        expect(result1).toEqual(result1Repeat);

        // Property: Wrong recipient should fail (but only if transaction succeeded)
        if (testData.shouldSucceed) {
          const wrongRecipient = testData.blockchainType === 'movement' 
            ? '0x0000000000000000000000000000000000000000'
            : '0x0000000000000000000000000000000000000000000000000000000000000000';
          
          const wrongRecipientResult = simulator1.validateDummyPayment(
            transaction1.hash,
            testData.expectedAmount,
            wrongRecipient
          );
          expect(wrongRecipientResult.valid).toBe(false);
          expect(wrongRecipientResult.reason).toContain("wrong wallet");
        }

        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Feature: dummy-transaction-mode, Property 6: Success and failure simulation
   * 
   * Property: For any configured success rate, the Transaction Simulator should generate 
   * successful and failed transactions at the specified rate over many iterations
   * 
   * Validates: Requirements 2.3, 5.3
   */
  test('Property 6: Success and failure simulation', () => {
    fc.assert(fc.property(
      fc.record({
        successRate: fc.float({ min: 0.0, max: 1.0, noNaN: true }),
        sampleSize: fc.integer({ min: 50, max: 200 }), // Large enough sample for statistical significance
        seed: fc.string({ minLength: 1, maxLength: 20 }),
        recipient: fc.oneof(
          // Movement EVM address (20 bytes, 40 hex chars)
          fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          // Aptos address (32 bytes, 64 hex chars)  
          fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`)
        ),
        blockchainType: fc.constantFrom('movement', 'aptos') as fc.Arbitrary<'movement' | 'aptos'>
      }),
      (testData) => {
        const simulator = new TransactionSimulator({ 
          seed: testData.seed,
          successRate: testData.successRate 
        });
        
        let successCount = 0;
        let failureCount = 0;

        // Generate many transactions to test success rate
        for (let i = 0; i < testData.sampleSize; i++) {
          const transaction = simulator.generateDummyTransaction({
            recipient: testData.recipient,
            amount: BigInt(1000000 + i), // Vary amount to ensure different transactions
            blockchainType: testData.blockchainType
          });

          // Check if transaction succeeded based on blockchain type
          if (testData.blockchainType === 'movement') {
            const moveTx = transaction as any;
            if (moveTx.status === "0x1") {
              successCount++;
            } else {
              failureCount++;
            }
          } else {
            const aptosTx = transaction as any;
            if (aptosTx.success) {
              successCount++;
            } else {
              failureCount++;
            }
          }
        }

        const actualSuccessRate = successCount / testData.sampleSize;
        const tolerance = 0.15; // Allow 15% tolerance for statistical variation

        // Property: Success rate should be approximately equal to configured rate
        // For edge cases (0.0 and 1.0), we expect exact matches
        if (testData.successRate === 0.0) {
          expect(successCount).toBe(0);
          expect(failureCount).toBe(testData.sampleSize);
        } else if (testData.successRate === 1.0) {
          expect(successCount).toBe(testData.sampleSize);
          expect(failureCount).toBe(0);
        } else {
          // For rates between 0 and 1, allow statistical tolerance
          expect(actualSuccessRate).toBeGreaterThanOrEqual(testData.successRate - tolerance);
          expect(actualSuccessRate).toBeLessThanOrEqual(testData.successRate + tolerance);
        }

        // Property: Total transactions should equal sample size
        expect(successCount + failureCount).toBe(testData.sampleSize);

        // Property: Both success and failure should be possible for rates between 0 and 1
        if (testData.successRate > 0.0 && testData.successRate < 1.0 && testData.sampleSize >= 50) {
          // With a large enough sample, we should see both successes and failures
          // unless the rate is very close to 0 or 1
          if (testData.successRate >= 0.1 && testData.successRate <= 0.9) {
            expect(successCount).toBeGreaterThan(0);
            expect(failureCount).toBeGreaterThan(0);
          }
        }

        // Property: Deterministic behavior - same seed should produce same results
        const simulator2 = new TransactionSimulator({ 
          seed: testData.seed,
          successRate: testData.successRate 
        });
        
        const firstTransaction = simulator2.generateDummyTransaction({
          recipient: testData.recipient,
          amount: BigInt(1000000), // Same as first transaction above
          blockchainType: testData.blockchainType
        });

        // First transactions should have same success/failure status
        if (testData.blockchainType === 'movement') {
          const originalTx = simulator.generateDummyTransaction({
            recipient: testData.recipient,
            amount: BigInt(1000000),
            blockchainType: testData.blockchainType
          });
          // Reset simulator to get first transaction again
          const simulator3 = new TransactionSimulator({ 
            seed: testData.seed,
            successRate: testData.successRate 
          });
          const repeatTx = simulator3.generateDummyTransaction({
            recipient: testData.recipient,
            amount: BigInt(1000000),
            blockchainType: testData.blockchainType
          });
          expect((repeatTx as any).status).toBe((firstTransaction as any).status);
        } else {
          const simulator3 = new TransactionSimulator({ 
            seed: testData.seed,
            successRate: testData.successRate 
          });
          const repeatTx = simulator3.generateDummyTransaction({
            recipient: testData.recipient,
            amount: BigInt(1000000),
            blockchainType: testData.blockchainType
          });
          expect((repeatTx as any).success).toBe((firstTransaction as any).success);
        }

        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Feature: dummy-transaction-mode, Property 7: Transaction hash uniqueness
   * 
   * Property: For any set of generated dummy transactions, all transaction hashes 
   * should be unique and follow blockchain hash format (64 hexadecimal characters)
   * 
   * Validates: Requirements 2.4, 6.5
   */
  test('Property 7: Transaction hash uniqueness', () => {
    fc.assert(fc.property(
      fc.record({
        transactionCount: fc.integer({ min: 2, max: 50 }), // Generate multiple transactions
        seed: fc.string({ minLength: 1, maxLength: 20 }),
        baseRecipient: fc.oneof(
          // Movement EVM address (20 bytes, 40 hex chars)
          fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          // Aptos address (32 bytes, 64 hex chars)  
          fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`)
        ),
        blockchainType: fc.constantFrom('movement', 'aptos') as fc.Arbitrary<'movement' | 'aptos'>
      }),
      (testData) => {
        const simulator = new TransactionSimulator({ seed: testData.seed });
        const generatedHashes = new Set<string>();
        const transactions: any[] = [];

        // Generate multiple transactions with varying parameters
        for (let i = 0; i < testData.transactionCount; i++) {
          const transaction = simulator.generateDummyTransaction({
            recipient: testData.baseRecipient,
            amount: BigInt(1000000 + i), // Vary amount to ensure different transactions
            blockchainType: testData.blockchainType,
            sender: i % 2 === 0 ? undefined : `0x${i.toString(16).padStart(40, '0')}`
          });

          transactions.push(transaction);

          // Property: Hash should follow blockchain format (64 hex characters)
          expect(transaction.hash).toMatch(/^0x[0-9a-fA-F]{64}$/);

          // Property: Hash should be unique
          expect(generatedHashes.has(transaction.hash)).toBe(false);
          generatedHashes.add(transaction.hash);
        }

        // Property: All hashes should be unique (no duplicates)
        expect(generatedHashes.size).toBe(testData.transactionCount);

        // Property: Different transactions should have different hashes
        for (let i = 0; i < transactions.length - 1; i++) {
          for (let j = i + 1; j < transactions.length; j++) {
            expect(transactions[i].hash).not.toBe(transactions[j].hash);
          }
        }

        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Feature: dummy-transaction-mode, Property 11: Insufficient payment rejection
   * 
   * Property: For any dummy transaction with amount below the required threshold, 
   * the Payment Verification System should reject it with an insufficient payment error
   * 
   * Validates: Requirements 3.5, 6.4
   */
  test('Property 11: Insufficient payment rejection', () => {
    fc.assert(fc.property(
      fc.record({
        seed: fc.string({ minLength: 1, maxLength: 20 }),
        recipient: fc.oneof(
          // Movement EVM address (20 bytes, 40 hex chars)
          fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          // Aptos address (32 bytes, 64 hex chars)  
          fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`)
        ),
        blockchainType: fc.constantFrom('movement', 'aptos') as fc.Arbitrary<'movement' | 'aptos'>,
        // Generate amounts where actualAmount < expectedAmount to test insufficient payment
        expectedAmount: fc.bigInt({ min: BigInt(1000), max: BigInt("1000000000000000000") }), // 1000 wei to 1 ETH
        insufficientAmount: fc.bigInt({ min: BigInt(1), max: BigInt(999) }), // Always less than expectedAmount
        sender: fc.option(fc.hexaString({ minLength: 40, maxLength: 64 }).map(s => `0x${s}`))
      }),
      (testData) => {
        // Ensure insufficient amount is actually less than expected amount
        const actualInsufficientAmount = testData.insufficientAmount % testData.expectedAmount;
        
        // Skip if amounts are equal (edge case)
        fc.pre(actualInsufficientAmount < testData.expectedAmount);
        
        // Create simulator with 100% success rate to ensure transaction succeeds on-chain
        // but fails validation due to insufficient amount
        const simulator = new TransactionSimulator({ 
          seed: testData.seed,
          successRate: 1.0 // Always succeed on-chain to isolate amount validation
        });
        
        // Generate transaction with insufficient amount
        const transaction = simulator.generateDummyTransaction({
          recipient: testData.recipient,
          amount: actualInsufficientAmount,
          blockchainType: testData.blockchainType,
          sender: testData.sender || undefined
        });

        // Property: Transaction should be generated successfully
        expect(transaction).toBeDefined();
        expect(transaction.hash).toMatch(/^0x[0-9a-fA-F]{64}$/);

        // Property: Transaction should succeed on-chain (due to 100% success rate)
        if (testData.blockchainType === 'movement') {
          const moveTx = transaction as any;
          expect(moveTx.status).toBe("0x1"); // Should succeed on-chain
        } else {
          const aptosTx = transaction as any;
          expect(aptosTx.success).toBe(true); // Should succeed on-chain
        }

        // Property: Validation should fail due to insufficient amount
        const validationResult = simulator.validateDummyPayment(
          transaction.hash,
          testData.expectedAmount,
          testData.recipient
        );

        // Property: Validation should fail
        expect(validationResult.valid).toBe(false);
        
        // Property: Error message should indicate insufficient payment
        expect(validationResult.reason).toBeDefined();
        expect(validationResult.reason).toContain("Insufficient payment");
        
        // Property: Error message should include amount details
        if (testData.blockchainType === 'movement') {
          expect(validationResult.reason).toContain("Sent");
          expect(validationResult.reason).toContain("needed");
          expect(validationResult.reason).toContain(testData.expectedAmount.toString());
        } else {
          expect(validationResult.reason).toContain("Sent");
          expect(validationResult.reason).toContain("octas");
          expect(validationResult.reason).toContain("needed");
          expect(validationResult.reason).toContain(testData.expectedAmount.toString());
        }

        // Property: Transaction should be included in failed validation result
        expect(validationResult.transaction).toBeUndefined(); // Failed validations don't include transaction

        // Property: Same validation should be consistent (deterministic)
        const repeatValidation = simulator.validateDummyPayment(
          transaction.hash,
          testData.expectedAmount,
          testData.recipient
        );
        expect(repeatValidation).toEqual(validationResult);

        // Property: Validation with correct amount should succeed (if we had sufficient amount)
        // Generate a new transaction with sufficient amount to verify the validation logic works both ways
        const sufficientTransaction = simulator.generateDummyTransaction({
          recipient: testData.recipient,
          amount: testData.expectedAmount + BigInt(1), // Slightly more than expected
          blockchainType: testData.blockchainType,
          sender: testData.sender || undefined
        });

        const sufficientValidation = simulator.validateDummyPayment(
          sufficientTransaction.hash,
          testData.expectedAmount,
          testData.recipient
        );

        // Property: Sufficient payment should pass validation
        expect(sufficientValidation.valid).toBe(true);
        expect(sufficientValidation.reason).toBeUndefined();
        expect(sufficientValidation.transaction).toBeDefined();

        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Feature: dummy-transaction-mode, Property 9: Serialization round trip
   * 
   * Property: For any dummy transaction object, serializing to JSON then deserializing 
   * should produce an equivalent object
   * 
   * Validates: Requirements 3.1, 3.2, 3.3, 6.2
   */
  test('Property 9: Serialization round trip', () => {
    fc.assert(fc.property(
      fc.record({
        seed: fc.string({ minLength: 1, maxLength: 20 }),
        recipient: fc.oneof(
          // Movement EVM address (20 bytes, 40 hex chars)
          fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          // Aptos address (32 bytes, 64 hex chars)  
          fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`)
        ),
        amount: fc.bigInt({ min: BigInt(1), max: BigInt("1000000000000000000") }),
        blockchainType: fc.constantFrom('movement', 'aptos') as fc.Arbitrary<'movement' | 'aptos'>,
        sender: fc.option(fc.hexaString({ minLength: 40, maxLength: 64 }).map(s => `0x${s}`)),
        transactionCount: fc.integer({ min: 1, max: 10 }) // Test multiple transactions
      }),
      (testData) => {
        const simulator = new TransactionSimulator({ seed: testData.seed });
        const { DummyTransactionStore } = require('../../lib/dummy-transaction-store');
        const store = new DummyTransactionStore();
        
        const originalTransactions: any[] = [];
        const originalUsedHashes: string[] = [];

        // Generate multiple transactions and mark some as used
        for (let i = 0; i < testData.transactionCount; i++) {
          const transaction = simulator.generateDummyTransaction({
            recipient: testData.recipient,
            amount: testData.amount + BigInt(i),
            blockchainType: testData.blockchainType,
            sender: testData.sender || undefined
          });
          
          originalTransactions.push(transaction);
          store.store(transaction);
          
          // Mark some transactions as used
          if (i % 2 === 0) {
            store.markAsUsed(transaction.hash);
            originalUsedHashes.push(transaction.hash);
          }
        }

        // Property: Store should contain all transactions
        expect(store.getTransactionCount()).toBe(testData.transactionCount);
        
        // Property: Serialize store to JSON
        const jsonString = store.toJSON();
        expect(typeof jsonString).toBe('string');
        expect(jsonString.length).toBeGreaterThan(0);
        
        // Property: JSON should be valid JSON
        expect(() => JSON.parse(jsonString)).not.toThrow();
        
        // Property: Deserialize from JSON should restore identical state
        const newStore = new DummyTransactionStore();
        expect(() => newStore.fromJSON(jsonString)).not.toThrow();
        
        // Property: Transaction count should be preserved
        expect(newStore.getTransactionCount()).toBe(store.getTransactionCount());
        
        // Property: All transactions should be preserved
        for (const originalTx of originalTransactions) {
          const retrievedTx = newStore.retrieve(originalTx.hash);
          expect(retrievedTx).toBeDefined();
          expect(retrievedTx).toEqual(originalTx);
        }
        
        // Property: Used hashes should be preserved
        for (const usedHash of originalUsedHashes) {
          expect(newStore.isUsed(usedHash)).toBe(true);
        }
        
        // Property: Non-used hashes should remain non-used
        for (let i = 0; i < originalTransactions.length; i++) {
          const hash = originalTransactions[i].hash;
          const shouldBeUsed = i % 2 === 0;
          expect(newStore.isUsed(hash)).toBe(shouldBeUsed);
        }
        
        // Property: Individual transaction serialization round trip
        for (const originalTx of originalTransactions) {
          const txJsonString = store.transactionToJSON(originalTx);
          expect(typeof txJsonString).toBe('string');
          expect(txJsonString.length).toBeGreaterThan(0);
          
          const deserializedTx = store.transactionFromJSON(txJsonString);
          expect(deserializedTx).toEqual(originalTx);
          
          // Property: Serialized transaction should be valid JSON
          expect(() => JSON.parse(txJsonString)).not.toThrow();
          
          // Property: Deserialized transaction should have correct structure
          expect(deserializedTx.hash).toBe(originalTx.hash);
          if (testData.blockchainType === 'movement') {
            expect('to' in deserializedTx).toBe(true);
            expect('from' in deserializedTx).toBe(true);
            expect('value' in deserializedTx).toBe(true);
            expect('status' in deserializedTx).toBe(true);
          } else {
            expect('sender' in deserializedTx).toBe(true);
            expect('payload' in deserializedTx).toBe(true);
            expect('success' in deserializedTx).toBe(true);
          }
        }
        
        // Property: Multiple round trips should be stable
        const secondJsonString = newStore.toJSON();
        expect(secondJsonString).toBe(jsonString);
        
        const thirdStore = new DummyTransactionStore();
        thirdStore.fromJSON(secondJsonString);
        const thirdJsonString = thirdStore.toJSON();
        expect(thirdJsonString).toBe(jsonString);
        
        // Property: Empty store serialization should work
        const emptyStore = new DummyTransactionStore();
        const emptyJson = emptyStore.toJSON();
        expect(typeof emptyJson).toBe('string');
        
        const restoredEmptyStore = new DummyTransactionStore();
        expect(() => restoredEmptyStore.fromJSON(emptyJson)).not.toThrow();
        expect(restoredEmptyStore.getTransactionCount()).toBe(0);
        
        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Feature: dummy-transaction-mode, Property 15: Configuration error handling
   * 
   * Property: For any invalid dummy mode configuration values, the system should log 
   * appropriate errors and fail safely without crashing
   * 
   * Validates: Requirements 5.5
   */
  test('Property 15: Configuration error handling', () => {
    fc.assert(fc.property(
      fc.record({
        invalidSuccessRate: fc.oneof(
          fc.float({ min: Math.fround(-10), max: Math.fround(-0.1) }), // Negative rates
          fc.float({ min: Math.fround(1.1), max: Math.fround(10) }), // Rates > 1
          fc.constant(NaN),
          fc.constant(Infinity),
          fc.constant(-Infinity)
        ),
        validSeed: fc.string({ minLength: 1, maxLength: 20 }),
        validWallet: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`)
      }),
      (testData) => {
        // Property: Invalid success rates should be handled gracefully
        const { TransactionSimulator } = require('../../lib/transaction-simulator');
        const simulator = new TransactionSimulator({ 
          seed: testData.validSeed,
          successRate: testData.invalidSuccessRate 
        });
        
        // Property: Success rate should be clamped to valid range [0, 1]
        const config = simulator.getConfig();
        expect(config.successRate).toBeGreaterThanOrEqual(0);
        expect(config.successRate).toBeLessThanOrEqual(1);
        expect(typeof config.successRate).toBe('number');
        expect(isNaN(config.successRate)).toBe(false);
        expect(isFinite(config.successRate)).toBe(true);

        // Property: System should continue to function after configuration errors
        expect(() => {
          const transaction = simulator.generateDummyTransaction({
            recipient: testData.validWallet,
            amount: BigInt(1000000),
            blockchainType: 'movement'
          });
          expect(transaction).toBeDefined();
          expect(transaction.hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
        }).not.toThrow();

        // Property: JSON serialization errors should be handled gracefully
        const { DummyTransactionStore } = require('../../lib/dummy-transaction-store');
        const store = new DummyTransactionStore();
        
        const invalidJSONStrings = [
          '{"invalid": json}', // Invalid JSON syntax
          '{"transactions": "not-an-object"}', // Wrong type for transactions
          '', // Empty string
          'null' // Null JSON
        ];
        
        for (const invalidJSON of invalidJSONStrings) {
          expect(() => {
            store.fromJSON(invalidJSON);
          }).toThrow();
          
          // Property: Store should remain in valid state after error
          expect(store.getTransactionCount()).toBe(0);
        }

        return true;
      }
    ), { numRuns: 50 });
  });

  /**
   * Feature: dummy-transaction-mode, Property 12: Multi-format support
   * 
   * Property: For any session, the system should successfully process both Movement EVM 
   * and Aptos dummy transactions simultaneously
   * 
   * Validates: Requirements 4.5
   */
  test('Property 12: Multi-format support', () => {
    fc.assert(fc.property(
      fc.record({
        seed: fc.string({ minLength: 1, maxLength: 20 }),
        movementRecipient: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`), // Movement EVM address
        aptosRecipient: fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`), // Aptos address
        movementAmount: fc.bigInt({ min: BigInt(1), max: BigInt("1000000000000000000") }), // Wei
        aptosAmount: fc.bigInt({ min: BigInt(1), max: BigInt("1000000000000000000") }), // Octas
        transactionCount: fc.integer({ min: 2, max: 10 }), // Multiple transactions per format
        successRate: fc.float({ min: 0.0, max: 1.0, noNaN: true })
      }),
      (testData) => {
        // Create simulator that supports both formats
        const simulator = new TransactionSimulator({ 
          seed: testData.seed,
          successRate: testData.successRate
        });
        
        const movementTransactions: any[] = [];
        const aptosTransactions: any[] = [];
        const allHashes = new Set<string>();

        // Property: Generate multiple Movement EVM transactions
        for (let i = 0; i < testData.transactionCount; i++) {
          const movementTx = simulator.generateDummyTransaction({
            recipient: testData.movementRecipient,
            amount: testData.movementAmount + BigInt(i),
            blockchainType: 'movement'
          });
          
          movementTransactions.push(movementTx);
          
          // Property: Movement transaction should have correct format
          expect(movementTx.hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
          expect('to' in movementTx).toBe(true);
          expect('from' in movementTx).toBe(true);
          expect('value' in movementTx).toBe(true);
          expect('status' in movementTx).toBe(true);
          expect(movementTx.to).toBe(testData.movementRecipient.toLowerCase());
          expect(BigInt(movementTx.value)).toBe(testData.movementAmount + BigInt(i));
          
          // Property: Hash should be unique across all transactions
          expect(allHashes.has(movementTx.hash)).toBe(false);
          allHashes.add(movementTx.hash);
        }

        // Property: Generate multiple Aptos transactions in the same session
        for (let i = 0; i < testData.transactionCount; i++) {
          const aptosTx = simulator.generateDummyTransaction({
            recipient: testData.aptosRecipient,
            amount: testData.aptosAmount + BigInt(i),
            blockchainType: 'aptos'
          });
          
          aptosTransactions.push(aptosTx);
          
          // Property: Aptos transaction should have correct format
          expect(aptosTx.hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
          expect('sender' in aptosTx).toBe(true);
          expect('payload' in aptosTx).toBe(true);
          expect('success' in aptosTx).toBe(true);
          expect(aptosTx.payload.type).toBe('entry_function_payload');
          expect(aptosTx.payload.function).toBe('0x1::coin::transfer');
          expect(aptosTx.payload.arguments[0]).toBe(testData.aptosRecipient);
          expect(BigInt(aptosTx.payload.arguments[1])).toBe(testData.aptosAmount + BigInt(i));
          
          // Property: Hash should be unique across all transactions (including Movement)
          expect(allHashes.has(aptosTx.hash)).toBe(false);
          allHashes.add(aptosTx.hash);
        }

        // Property: All transactions should be retrievable by hash
        for (const movementTx of movementTransactions) {
          const retrieved = simulator.getDummyTransactionByHash(movementTx.hash);
          expect(retrieved).toEqual(movementTx);
        }
        
        for (const aptosTx of aptosTransactions) {
          const retrieved = simulator.getDummyTransactionByHash(aptosTx.hash);
          expect(retrieved).toEqual(aptosTx);
        }

        // Property: Validation should work correctly for both formats
        for (const movementTx of movementTransactions) {
          const validationResult = simulator.validateDummyPayment(
            movementTx.hash,
            testData.movementAmount,
            testData.movementRecipient
          );
          
          // Validation result should depend on transaction success and amount
          if (movementTx.status === "0x1" && BigInt(movementTx.value) >= testData.movementAmount) {
            expect(validationResult.valid).toBe(true);
            expect(validationResult.transaction).toEqual(movementTx);
          } else {
            expect(validationResult.valid).toBe(false);
            expect(validationResult.reason).toBeDefined();
          }
        }
        
        for (const aptosTx of aptosTransactions) {
          const validationResult = simulator.validateDummyPayment(
            aptosTx.hash,
            testData.aptosAmount,
            testData.aptosRecipient
          );
          
          // Validation result should depend on transaction success and amount
          if (aptosTx.success && BigInt(aptosTx.payload.arguments[1]) >= testData.aptosAmount) {
            expect(validationResult.valid).toBe(true);
            expect(validationResult.transaction).toEqual(aptosTx);
          } else {
            expect(validationResult.valid).toBe(false);
            expect(validationResult.reason).toBeDefined();
          }
        }

        // Property: Cross-format validation should fail appropriately
        // Try to validate Movement transaction with Aptos recipient (should fail)
        if (movementTransactions.length > 0) {
          const movementTx = movementTransactions[0];
          const crossValidation = simulator.validateDummyPayment(
            movementTx.hash,
            testData.movementAmount,
            testData.aptosRecipient // Wrong recipient format
          );
          expect(crossValidation.valid).toBe(false);
          
          // The reason should be either transaction failure or wrong wallet
          // If transaction succeeded on-chain, it should fail due to wrong wallet
          // If transaction failed on-chain, it should fail due to transaction failure
          if (movementTx.status === "0x1") {
            expect(crossValidation.reason).toContain("wrong wallet");
          } else {
            expect(crossValidation.reason).toContain("failed on-chain");
          }
        }

        // Property: Format detection should work correctly
        // Movement transactions should not have Aptos-specific fields
        for (const movementTx of movementTransactions) {
          expect('sender' in movementTx).toBe(false);
          expect('payload' in movementTx).toBe(false);
          expect('success' in movementTx).toBe(false);
        }
        
        // Aptos transactions should not have Movement-specific fields
        for (const aptosTx of aptosTransactions) {
          expect('to' in aptosTx).toBe(false);
          expect('from' in aptosTx).toBe(false);
          expect('value' in aptosTx).toBe(false);
          expect('status' in aptosTx).toBe(false);
        }

        // Property: Total transaction count should be correct
        expect(allHashes.size).toBe(testData.transactionCount * 2);
        expect(movementTransactions.length).toBe(testData.transactionCount);
        expect(aptosTransactions.length).toBe(testData.transactionCount);

        // Property: Serialization should work for both formats
        const { DummyTransactionStore } = require('../../lib/dummy-transaction-store');
        const store = new DummyTransactionStore();
        
        // Store all transactions
        for (const tx of [...movementTransactions, ...aptosTransactions]) {
          store.store(tx);
        }
        
        // Property: All transactions should be serializable and deserializable
        const jsonString = store.toJSON();
        expect(typeof jsonString).toBe('string');
        
        const newStore = new DummyTransactionStore();
        expect(() => newStore.fromJSON(jsonString)).not.toThrow();
        
        // Property: All transactions should be preserved after serialization
        for (const tx of [...movementTransactions, ...aptosTransactions]) {
          const retrieved = newStore.retrieve(tx.hash);
          expect(retrieved).toEqual(tx);
        }

        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Feature: dummy-transaction-mode, Property 8: Query consistency
   * 
   * Property: For any transaction hash, querying the same hash multiple times 
   * should return identical transaction data
   * 
   * Validates: Requirements 2.5
   */
  test('Property 8: Query consistency', () => {
    fc.assert(fc.property(
      fc.record({
        seed: fc.string({ minLength: 1, maxLength: 20 }),
        recipient: fc.oneof(
          // Movement EVM address (20 bytes, 40 hex chars)
          fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          // Aptos address (32 bytes, 64 hex chars)  
          fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`)
        ),
        amount: fc.bigInt({ min: BigInt(1), max: BigInt("1000000000000000000") }),
        blockchainType: fc.constantFrom('movement', 'aptos') as fc.Arbitrary<'movement' | 'aptos'>,
        sender: fc.option(fc.hexaString({ minLength: 40, maxLength: 64 }).map(s => `0x${s}`)),
        queryCount: fc.integer({ min: 2, max: 20 }), // Number of times to query the same hash
        transactionCount: fc.integer({ min: 1, max: 10 }) // Number of different transactions to test
      }),
      (testData) => {
        const simulator = new TransactionSimulator({ seed: testData.seed });
        const generatedTransactions: any[] = [];
        const transactionHashes: string[] = [];

        // Generate multiple transactions to test query consistency
        for (let i = 0; i < testData.transactionCount; i++) {
          const transaction = simulator.generateDummyTransaction({
            recipient: testData.recipient,
            amount: testData.amount + BigInt(i),
            blockchainType: testData.blockchainType,
            sender: testData.sender || undefined
          });
          
          generatedTransactions.push(transaction);
          transactionHashes.push(transaction.hash);
        }

        // Property: Multiple queries of the same hash should return identical results
        for (let txIndex = 0; txIndex < generatedTransactions.length; txIndex++) {
          const originalTransaction = generatedTransactions[txIndex];
          const hash = transactionHashes[txIndex];
          const queryResults: any[] = [];

          // Query the same hash multiple times
          for (let queryIndex = 0; queryIndex < testData.queryCount; queryIndex++) {
            const queriedTransaction = simulator.getDummyTransactionByHash(hash);
            queryResults.push(queriedTransaction);
          }

          // Property: All query results should be identical
          for (let i = 0; i < queryResults.length; i++) {
            expect(queryResults[i]).toEqual(originalTransaction);
            
            // Property: Each query should return the exact same object structure
            if (queryResults[i] !== null) {
              expect(queryResults[i].hash).toBe(originalTransaction.hash);
              
              if (testData.blockchainType === 'movement') {
                expect(queryResults[i].to).toBe(originalTransaction.to);
                expect(queryResults[i].from).toBe(originalTransaction.from);
                expect(queryResults[i].value).toBe(originalTransaction.value);
                expect(queryResults[i].status).toBe(originalTransaction.status);
                expect(queryResults[i].gas).toBe(originalTransaction.gas);
                expect(queryResults[i].gasPrice).toBe(originalTransaction.gasPrice);
                expect(queryResults[i].nonce).toBe(originalTransaction.nonce);
                expect(queryResults[i].blockNumber).toBe(originalTransaction.blockNumber);
                expect(queryResults[i].blockHash).toBe(originalTransaction.blockHash);
                expect(queryResults[i].transactionIndex).toBe(originalTransaction.transactionIndex);
              } else {
                expect(queryResults[i].sender).toBe(originalTransaction.sender);
                expect(queryResults[i].sequence_number).toBe(originalTransaction.sequence_number);
                expect(queryResults[i].success).toBe(originalTransaction.success);
                expect(queryResults[i].payload).toEqual(originalTransaction.payload);
                expect(queryResults[i].timestamp).toBe(originalTransaction.timestamp);
                expect(queryResults[i].version).toBe(originalTransaction.version);
                expect(queryResults[i].max_gas_amount).toBe(originalTransaction.max_gas_amount);
                expect(queryResults[i].gas_unit_price).toBe(originalTransaction.gas_unit_price);
                expect(queryResults[i].gas_used).toBe(originalTransaction.gas_used);
                expect(queryResults[i].vm_status).toBe(originalTransaction.vm_status);
              }
            }
          }

          // Property: All queries should return the same reference or deep equal objects
          for (let i = 1; i < queryResults.length; i++) {
            expect(queryResults[i]).toEqual(queryResults[0]);
          }
        }

        // Property: Query consistency should work across different simulators with same seed
        const simulator2 = new TransactionSimulator({ seed: testData.seed });
        
        // Generate the same transactions with the second simulator
        for (let i = 0; i < testData.transactionCount; i++) {
          const transaction2 = simulator2.generateDummyTransaction({
            recipient: testData.recipient,
            amount: testData.amount + BigInt(i),
            blockchainType: testData.blockchainType,
            sender: testData.sender || undefined
          });
          
          // Property: Same seed should produce same transactions
          expect(transaction2).toEqual(generatedTransactions[i]);
          
          // Property: Queries should return consistent results across simulators
          const query1 = simulator.getDummyTransactionByHash(transaction2.hash);
          const query2 = simulator2.getDummyTransactionByHash(transaction2.hash);
          expect(query1).toEqual(query2);
          expect(query1).toEqual(generatedTransactions[i]);
        }

        // Property: Non-existent hash queries should consistently return null
        const nonExistentHashes = [
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        ];
        
        for (const nonExistentHash of nonExistentHashes) {
          // Query multiple times
          for (let i = 0; i < testData.queryCount; i++) {
            const result1 = simulator.getDummyTransactionByHash(nonExistentHash);
            const result2 = simulator2.getDummyTransactionByHash(nonExistentHash);
            
            // Property: Non-existent transactions should consistently return null
            expect(result1).toBeNull();
            expect(result2).toBeNull();
          }
        }

        // Property: Query consistency should be maintained after serialization/deserialization
        const { DummyTransactionStore } = require('../../lib/dummy-transaction-store');
        const store = new DummyTransactionStore();
        
        // Store all transactions
        for (const tx of generatedTransactions) {
          store.store(tx);
        }
        
        // Serialize and deserialize
        const jsonString = store.toJSON();
        const newStore = new DummyTransactionStore();
        newStore.fromJSON(jsonString);
        
        // Property: Queries should be consistent after serialization round trip
        for (const originalTx of generatedTransactions) {
          const retrievedTx = newStore.retrieve(originalTx.hash);
          expect(retrievedTx).toEqual(originalTx);
          
          // Query multiple times to ensure consistency
          for (let i = 0; i < 5; i++) {
            const repeatQuery = newStore.retrieve(originalTx.hash);
            expect(repeatQuery).toEqual(retrievedTx);
            expect(repeatQuery).toEqual(originalTx);
          }
        }

        // Property: Concurrent queries should return consistent results
        // Simulate concurrent access by querying all hashes in rapid succession
        const concurrentResults: any[][] = [];
        for (let round = 0; round < 3; round++) {
          const roundResults: any[] = [];
          for (const hash of transactionHashes) {
            roundResults.push(simulator.getDummyTransactionByHash(hash));
          }
          concurrentResults.push(roundResults);
        }
        
        // Property: All concurrent query rounds should return identical results
        for (let txIndex = 0; txIndex < transactionHashes.length; txIndex++) {
          const expectedResult = generatedTransactions[txIndex];
          for (let round = 0; round < concurrentResults.length; round++) {
            expect(concurrentResults[round][txIndex]).toEqual(expectedResult);
          }
        }

        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Feature: dummy-transaction-mode, Property 10: Error message consistency
   * 
   * Property: For any invalid transaction scenario, the error messages generated 
   * in dummy mode should match the patterns used in real blockchain integration
   * 
   * Validates: Requirements 3.4
   */
  test('Property 10: Error message consistency', () => {
    fc.assert(fc.property(
      fc.record({
        seed: fc.string({ minLength: 1, maxLength: 20 }),
        recipient: fc.oneof(
          // Movement EVM address (20 bytes, 40 hex chars)
          fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          // Aptos address (32 bytes, 64 hex chars)  
          fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`)
        ),
        amount: fc.bigInt({ min: BigInt(1), max: BigInt("1000000000000000000") }),
        blockchainType: fc.constantFrom('movement', 'aptos') as fc.Arbitrary<'movement' | 'aptos'>,
        errorScenario: fc.constantFrom(
          'transaction_not_found',
          'transaction_failed',
          'insufficient_payment',
          'wrong_recipient',
          'invalid_format'
        ),
        sender: fc.option(fc.hexaString({ minLength: 40, maxLength: 64 }).map(s => `0x${s}`))
      }),
      (testData) => {
        const simulator = new TransactionSimulator({ seed: testData.seed });
        const { DummyErrorMessages, ErrorMessageValidator } = require('../../lib/dummy-error-messages');
        
        let errorMessage: string;
        let expectedPattern: RegExp;

        switch (testData.errorScenario) {
          case 'transaction_not_found':
            // Test non-existent transaction hash
            const nonExistentHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
            const notFoundResult = simulator.validateDummyPayment(
              nonExistentHash,
              testData.amount,
              testData.recipient
            );
            
            errorMessage = notFoundResult.reason || '';
            expectedPattern = /Transaction not found/i;
            
            // Property: Error message should match expected pattern
            expect(expectedPattern.test(errorMessage)).toBe(true);
            
            // Property: Error message should be valid format
            expect(ErrorMessageValidator.isValidErrorFormat(errorMessage)).toBe(true);
            break;

          case 'transaction_failed':
            // Generate a transaction with 0% success rate (guaranteed failure)
            const failSimulator = new TransactionSimulator({ 
              seed: testData.seed, 
              successRate: 0.0 
            });
            
            const failedTx = failSimulator.generateDummyTransaction({
              recipient: testData.recipient,
              amount: testData.amount,
              blockchainType: testData.blockchainType,
              sender: testData.sender || undefined
            });
            
            const failedResult = failSimulator.validateDummyPayment(
              failedTx.hash,
              testData.amount,
              testData.recipient
            );
            
            errorMessage = failedResult.reason || '';
            expectedPattern = /Transaction failed on-chain/i;
            
            // Property: Error message should match expected pattern
            expect(expectedPattern.test(errorMessage)).toBe(true);
            
            // Property: Error message should be consistent across formats
            if (testData.blockchainType === 'movement') {
              const movementTx = failedTx as any;
              expect(movementTx.status).toBe('0x0'); // Should be failed
            } else {
              const aptosTx = failedTx as any;
              expect(aptosTx.success).toBe(false); // Should be failed
            }
            
            // Property: Error message should be valid format
            expect(ErrorMessageValidator.isValidErrorFormat(errorMessage)).toBe(true);
            break;

          case 'insufficient_payment':
            // Generate transaction with sufficient amount, then validate with higher requirement
            const sufficientSimulator = new TransactionSimulator({ 
              seed: testData.seed, 
              successRate: 1.0 
            });
            
            const sufficientTx = sufficientSimulator.generateDummyTransaction({
              recipient: testData.recipient,
              amount: testData.amount,
              blockchainType: testData.blockchainType,
              sender: testData.sender || undefined
            });
            
            // Require more than what was sent
            const higherAmount = testData.amount * BigInt(2);
            const insufficientResult = sufficientSimulator.validateDummyPayment(
              sufficientTx.hash,
              higherAmount,
              testData.recipient
            );
            
            errorMessage = insufficientResult.reason || '';
            expectedPattern = /Insufficient payment/i;
            
            // Property: Error message should match expected pattern
            expect(expectedPattern.test(errorMessage)).toBe(true);
            
            // Property: Error message should contain amount information
            expect(ErrorMessageValidator.containsRequiredInfo(errorMessage, ['Sent', 'needed'])).toBe(true);
            
            // Property: Error message should include correct currency for blockchain type
            if (testData.blockchainType === 'aptos') {
              expect(errorMessage.toLowerCase()).toContain('octas');
            }
            
            // Property: Error message should be valid format
            expect(ErrorMessageValidator.isValidErrorFormat(errorMessage)).toBe(true);
            break;

          case 'wrong_recipient':
            // Generate transaction with correct recipient, then validate with wrong recipient
            const correctSimulator = new TransactionSimulator({ 
              seed: testData.seed, 
              successRate: 1.0 
            });
            
            const correctTx = correctSimulator.generateDummyTransaction({
              recipient: testData.recipient,
              amount: testData.amount,
              blockchainType: testData.blockchainType,
              sender: testData.sender || undefined
            });
            
            // Use a different recipient for validation
            const wrongRecipient = testData.blockchainType === 'movement' 
              ? '0x0000000000000000000000000000000000000000'
              : '0x0000000000000000000000000000000000000000000000000000000000000000';
            
            const wrongRecipientResult = correctSimulator.validateDummyPayment(
              correctTx.hash,
              testData.amount,
              wrongRecipient
            );
            
            errorMessage = wrongRecipientResult.reason || '';
            expectedPattern = /Payment sent to wrong wallet/i;
            
            // Property: Error message should match expected pattern
            expect(expectedPattern.test(errorMessage)).toBe(true);
            
            // Property: Error message should be valid format
            expect(ErrorMessageValidator.isValidErrorFormat(errorMessage)).toBe(true);
            break;

          case 'invalid_format':
            // Test with malformed transaction data
            const store = require('../../lib/dummy-transaction-store').dummyTransactionStore;
            const malformedTx = {
              hash: '0x1234567890123456789012345678901234567890123456789012345678901234',
              // Missing required fields for both formats
              invalidField: 'test'
            };
            
            store.store(malformedTx as any);
            
            const formatResult = simulator.validateDummyPayment(
              malformedTx.hash,
              testData.amount,
              testData.recipient
            );
            
            errorMessage = formatResult.reason || '';
            expectedPattern = /Transaction format validation error/i;
            
            // Property: Error message should match expected pattern
            expect(expectedPattern.test(errorMessage)).toBe(true);
            
            // Property: Error message should be valid format
            expect(ErrorMessageValidator.isValidErrorFormat(errorMessage)).toBe(true);
            break;
        }

        // Property: All error messages should be non-empty strings
        expect(typeof errorMessage).toBe('string');
        expect(errorMessage.length).toBeGreaterThan(0);

        // Property: Error messages should not contain sensitive information
        expect(errorMessage.toLowerCase()).not.toContain('password');
        expect(errorMessage.toLowerCase()).not.toContain('private');
        expect(errorMessage.toLowerCase()).not.toContain('secret');

        // Property: Error messages should be user-friendly (no stack traces)
        expect(errorMessage).not.toContain('at Object.');
        expect(errorMessage).not.toContain('node_modules');
        expect(errorMessage).not.toContain('Error:');

        // Property: Error messages should be consistent in capitalization
        expect(/^[A-Z]/.test(errorMessage)).toBe(true);

        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Feature: dummy-transaction-mode, Property 14: Format consistency across generation
   * 
   * Property: For any randomly generated dummy transactions of the same blockchain type, 
   * all transactions should conform to identical format specifications
   * 
   * Validates: Requirements 6.1
   */
  test('Property 14: Format consistency across generation', () => {
    fc.assert(fc.property(
      fc.oneof(
        // Movement test case
        fc.record({
          seed: fc.string({ minLength: 1, maxLength: 20 }),
          blockchainType: fc.constant('movement' as const),
          transactionCount: fc.integer({ min: 2, max: 20 }),
          baseRecipient: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          baseAmount: fc.bigInt({ min: BigInt(1), max: BigInt("1000000000000000000") })
        }),
        // Aptos test case
        fc.record({
          seed: fc.string({ minLength: 1, maxLength: 20 }),
          blockchainType: fc.constant('aptos' as const),
          transactionCount: fc.integer({ min: 2, max: 20 }),
          baseRecipient: fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`),
          baseAmount: fc.bigInt({ min: BigInt(1), max: BigInt("1000000000000000000") })
        })
      ),
      (testData) => {
        const simulator = new TransactionSimulator({ seed: testData.seed });
        const transactions: any[] = [];
        
        // Generate multiple transactions of the same type
        for (let i = 0; i < testData.transactionCount; i++) {
          const transaction = simulator.generateDummyTransaction({
            recipient: testData.baseRecipient,
            amount: testData.baseAmount + BigInt(i), // Vary amount to ensure different transactions
            blockchainType: testData.blockchainType
          });
          transactions.push(transaction);
        }
        
        // Property: All transactions should have the same format structure
        const firstTx = transactions[0];
        const firstTxKeys = Object.keys(firstTx).sort();
        
        for (let i = 1; i < transactions.length; i++) {
          const currentTx = transactions[i];
          const currentTxKeys = Object.keys(currentTx).sort();
          
          // Property: All transactions should have identical key structure
          expect(currentTxKeys).toEqual(firstTxKeys);
          
          // Property: All field types should be consistent
          for (const key of firstTxKeys) {
            expect(typeof currentTx[key]).toBe(typeof firstTx[key]);
          }
        }
        
        if (testData.blockchainType === 'movement') {
          // Property: All Movement transactions should have Movement-specific format
          for (const tx of transactions) {
            // Required Movement fields
            expect(tx).toHaveProperty('hash');
            expect(tx).toHaveProperty('to');
            expect(tx).toHaveProperty('from');
            expect(tx).toHaveProperty('value');
            expect(tx).toHaveProperty('gas');
            expect(tx).toHaveProperty('gasPrice');
            expect(tx).toHaveProperty('nonce');
            expect(tx).toHaveProperty('blockNumber');
            expect(tx).toHaveProperty('blockHash');
            expect(tx).toHaveProperty('transactionIndex');
            expect(tx).toHaveProperty('status');
            
            // Should not have Aptos-specific fields
            expect(tx).not.toHaveProperty('sender');
            expect(tx).not.toHaveProperty('payload');
            expect(tx).not.toHaveProperty('success');
            expect(tx).not.toHaveProperty('sequence_number');
            
            // Property: Hash format consistency
            expect(tx.hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
            
            // Property: Address format consistency
            expect(tx.to).toMatch(/^0x[0-9a-fA-F]{40}$/);
            expect(tx.from).toMatch(/^0x[0-9a-fA-F]{40}$/);
            
            // Property: Hex value format consistency
            expect(tx.value).toMatch(/^0x[0-9a-fA-F]+$/);
            expect(tx.gas).toMatch(/^0x[0-9a-fA-F]+$/);
            expect(tx.gasPrice).toMatch(/^0x[0-9a-fA-F]+$/);
            expect(tx.nonce).toMatch(/^0x[0-9a-fA-F]+$/);
            expect(tx.blockNumber).toMatch(/^0x[0-9a-fA-F]+$/);
            expect(tx.blockHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
            expect(tx.transactionIndex).toMatch(/^0x[0-9a-fA-F]+$/);
            
            // Property: Status format consistency
            expect(['0x1', '0x0']).toContain(tx.status);
          }
        } else {
          // Property: All Aptos transactions should have Aptos-specific format
          for (const tx of transactions) {
            // Required Aptos fields
            expect(tx).toHaveProperty('hash');
            expect(tx).toHaveProperty('sender');
            expect(tx).toHaveProperty('sequence_number');
            expect(tx).toHaveProperty('success');
            expect(tx).toHaveProperty('payload');
            expect(tx).toHaveProperty('timestamp');
            expect(tx).toHaveProperty('version');
            expect(tx).toHaveProperty('max_gas_amount');
            expect(tx).toHaveProperty('gas_unit_price');
            expect(tx).toHaveProperty('gas_used');
            expect(tx).toHaveProperty('vm_status');
            
            // Should not have Movement-specific fields
            expect(tx).not.toHaveProperty('to');
            expect(tx).not.toHaveProperty('from');
            expect(tx).not.toHaveProperty('value');
            expect(tx).not.toHaveProperty('gas');
            expect(tx).not.toHaveProperty('gasPrice');
            expect(tx).not.toHaveProperty('status');
            
            // Property: Hash format consistency
            expect(tx.hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
            
            // Property: Address format consistency
            expect(tx.sender).toMatch(/^0x[0-9a-fA-F]{64}$/);
            
            // Property: Numeric string format consistency
            expect(tx.sequence_number).toMatch(/^\d+$/);
            expect(tx.timestamp).toMatch(/^\d+$/);
            expect(tx.version).toMatch(/^\d+$/);
            expect(tx.max_gas_amount).toMatch(/^\d+$/);
            expect(tx.gas_unit_price).toMatch(/^\d+$/);
            expect(tx.gas_used).toMatch(/^\d+$/);
            
            // Property: Boolean format consistency
            expect(typeof tx.success).toBe('boolean');
            
            // Property: Payload format consistency
            expect(tx.payload.type).toBe('entry_function_payload');
            expect(tx.payload.function).toBe('0x1::coin::transfer');
            expect(Array.isArray(tx.payload.arguments)).toBe(true);
            expect(tx.payload.arguments).toHaveLength(2);
            expect(Array.isArray(tx.payload.type_arguments)).toBe(true);
            expect(tx.payload.type_arguments).toEqual(['0x1::aptos_coin::AptosCoin']);
            
            // Property: VM status format consistency
            expect(typeof tx.vm_status).toBe('string');
            expect(tx.vm_status.length).toBeGreaterThan(0);
          }
        }
        
        // Property: All hashes should be unique
        const hashes = transactions.map(tx => tx.hash);
        const uniqueHashes = new Set(hashes);
        expect(uniqueHashes.size).toBe(hashes.length);
        
        // Property: All transactions should be deterministic with same seed
        const simulator2 = new TransactionSimulator({ seed: testData.seed });
        for (let i = 0; i < testData.transactionCount; i++) {
          const repeatTx = simulator2.generateDummyTransaction({
            recipient: testData.baseRecipient,
            amount: testData.baseAmount + BigInt(i),
            blockchainType: testData.blockchainType
          });
          
          // Should produce identical transaction
          expect(repeatTx).toEqual(transactions[i]);
        }
        
        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Feature: dummy-transaction-mode, Property 13: Valid payment acceptance
   * 
   * Property: For any dummy transaction with correct recipient and sufficient amount, 
   * the payment verification should always succeed
   * 
   * Validates: Requirements 6.3
   */
  test('Property 13: Valid payment acceptance', () => {
    fc.assert(fc.property(
      fc.record({
        seed: fc.string({ minLength: 1, maxLength: 20 }),
        recipient: fc.oneof(
          // Movement EVM address (20 bytes, 40 hex chars)
          fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          // Aptos address (32 bytes, 64 hex chars)  
          fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`)
        ),
        amount: fc.bigInt({ min: BigInt(1), max: BigInt("1000000000000000000") }),
        blockchainType: fc.constantFrom('movement', 'aptos') as fc.Arbitrary<'movement' | 'aptos'>,
        sender: fc.option(fc.hexaString({ minLength: 40, maxLength: 64 }).map(s => `0x${s}`)),
        extraAmount: fc.bigInt({ min: BigInt(0), max: BigInt("1000000000000000000") }) // Additional amount to ensure sufficiency
      }),
      (testData) => {
        // Create simulator with 100% success rate to ensure transactions succeed on-chain
        const simulator = new TransactionSimulator({ 
          seed: testData.seed,
          successRate: 1.0 
        });
        
        // Generate transaction with sufficient amount
        const totalAmount = testData.amount + testData.extraAmount;
        const transaction = simulator.generateDummyTransaction({
          recipient: testData.recipient,
          amount: totalAmount,
          blockchainType: testData.blockchainType,
          sender: testData.sender || undefined
        });
        
        // Property: Transaction should be generated successfully
        expect(transaction).toBeDefined();
        expect(transaction.hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
        
        // Property: Transaction should succeed on-chain (due to 100% success rate)
        if (testData.blockchainType === 'movement') {
          const moveTx = transaction as any;
          expect(moveTx.status).toBe('0x1');
        } else {
          const aptosTx = transaction as any;
          expect(aptosTx.success).toBe(true);
        }
        
        // Property: Validation with exact amount should succeed
        const exactValidation = simulator.validateDummyPayment(
          transaction.hash,
          totalAmount,
          testData.recipient
        );
        
        expect(exactValidation.valid).toBe(true);
        expect(exactValidation.reason).toBeUndefined();
        expect(exactValidation.transaction).toEqual(transaction);
        
        // Property: Validation with less than sent amount should succeed
        if (testData.extraAmount > BigInt(0)) {
          const lesserValidation = simulator.validateDummyPayment(
            transaction.hash,
            testData.amount, // Less than totalAmount
            testData.recipient
          );
          
          expect(lesserValidation.valid).toBe(true);
          expect(lesserValidation.reason).toBeUndefined();
          expect(lesserValidation.transaction).toEqual(transaction);
        }
        
        // Property: Validation with minimum amount (1) should succeed
        const minValidation = simulator.validateDummyPayment(
          transaction.hash,
          BigInt(1),
          testData.recipient
        );
        
        expect(minValidation.valid).toBe(true);
        expect(minValidation.reason).toBeUndefined();
        expect(minValidation.transaction).toEqual(transaction);
        
        // Property: Multiple validations should be consistent
        const validation1 = simulator.validateDummyPayment(
          transaction.hash,
          testData.amount,
          testData.recipient
        );
        const validation2 = simulator.validateDummyPayment(
          transaction.hash,
          testData.amount,
          testData.recipient
        );
        
        expect(validation1).toEqual(validation2);
        expect(validation1.valid).toBe(true);
        expect(validation2.valid).toBe(true);
        
        // Property: Case-insensitive recipient matching should work
        const upperCaseRecipient = testData.recipient.toUpperCase();
        const lowerCaseRecipient = testData.recipient.toLowerCase();
        
        const upperValidation = simulator.validateDummyPayment(
          transaction.hash,
          testData.amount,
          upperCaseRecipient
        );
        const lowerValidation = simulator.validateDummyPayment(
          transaction.hash,
          testData.amount,
          lowerCaseRecipient
        );
        
        expect(upperValidation.valid).toBe(true);
        expect(lowerValidation.valid).toBe(true);
        
        // Property: Transaction should be retrievable by hash
        const retrievedTx = simulator.getDummyTransactionByHash(transaction.hash);
        expect(retrievedTx).toEqual(transaction);
        
        // Property: Validation should work across different simulator instances with same seed
        const simulator2 = new TransactionSimulator({ 
          seed: testData.seed,
          successRate: 1.0 
        });
        
        // Generate the same transaction with second simulator
        const transaction2 = simulator2.generateDummyTransaction({
          recipient: testData.recipient,
          amount: totalAmount,
          blockchainType: testData.blockchainType,
          sender: testData.sender || undefined
        });
        
        // Should be identical due to same seed
        expect(transaction2).toEqual(transaction);
        
        // Validation should work on second simulator
        const crossValidation = simulator2.validateDummyPayment(
          transaction2.hash,
          testData.amount,
          testData.recipient
        );
        
        expect(crossValidation.valid).toBe(true);
        expect(crossValidation.transaction).toEqual(transaction);
        
        return true;
      }
    ), { numRuns: 100 });
  });
});