/**
 * Integration tests for multi-format transaction support
 */

import { TransactionSimulator } from '../../lib/transaction-simulator';
import { generateMultiFormatDummyPayments, verifyPayment } from '../../lib/dummy-payment-verification';
import type { DummyMovementTransaction, DummyAptosTransaction } from '../../types/dummy-transactions';

describe('Multi-Format Transaction Support Integration', () => {
  let simulator: TransactionSimulator;

  beforeEach(() => {
    simulator = new TransactionSimulator({ seed: 'test-seed', successRate: 1.0 });
  });

  test('should generate and validate Movement EVM transactions', async () => {
    const movementRecipient = '0x1234567890123456789012345678901234567890';
    const amount = BigInt('1000000000000000000'); // 1 ETH in Wei

    // Generate Movement transaction
    const transaction = simulator.generateDummyTransaction({
      recipient: movementRecipient,
      amount,
      blockchainType: 'movement'
    }) as DummyMovementTransaction;

    // Verify transaction structure
    expect(transaction.hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(transaction.to).toBe(movementRecipient.toLowerCase());
    expect(BigInt(transaction.value)).toBe(amount);
    expect(transaction.status).toBe('0x1'); // Success due to 100% success rate

    // Validate payment
    const validation = simulator.validateDummyPayment(
      transaction.hash,
      amount,
      movementRecipient
    );

    expect(validation.valid).toBe(true);
    expect(validation.transaction).toEqual(transaction);
  });

  test('should generate and validate Aptos transactions', async () => {
    const aptosRecipient = '0x1234567890123456789012345678901234567890123456789012345678901234';
    const amount = BigInt('1000000000'); // 1 APT in Octas

    // Generate Aptos transaction
    const transaction = simulator.generateDummyTransaction({
      recipient: aptosRecipient,
      amount,
      blockchainType: 'aptos'
    }) as DummyAptosTransaction;

    // Verify transaction structure
    expect(transaction.hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(transaction.payload.arguments[0]).toBe(aptosRecipient);
    expect(BigInt(transaction.payload.arguments[1])).toBe(amount);
    expect(transaction.success).toBe(true); // Success due to 100% success rate

    // Validate payment
    const validation = simulator.validateDummyPayment(
      transaction.hash,
      amount,
      aptosRecipient
    );

    expect(validation.valid).toBe(true);
    expect(validation.transaction).toEqual(transaction);
  });

  test('should handle both formats simultaneously', async () => {
    const movementRecipient = '0x1111111111111111111111111111111111111111';
    const aptosRecipient = '0x2222222222222222222222222222222222222222222222222222222222222222';
    const amount = BigInt('500000000000000000'); // 0.5 ETH/APT

    // Generate multiple transactions of both formats
    const transactions = simulator.generateMultiFormatTransactions({
      movementParams: { recipient: movementRecipient, amount },
      aptosParams: { recipient: aptosRecipient, amount },
      count: 3
    });

    // Verify we got the right number of each type
    expect(transactions.movement).toHaveLength(3);
    expect(transactions.aptos).toHaveLength(3);

    // Verify all Movement transactions
    for (let i = 0; i < transactions.movement.length; i++) {
      const tx = transactions.movement[i];
      expect(tx.to).toBe(movementRecipient.toLowerCase());
      expect(BigInt(tx.value)).toBe(amount + BigInt(i));
      expect('status' in tx).toBe(true);
      expect('payload' in tx).toBe(false);
    }

    // Verify all Aptos transactions
    for (let i = 0; i < transactions.aptos.length; i++) {
      const tx = transactions.aptos[i];
      expect(tx.payload.arguments[0]).toBe(aptosRecipient);
      expect(BigInt(tx.payload.arguments[1])).toBe(amount + BigInt(i));
      expect('success' in tx).toBe(true);
      expect('status' in tx).toBe(false);
    }

    // Verify all transactions can be retrieved and validated
    const allTransactions = [...transactions.movement, ...transactions.aptos];
    for (const tx of allTransactions) {
      const retrieved = simulator.getDummyTransactionByHash(tx.hash);
      expect(retrieved).toEqual(tx);
    }
  });

  test('should provide transaction statistics by format', () => {
    // Generate some transactions of both formats
    simulator.generateMultiFormatTransactions({
      movementParams: { 
        recipient: '0x1111111111111111111111111111111111111111', 
        amount: BigInt('1000000000000000000') 
      },
      aptosParams: { 
        recipient: '0x2222222222222222222222222222222222222222222222222222222222222222', 
        amount: BigInt('1000000000') 
      },
      count: 5
    });

    const stats = simulator.getTransactionStatistics();
    
    expect(stats.total).toBeGreaterThanOrEqual(10); // At least 10 transactions
    expect(stats.movement).toBeGreaterThanOrEqual(5); // At least 5 Movement transactions
    expect(stats.aptos).toBeGreaterThanOrEqual(5); // At least 5 Aptos transactions
    expect(stats.successful).toBeGreaterThanOrEqual(10); // All should be successful with 100% rate
    expect(stats.failed).toBe(0); // None should fail with 100% success rate
  });

  test('should handle format detection errors gracefully', () => {
    // Create a malformed transaction object
    const malformedTransaction = {
      hash: '0x1234567890123456789012345678901234567890123456789012345678901234',
      // Missing required fields for both formats
    };

    // Store the malformed transaction directly
    const store = require('../../lib/dummy-transaction-store').dummyTransactionStore;
    store.store(malformedTransaction as any);

    // Validation should handle the error gracefully
    const validation = simulator.validateDummyPayment(
      malformedTransaction.hash,
      BigInt('1000000000000000000'),
      '0x1111111111111111111111111111111111111111'
    );

    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('Transaction format validation error');
  });

  test('should work with the payment verification API', async () => {
    // Set the global simulator to have 100% success rate for this test
    const { transactionSimulator } = require('../../lib/transaction-simulator');
    transactionSimulator.setSuccessRate(1.0);
    
    // Generate multi-format payments using the API
    const hashes = generateMultiFormatDummyPayments(
      '0x1234567890123456789012345678901234567890',
      BigInt('1000000000000000000'),
      2
    );

    expect(hashes.movement).toHaveLength(2);
    expect(hashes.aptos).toHaveLength(2);

    // All hashes should be valid
    for (const hash of [...hashes.movement, ...hashes.aptos]) {
      expect(hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
      
      // Should be able to verify through the API
      const result = await verifyPayment(hash);
      expect(result.valid).toBe(true);
    }
    
    // Reset success rate to default
    transactionSimulator.setSuccessRate(0.9);
  });
});