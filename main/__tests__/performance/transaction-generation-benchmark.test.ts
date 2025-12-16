/**
 * Performance benchmarks for dummy transaction generation
 * Tests transaction generation speed and memory usage
 * _Requirements: 1.5, 5.1, 5.3_
 */

import { TransactionSimulator } from '../../lib/transaction-simulator';
import { DummyTransactionStore } from '../../lib/dummy-transaction-store';

describe('Transaction Generation Performance Benchmarks', () => {
  
  /**
   * Benchmark: Transaction generation speed
   * Measures how many transactions can be generated per second
   */
  test('should generate transactions at consistent speed', () => {
    const simulator = new TransactionSimulator({ seed: 'benchmark-seed', successRate: 0.9 });
    const transactionCounts = [10, 50, 100, 500, 1000];
    const results: { count: number; timeMs: number; perSecond: number }[] = [];

    for (const count of transactionCounts) {
      const startTime = performance.now();

      for (let i = 0; i < count; i++) {
        simulator.generateDummyTransaction({
          recipient: '0x1234567890123456789012345678901234567890',
          amount: BigInt(1000000 + i),
          blockchainType: 'movement'
        });
      }

      const endTime = performance.now();
      const timeMs = endTime - startTime;
      const perSecond = (count / timeMs) * 1000;

      results.push({ count, timeMs, perSecond });
      console.log(`Generated ${count} transactions in ${timeMs.toFixed(2)}ms (${perSecond.toFixed(0)} tx/sec)`);
    }

    // Verify performance is reasonable (at least 100 tx/sec)
    const avgPerSecond = results.reduce((sum, r) => sum + r.perSecond, 0) / results.length;
    expect(avgPerSecond).toBeGreaterThan(100);
  });

  /**
   * Benchmark: Multi-format transaction generation
   * Measures performance when generating both Movement and Aptos transactions
   */
  test('should generate multi-format transactions efficiently', () => {
    const simulator = new TransactionSimulator({ seed: 'multi-format-benchmark', successRate: 0.9 });
    const iterations = 100;

    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      // Generate Movement transaction
      simulator.generateDummyTransaction({
        recipient: '0x1111111111111111111111111111111111111111',
        amount: BigInt(1000000 + i),
        blockchainType: 'movement'
      });

      // Generate Aptos transaction
      simulator.generateDummyTransaction({
        recipient: '0x2222222222222222222222222222222222222222222222222222222222222222',
        amount: BigInt(1000000 + i),
        blockchainType: 'aptos'
      });
    }

    const endTime = performance.now();
    const timeMs = endTime - startTime;
    const totalTx = iterations * 2;
    const perSecond = (totalTx / timeMs) * 1000;

    console.log(`Generated ${totalTx} multi-format transactions in ${timeMs.toFixed(2)}ms (${perSecond.toFixed(0)} tx/sec)`);

    // Verify performance is reasonable
    expect(perSecond).toBeGreaterThan(100);
  });

  /**
   * Benchmark: Transaction storage and retrieval
   * Measures performance of storing and retrieving transactions
   */
  test('should store and retrieve transactions efficiently', () => {
    const store = new DummyTransactionStore();
    const simulator = new TransactionSimulator({ seed: 'storage-benchmark', successRate: 0.9 });
    const transactionCount = 1000;

    // Generate and store transactions
    const storeStartTime = performance.now();
    const hashes: string[] = [];

    for (let i = 0; i < transactionCount; i++) {
      const tx = simulator.generateDummyTransaction({
        recipient: '0x1234567890123456789012345678901234567890',
        amount: BigInt(1000000 + i),
        blockchainType: 'movement'
      });
      store.store(tx);
      hashes.push(tx.hash);
    }

    const storeEndTime = performance.now();
    const storeTimeMs = storeEndTime - storeStartTime;

    // Retrieve transactions
    const retrieveStartTime = performance.now();

    for (const hash of hashes) {
      store.retrieve(hash);
    }

    const retrieveEndTime = performance.now();
    const retrieveTimeMs = retrieveEndTime - retrieveStartTime;

    console.log(`Stored ${transactionCount} transactions in ${storeTimeMs.toFixed(2)}ms`);
    console.log(`Retrieved ${transactionCount} transactions in ${retrieveTimeMs.toFixed(2)}ms`);

    // Verify performance is reasonable
    const storePerSecond = (transactionCount / storeTimeMs) * 1000;
    const retrievePerSecond = (transactionCount / retrieveTimeMs) * 1000;

    expect(storePerSecond).toBeGreaterThan(100);
    expect(retrievePerSecond).toBeGreaterThan(1000); // Retrieval should be very fast
  });

  /**
   * Benchmark: Validation performance
   * Measures how fast payment validation can be performed
   */
  test('should validate payments efficiently', () => {
    const simulator = new TransactionSimulator({ seed: 'validation-benchmark', successRate: 0.9 });
    const validationCount = 1000;
    const transactions = [];

    // Generate transactions
    for (let i = 0; i < validationCount; i++) {
      const tx = simulator.generateDummyTransaction({
        recipient: '0x1234567890123456789012345678901234567890',
        amount: BigInt(1000000 + i),
        blockchainType: 'movement'
      });
      transactions.push(tx);
    }

    // Validate transactions
    const startTime = performance.now();

    for (const tx of transactions) {
      simulator.validateDummyPayment(
        tx.hash,
        BigInt(1000000),
        '0x1234567890123456789012345678901234567890'
      );
    }

    const endTime = performance.now();
    const timeMs = endTime - startTime;
    const perSecond = (validationCount / timeMs) * 1000;

    console.log(`Validated ${validationCount} payments in ${timeMs.toFixed(2)}ms (${perSecond.toFixed(0)} validations/sec)`);

    // Verify performance is reasonable
    expect(perSecond).toBeGreaterThan(1000);
  });

  /**
   * Benchmark: Serialization performance
   * Measures JSON serialization and deserialization speed
   */
  test('should serialize and deserialize transactions efficiently', () => {
    const store = new DummyTransactionStore();
    const simulator = new TransactionSimulator({ seed: 'serialization-benchmark', successRate: 0.9 });
    const transactionCount = 500;

    // Generate and store transactions
    for (let i = 0; i < transactionCount; i++) {
      const tx = simulator.generateDummyTransaction({
        recipient: '0x1234567890123456789012345678901234567890',
        amount: BigInt(1000000 + i),
        blockchainType: 'movement'
      });
      store.store(tx);
    }

    // Serialize
    const serializeStartTime = performance.now();
    const jsonData = store.toJSON();
    const serializeEndTime = performance.now();
    const serializeTimeMs = serializeEndTime - serializeStartTime;

    // Deserialize
    const deserializeStartTime = performance.now();
    const newStore = new DummyTransactionStore();
    newStore.fromJSON(jsonData);
    const deserializeEndTime = performance.now();
    const deserializeTimeMs = deserializeEndTime - deserializeStartTime;

    console.log(`Serialized ${transactionCount} transactions in ${serializeTimeMs.toFixed(2)}ms`);
    console.log(`Deserialized ${transactionCount} transactions in ${deserializeTimeMs.toFixed(2)}ms`);
    console.log(`JSON size: ${(jsonData.length / 1024).toFixed(2)} KB`);

    // Verify performance is reasonable
    const serializePerSecond = (transactionCount / serializeTimeMs) * 1000;
    const deserializePerSecond = (transactionCount / deserializeTimeMs) * 1000;

    expect(serializePerSecond).toBeGreaterThan(100);
    expect(deserializePerSecond).toBeGreaterThan(100);
  });

  /**
   * Benchmark: Memory usage with large datasets
   * Measures memory consumption when storing many transactions
   */
  test('should handle large transaction datasets with reasonable memory', () => {
    const store = new DummyTransactionStore();
    const simulator = new TransactionSimulator({ seed: 'memory-benchmark', successRate: 0.9 });
    const transactionCount = 5000;

    // Get initial memory usage
    if (global.gc) {
      global.gc();
    }
    const initialMemory = process.memoryUsage().heapUsed;

    // Generate and store transactions
    for (let i = 0; i < transactionCount; i++) {
      const tx = simulator.generateDummyTransaction({
        recipient: '0x1234567890123456789012345678901234567890',
        amount: BigInt(1000000 + i),
        blockchainType: 'movement'
      });
      store.store(tx);
    }

    // Get final memory usage
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryUsedMB = (finalMemory - initialMemory) / 1024 / 1024;
    const memoryPerTransaction = (finalMemory - initialMemory) / transactionCount;

    console.log(`Stored ${transactionCount} transactions using ${memoryUsedMB.toFixed(2)} MB`);
    console.log(`Memory per transaction: ${memoryPerTransaction.toFixed(0)} bytes`);

    // Verify memory usage is reasonable (less than 50 MB for 5000 transactions)
    expect(memoryUsedMB).toBeLessThan(50);
  });

  /**
   * Benchmark: Concurrent access patterns
   * Measures performance under concurrent read/write scenarios
   */
  test('should handle concurrent access patterns efficiently', () => {
    const store = new DummyTransactionStore();
    const simulator = new TransactionSimulator({ seed: 'concurrent-benchmark', successRate: 0.9 });
    const operationCount = 1000;

    // Pre-populate store
    const hashes: string[] = [];
    for (let i = 0; i < 100; i++) {
      const tx = simulator.generateDummyTransaction({
        recipient: '0x1234567890123456789012345678901234567890',
        amount: BigInt(1000000 + i),
        blockchainType: 'movement'
      });
      store.store(tx);
      hashes.push(tx.hash);
    }

    // Simulate concurrent operations
    const startTime = performance.now();

    for (let i = 0; i < operationCount; i++) {
      const operation = i % 3;

      switch (operation) {
        case 0:
          // Write operation
          const newTx = simulator.generateDummyTransaction({
            recipient: '0x1234567890123456789012345678901234567890',
            amount: BigInt(2000000 + i),
            blockchainType: 'movement'
          });
          store.store(newTx);
          hashes.push(newTx.hash);
          break;

        case 1:
          // Read operation
          if (hashes.length > 0) {
            const randomHash = hashes[Math.floor(Math.random() * hashes.length)];
            store.retrieve(randomHash);
          }
          break;

        case 2:
          // Mark as used
          if (hashes.length > 0) {
            const randomHash = hashes[Math.floor(Math.random() * hashes.length)];
            store.markAsUsed(randomHash);
          }
          break;
      }
    }

    const endTime = performance.now();
    const timeMs = endTime - startTime;
    const operationsPerSecond = (operationCount / timeMs) * 1000;

    console.log(`Completed ${operationCount} concurrent operations in ${timeMs.toFixed(2)}ms (${operationsPerSecond.toFixed(0)} ops/sec)`);

    // Verify performance is reasonable
    expect(operationsPerSecond).toBeGreaterThan(1000);
  });

  /**
   * Benchmark: Configuration changes
   * Measures performance impact of changing configuration
   */
  test('should handle configuration changes efficiently', () => {
    const simulator = new TransactionSimulator({ seed: 'config-benchmark', successRate: 0.9 });
    const configChanges = 100;

    const startTime = performance.now();

    for (let i = 0; i < configChanges; i++) {
      // Change success rate
      simulator.setSuccessRate(0.5 + (i % 50) / 100);

      // Generate transaction with new config
      simulator.generateDummyTransaction({
        recipient: '0x1234567890123456789012345678901234567890',
        amount: BigInt(1000000 + i),
        blockchainType: 'movement'
      });
    }

    const endTime = performance.now();
    const timeMs = endTime - startTime;

    console.log(`Completed ${configChanges} configuration changes in ${timeMs.toFixed(2)}ms`);

    // Verify performance is reasonable
    expect(timeMs).toBeLessThan(1000); // Should complete in less than 1 second
  });
});
