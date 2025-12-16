/**
 * Test generators for random transaction data using fast-check
 * Provides reusable generators for property-based testing
 */

import fc from 'fast-check';
import type { TransactionParams, DummyModeConfig } from '../../types/dummy-transactions';

/**
 * Generator for valid Ethereum-style addresses (40 hex characters)
 */
export const movementAddressGenerator = fc.hexaString({ minLength: 40, maxLength: 40 })
  .map(s => `0x${s.toLowerCase()}`);

/**
 * Generator for valid Aptos-style addresses (64 hex characters)
 */
export const aptosAddressGenerator = fc.hexaString({ minLength: 64, maxLength: 64 })
  .map(s => `0x${s.toLowerCase()}`);

/**
 * Generator for any valid blockchain address (Movement or Aptos)
 */
export const anyAddressGenerator = fc.oneof(
  movementAddressGenerator,
  aptosAddressGenerator
);

/**
 * Generator for transaction amounts in Wei/Octas
 */
export const transactionAmountGenerator = fc.bigInt({ 
  min: BigInt(1), 
  max: BigInt("10000000000000000000") // 10 ETH/APT
});

/**
 * Generator for small transaction amounts (for testing edge cases)
 */
export const smallAmountGenerator = fc.bigInt({ 
  min: BigInt(1), 
  max: BigInt(1000000) 
});

/**
 * Generator for large transaction amounts (for testing limits)
 */
export const largeAmountGenerator = fc.bigInt({ 
  min: BigInt("1000000000000000000"), // 1 ETH/APT
  max: BigInt("1000000000000000000000") // 1000 ETH/APT
});

/**
 * Generator for blockchain types
 */
export const blockchainTypeGenerator = fc.constantFrom('movement', 'aptos') as fc.Arbitrary<'movement' | 'aptos'>;

/**
 * Generator for transaction seeds (for deterministic testing)
 */
export const seedGenerator = fc.string({ minLength: 1, maxLength: 50 });

/**
 * Generator for success rates (0.0 to 1.0)
 */
export const successRateGenerator = fc.float({ min: 0.0, max: 1.0, noNaN: true });

/**
 * Generator for transaction hashes (64 hex characters)
 */
export const transactionHashGenerator = fc.hexaString({ minLength: 64, maxLength: 64 })
  .map(s => `0x${s.toLowerCase()}`);

/**
 * Generator for valid transaction parameters
 */
export const transactionParamsGenerator = fc.record({
  recipient: anyAddressGenerator,
  amount: transactionAmountGenerator,
  sender: fc.option(anyAddressGenerator),
  blockchainType: blockchainTypeGenerator
}) as fc.Arbitrary<TransactionParams>;

/**
 * Generator for Movement-specific transaction parameters
 */
export const movementTransactionParamsGenerator = fc.record({
  recipient: movementAddressGenerator,
  amount: transactionAmountGenerator,
  sender: fc.option(movementAddressGenerator),
  blockchainType: fc.constant('movement' as const)
}) as fc.Arbitrary<TransactionParams>;

/**
 * Generator for Aptos-specific transaction parameters
 */
export const aptosTransactionParamsGenerator = fc.record({
  recipient: aptosAddressGenerator,
  amount: transactionAmountGenerator,
  sender: fc.option(aptosAddressGenerator),
  blockchainType: fc.constant('aptos' as const)
}) as fc.Arbitrary<TransactionParams>;

/**
 * Generator for dummy mode configuration
 */
export const dummyModeConfigGenerator = fc.record({
  enabled: fc.boolean(),
  seed: fc.option(seedGenerator),
  successRate: successRateGenerator,
  defaultWallet: movementAddressGenerator,
  defaultAmount: transactionAmountGenerator.map(amount => amount.toString())
}) as fc.Arbitrary<DummyModeConfig>;

/**
 * Generator for invalid addresses (for testing error cases)
 */
export const invalidAddressGenerator = fc.oneof(
  fc.constant(''), // Empty string
  fc.constant('0x'), // Just prefix
  fc.string({ minLength: 1, maxLength: 10 }), // Too short
  fc.string({ minLength: 100, maxLength: 200 }), // Too long
  fc.constant('invalid-address'), // Invalid format
  fc.hexaString({ minLength: 39, maxLength: 39 }).map(s => `0x${s}`), // Almost valid Movement
  fc.hexaString({ minLength: 63, maxLength: 63 }).map(s => `0x${s}`) // Almost valid Aptos
);

