const fc = require('fast-check');
const { fetchTransactionByHash, PaymentVerifier } = require('./access-server');

// Mock the Aptos SDK to avoid actual network calls during testing
jest.mock('@aptos-labs/ts-sdk', () => {
  const mockAptos = {
    getTransactionByHash: jest.fn(),
    getLedgerInfo: jest.fn()
  };
  
  return {
    Aptos: jest.fn(() => mockAptos),
    AptosConfig: jest.fn(),
    Network: { MAINNET: 'mainnet' },
    __mockAptos: mockAptos // Expose for testing
  };
});

const { __mockAptos } = require('@aptos-labs/ts-sdk');

describe('Property Tests: Aptos SDK Integration', () => {
  let paymentVerifier;
  
  beforeEach(() => {
    paymentVerifier = new PaymentVerifier();
    jest.clearAllMocks();
    
    // Default mock setup
    __mockAptos.getTransactionByHash.mockResolvedValue({
      success: true,
      events: []
    });
  });
  
  /**
   * Property 8: Aptos SDK Integration
   * For any transaction hash provided, the Payment Verifier should use the @aptos-labs/ts-sdk 
   * fetchTransaction method with the correct transactionHash parameter
   * Validates: Requirements 2.1
   */
  
  describe('Property 8: Aptos SDK Integration', () => {
    test('should call Aptos SDK with correct transaction hash parameter', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }).filter(s => /^[0-9a-fA-F]{64}$/.test(s)),
        async (txHash) => {
          // Reset mock for each iteration
          __mockAptos.getTransactionByHash.mockClear();
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: []
          });
          
          // Test with hash that may or may not have 0x prefix
          const hasPrefix = Math.random() > 0.5;
          const testHash = hasPrefix ? `0x${txHash}` : txHash;
          
          await fetchTransactionByHash(testHash);
          
          // Verify SDK was called with normalized hash (with 0x prefix, lowercase)
          expect(__mockAptos.getTransactionByHash).toHaveBeenCalledWith({
            transactionHash: `0x${txHash.toLowerCase()}`
          });
        }
      ), { numRuns: 25 });
    });
    
    test('should handle transaction hash normalization consistently', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }).filter(s => /^[0-9a-fA-F]{64}$/.test(s)),
        fc.boolean(),
        async (txHash, hasPrefix) => {
          __mockAptos.getTransactionByHash.mockClear();
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: []
          });
          
          const inputHash = hasPrefix ? `0x${txHash}` : txHash;
          const expectedHash = `0x${txHash.toLowerCase()}`;
          
          await fetchTransactionByHash(inputHash);
          
          // Should always call with 0x prefix and lowercase regardless of input format
          expect(__mockAptos.getTransactionByHash).toHaveBeenCalledWith({
            transactionHash: expectedHash
          });
        }
      ), { numRuns: 25 });
    });
    
    test('should reject invalid transaction hash formats', async () => {
      await fc.assert(fc.asyncProperty(
        fc.oneof(
          fc.constant(''),
          fc.constant(null),
          fc.constant(undefined),
          fc.integer(),
          fc.string().filter(s => s.length !== 64 && s.length !== 66), // Invalid length
          fc.string().filter(s => s.length > 0 && !/^(0x)?[0-9a-fA-F]+$/.test(s)) // Invalid hex
        ),
        async (invalidHash) => {
          __mockAptos.getTransactionByHash.mockClear();
          
          // Should throw error for invalid hash formats
          await expect(fetchTransactionByHash(invalidHash)).rejects.toThrow();
          
          // Should not call Aptos SDK with invalid hash
          expect(__mockAptos.getTransactionByHash).not.toHaveBeenCalled();
        }
      ), { numRuns: 25 });
    });
    
    test('should propagate Aptos SDK errors appropriately', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }).filter(s => /^[0-9a-fA-F]{64}$/.test(s)),
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async (txHash, errorMessage) => {
          __mockAptos.getTransactionByHash.mockClear();
          // Setup mock to throw error
          __mockAptos.getTransactionByHash.mockRejectedValue(new Error(errorMessage));
          
          const testHash = `0x${txHash}`;
          
          // Should throw error with descriptive message
          await expect(fetchTransactionByHash(testHash)).rejects.toThrow(/Failed to fetch transaction/);
          
          // Should have attempted to call SDK
          expect(__mockAptos.getTransactionByHash).toHaveBeenCalledWith({
            transactionHash: testHash.toLowerCase()
          });
        }
      ), { numRuns: 25 });
    });
  });
  
  describe('Payment Verification Integration Tests', () => {
    test('should use fetchTransactionByHash for all payment verifications', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }).filter(s => /^[0-9a-fA-F]{64}$/.test(s)),
        async (txHash) => {
          __mockAptos.getTransactionByHash.mockClear();
          // Setup mock response with successful transaction
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: [{
              type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>::DepositEvent',
              account_address: '0xYOUR_WALLET_ADDRESS_HERE',
              data: { amount: '1000000' }
            }]
          });
          
          const testHash = `0x${txHash}`;
          
          await paymentVerifier.verifyPayment(testHash);
          
          // Should use the SDK integration
          expect(__mockAptos.getTransactionByHash).toHaveBeenCalledWith({
            transactionHash: testHash.toLowerCase()
          });
        }
      ), { numRuns: 25 });
    });
    
    test('should handle SDK connection failures gracefully', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }).filter(s => /^[0-9a-fA-F]{64}$/.test(s)),
        fc.constantFrom('Network error', 'Timeout', 'Connection refused', 'Invalid response'),
        async (txHash, errorType) => {
          __mockAptos.getTransactionByHash.mockClear();
          // Setup mock to simulate network/connection errors
          __mockAptos.getTransactionByHash.mockRejectedValue(new Error(errorType));
          
          const testHash = `0x${txHash}`;
          
          // Should return false (not throw) for network errors
          const result = await paymentVerifier.verifyPayment(testHash);
          expect(result).toBe(false);
          
          // Should have attempted SDK call
          expect(__mockAptos.getTransactionByHash).toHaveBeenCalledWith({
            transactionHash: testHash.toLowerCase()
          });
        }
      ), { numRuns: 25 });
    });
  });
  
  describe('Transaction Hash Format Property Tests', () => {
    test('should accept valid 64-character hex strings', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }).filter(s => /^[0-9a-fA-F]{64}$/.test(s)),
        async (txHash) => {
          __mockAptos.getTransactionByHash.mockClear();
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: []
          });
          
          // Should not throw for valid hex strings
          await expect(fetchTransactionByHash(txHash)).resolves.toBeDefined();
          await expect(fetchTransactionByHash(`0x${txHash}`)).resolves.toBeDefined();
        }
      ), { numRuns: 25 });
    });
    
    test('should handle case insensitive hex strings', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }).filter(s => /^[0-9a-fA-F]{64}$/.test(s)),
        fc.constantFrom('upper', 'lower', 'mixed'),
        async (txHash, caseType) => {
          __mockAptos.getTransactionByHash.mockClear();
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: []
          });
          
          let formattedHash;
          switch (caseType) {
            case 'upper':
              formattedHash = txHash.toUpperCase();
              break;
            case 'lower':
              formattedHash = txHash.toLowerCase();
              break;
            case 'mixed':
              formattedHash = txHash.split('').map((c, i) => 
                i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()
              ).join('');
              break;
          }
          
          await fetchTransactionByHash(formattedHash);
          
          // Should normalize to lowercase with 0x prefix
          expect(__mockAptos.getTransactionByHash).toHaveBeenCalledWith({
            transactionHash: `0x${txHash.toLowerCase()}`
          });
        }
      ), { numRuns: 25 });
    });
  });
});