const fc = require('fast-check');
const { PaymentVerifier, CONFIG } = require('./access-server');

// Mock the Aptos SDK
jest.mock('@aptos-labs/ts-sdk', () => {
  const mockAptos = {
    getTransactionByHash: jest.fn(),
    getLedgerInfo: jest.fn()
  };
  
  return {
    Aptos: jest.fn(() => mockAptos),
    AptosConfig: jest.fn(),
    Network: { MAINNET: 'mainnet' },
    __mockAptos: mockAptos
  };
});

const { __mockAptos } = require('@aptos-labs/ts-sdk');

describe('Property Tests: Payment Verification', () => {
  let paymentVerifier;
  
  beforeEach(() => {
    paymentVerifier = new PaymentVerifier();
    jest.clearAllMocks();
  });
  
  /**
   * Property 1: Payment Verification Completeness
   * For any transaction hash, the Payment Verifier should verify all required conditions 
   * (success status, correct receiver address, and minimum amount) before approving payment
   * Validates: Requirements 2.2, 2.3, 2.4
   */
  
  describe('Property 1: Payment Verification Completeness', () => {
    test('should verify all conditions for valid payments', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.integer({ min: CONFIG.REQUIRED_AMOUNT_OCTAS, max: CONFIG.REQUIRED_AMOUNT_OCTAS * 10 }),
        async (txHash, amount) => {
          // Setup mock with valid transaction
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: [{
              type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>::DepositEvent',
              account_address: CONFIG.PAYMENT_DESTINATION,
              data: { amount: amount.toString() }
            }]
          });
          
          const result = await paymentVerifier.verifyPayment(`0x${txHash}`);
          
          // Should approve valid payments that meet all conditions
          expect(result).toBe(true);
        }
      ), { numRuns: 25 });
    });
    
    test('should reject payments with insufficient amount', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.integer({ min: 1, max: CONFIG.REQUIRED_AMOUNT_OCTAS - 1 }),
        async (txHash, insufficientAmount) => {
          // Setup mock with insufficient payment
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: [{
              type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>::DepositEvent',
              account_address: CONFIG.PAYMENT_DESTINATION,
              data: { amount: insufficientAmount.toString() }
            }]
          });
          
          const result = await paymentVerifier.verifyPayment(`0x${txHash}`);
          
          // Should reject insufficient payments
          expect(result).toBe(false);
        }
      ), { numRuns: 25 });
    });
    
    test('should reject payments to wrong address', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.hexaString({ minLength: 64, maxLength: 64 }).filter(addr => `0x${addr}` !== CONFIG.PAYMENT_DESTINATION),
        async (txHash, wrongAddress) => {
          // Setup mock with payment to wrong address
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: [{
              type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>::DepositEvent',
              account_address: `0x${wrongAddress}`,
              data: { amount: CONFIG.REQUIRED_AMOUNT_OCTAS.toString() }
            }]
          });
          
          const result = await paymentVerifier.verifyPayment(`0x${txHash}`);
          
          // Should reject payments to wrong address
          expect(result).toBe(false);
        }
      ), { numRuns: 25 });
    });
    
    test('should reject failed transactions', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        async (txHash) => {
          // Setup mock with failed transaction
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: false,
            events: [{
              type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>::DepositEvent',
              account_address: CONFIG.PAYMENT_DESTINATION,
              data: { amount: CONFIG.REQUIRED_AMOUNT_OCTAS.toString() }
            }]
          });
          
          const result = await paymentVerifier.verifyPayment(`0x${txHash}`);
          
          // Should reject failed transactions regardless of other conditions
          expect(result).toBe(false);
        }
      ), { numRuns: 25 });
    });
    
    test('should handle transactions with no payment events', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        async (txHash) => {
          // Setup mock with transaction that has no payment events
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: [] // No events
          });
          
          const result = await paymentVerifier.verifyPayment(`0x${txHash}`);
          
          // Should reject transactions with no payment events
          expect(result).toBe(false);
        }
      ), { numRuns: 25 });
    });
  });
  
  describe('Payment Detail Extraction Tests', () => {
    test('should extract payment details from various event formats', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.integer({ min: CONFIG.REQUIRED_AMOUNT_OCTAS, max: CONFIG.REQUIRED_AMOUNT_OCTAS * 10 }),
        fc.constantFrom(
          '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>::DepositEvent',
          '0x1::coin::CoinStore::DepositEvent',
          'coin::CoinStore::DepositEvent'
        ),
        async (txHash, amount, eventType) => {
          // Setup mock with different event formats
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: [{
              type: eventType,
              account_address: CONFIG.PAYMENT_DESTINATION,
              data: { amount: amount.toString() }
            }]
          });
          
          const result = await paymentVerifier.verifyPayment(`0x${txHash}`);
          
          // Should handle various event formats
          expect(result).toBe(true);
        }
      ), { numRuns: 25 });
    });
    
    test('should fallback to payload extraction when events are missing', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.integer({ min: CONFIG.REQUIRED_AMOUNT_OCTAS, max: CONFIG.REQUIRED_AMOUNT_OCTAS * 10 }),
        fc.constantFrom('0x1::coin::transfer', '0x1::aptos_coin::transfer'),
        async (txHash, amount, functionName) => {
          // Setup mock with payload-based transfer (no events)
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: [], // No events, should use payload
            payload: {
              function: functionName,
              arguments: [CONFIG.PAYMENT_DESTINATION, amount.toString()]
            }
          });
          
          const result = await paymentVerifier.verifyPayment(`0x${txHash}`);
          
          // Should extract payment details from payload
          expect(result).toBe(true);
        }
      ), { numRuns: 25 });
    });
  });
  
  describe('Edge Case Handling', () => {
    test('should handle malformed transaction data gracefully', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.oneof(
          fc.constant({ success: true }), // Missing events and payload
          fc.constant({ success: true, events: null }), // Null events
          fc.constant({ success: true, events: [{}] }), // Empty event objects
          fc.constant({ success: true, events: [{ type: 'unknown', data: {} }] }) // Unknown event types
        ),
        async (txHash, malformedTransaction) => {
          __mockAptos.getTransactionByHash.mockResolvedValue(malformedTransaction);
          
          const result = await paymentVerifier.verifyPayment(`0x${txHash}`);
          
          // Should handle malformed data gracefully (return false, not throw)
          expect(result).toBe(false);
        }
      ), { numRuns: 25 });
    });
    
    test('should handle zero and negative amounts correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.integer({ min: -1000, max: 0 }),
        async (txHash, invalidAmount) => {
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: [{
              type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>::DepositEvent',
              account_address: CONFIG.PAYMENT_DESTINATION,
              data: { amount: invalidAmount.toString() }
            }]
          });
          
          const result = await paymentVerifier.verifyPayment(`0x${txHash}`);
          
          // Should reject zero and negative amounts
          expect(result).toBe(false);
        }
      ), { numRuns: 25 });
    });
    
    test('should handle string amounts correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.integer({ min: CONFIG.REQUIRED_AMOUNT_OCTAS, max: CONFIG.REQUIRED_AMOUNT_OCTAS * 10 }),
        async (txHash, amount) => {
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: [{
              type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>::DepositEvent',
              account_address: CONFIG.PAYMENT_DESTINATION,
              data: { amount: amount.toString() } // Amount as string
            }]
          });
          
          const result = await paymentVerifier.verifyPayment(`0x${txHash}`);
          
          // Should correctly parse string amounts
          expect(result).toBe(true);
        }
      ), { numRuns: 25 });
    });
  });
});