/**
 * Generator for invalid amounts (for testing error cases)
 */
export const invalidAmountGenerator = fc.oneof(
  fc.constant(BigInt(0)), // Zero amount
  fc.bigInt({ min: BigInt(-1000), max: BigInt(-1) }) // Negative amounts
);

/**
 * Generator for test scenarios with multiple transactions
 */
export const multiTransactionScenarioGenerator = fc.record({
  seed: seedGenerator,
  transactionCount: fc.integer({ min: 1, max: 20 }),
  movementParams: fc.option(movementTransactionParamsGenerator),
  aptosParams: fc.option(aptosTransactionParamsGenerator),
  successRate: successRateGenerator
});

/**
 * Generator for validation test scenarios
 */
export const validationScenarioGenerator = fc.record({
  transaction: transactionParamsGenerator,
  expectedAmount: transactionAmountGenerator,
  expectedRecipient: anyAddressGenerator,
  shouldSucceed: fc.boolean(),
  seed: seedGenerator
});

/**
 * Generator for error test scenarios
 */
export const errorScenarioGenerator = fc.record({
  errorType: fc.constantFrom(
    'transaction_not_found',
    'transaction_failed', 
    'insufficient_payment',
    'wrong_recipient',
    'invalid_format',
    'network_error',
    'configuration_error'
  ),
  transaction: transactionParamsGenerator,
  seed: seedGenerator
});

/**
 * Generator for serialization test data
 */
export const serializationTestGenerator = fc.record({
  transactions: fc.array(transactionParamsGenerator, { minLength: 1, maxLength: 10 }),
  usedHashes: fc.array(transactionHashGenerator, { minLength: 0, maxLength: 5 }),
  seed: seedGenerator
});

/**
 * Generator for concurrent access scenarios
 */
export const concurrentAccessGenerator = fc.record({
  operationCount: fc.integer({ min: 2, max: 50 }),
  transactionCount: fc.integer({ min: 1, max: 20 }),
  seed: seedGenerator,
  operations: fc.array(
    fc.constantFrom('generate', 'validate', 'retrieve', 'store'),
    { minLength: 5, maxLength: 20 }
  )
});

/**
 * Helper function to create deterministic generators
 */
export function createDeterministicGenerator<T>(
  generator: fc.Arbitrary<T>,
  seed: number
): fc.Arbitrary<T> {
  return generator.noShrink().noBias();
}

/**
 * Helper function to generate test data with specific constraints
 */
export function generateConstrainedTestData<T>(
  generator: fc.Arbitrary<T>,
  constraints: {
    seed?: string;
    numRuns?: number;
    maxSkips?: number;
  } = {}
): T[] {
  const results: T[] = [];
  const numRuns = constraints.numRuns || 10;
  
  for (let i = 0; i < numRuns; i++) {
    const sample = fc.sample(generator, 1)[0];
    results.push(sample);
  }
  
  return results;
}

/**
 * Predefined test data sets for common scenarios
 */
export const TestDataSets = {
  // Common valid addresses
  validAddresses: [
    '0x1234567890123456789012345678901234567890', // Movement
    '0x1234567890123456789012345678901234567890123456789012345678901234', // Aptos
    '0x0000000000000000000000000000000000000000', // Zero address (Movement)
    '0x0000000000000000000000000000000000000000000000000000000000000000' // Zero address (Aptos)
  ],
  
  // Common invalid addresses
  invalidAddresses: [
    '', // Empty
    '0x', // Just prefix
    'invalid', // No prefix
    '0x123', // Too short
    '0xgg1234567890123456789012345678901234567890' // Invalid hex
  ],
  
  // Common amounts
  commonAmounts: [
    BigInt(1), // Minimum
    BigInt(1000000), // 1 million wei/octas
    BigInt('1000000000000000000'), // 1 ETH/APT
    BigInt('10000000000000000000') // 10 ETH/APT
  ],
  
  // Common seeds
  testSeeds: [
    'test-seed-1',
    'deterministic-seed',
    'property-test-seed',
    'integration-test-seed'
  ]
};