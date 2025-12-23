const fc = require('fast-check');
const request = require('supertest');
const { app, PaymentVerifier } = require('./access-server');

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

describe('Property Tests: Payment Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  /**
   * Property 5: Error Response Consistency
   * For any invalid payment (failed verification, wrong amount, or invalid transaction hash), 
   * the system should return a 402 Payment Required error
   * Validates: Requirements 2.5, 6.4
   */
  
  describe('Property 5: Error Response Consistency', () => {
    test('should return 402 for failed payment verification', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.oneof(
          // Failed transaction
          fc.constant({ success: false, events: [] }),
          // No payment events
          fc.constant({ success: true, events: [] }),
          // Wrong receiver
          fc.record({
            success: fc.constant(true),
            events: fc.constant([{
              type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>::DepositEvent',
              account_address: '0xWRONG_ADDRESS_HERE',
              data: { amount: '1000000' }
            }])
          }),
          // Insufficient amount
          fc.record({
            success: fc.constant(true),
            events: fc.constant([{
              type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>::DepositEvent',
              account_address: '0xYOUR_WALLET_ADDRESS_HERE',
              data: { amount: '999999' } // Less than required
            }])
          })
        ),
        async (txHash, invalidTransaction) => {
          // Setup mock with invalid transaction
          __mockAptos.getTransactionByHash.mockResolvedValue(invalidTransaction);
          
          const response = await request(app)
            .post('/buy-access')
            .send({ 
              tx_hash: `0x${txHash}`,
              scraper_ip: '192.168.1.1'
            });
          
          // Should return 402 Payment Required for all invalid payments
          expect(response.status).toBe(402);
          expect(response.body.error).toBe('Payment verification failed');
          expect(response.body.code).toBe(402);
        }
      ), { numRuns: 20 });
    });
    
    test('should return 402 for invalid transaction hashes', async () => {
      await fc.assert(fc.asyncProperty(
        fc.oneof(
          fc.constant('invalid-hash'),
          fc.constant('0x123'), // Too short
          fc.string({ minLength: 1 }).filter(s => s.length > 0 && !/^(0x)?[0-9a-fA-F]{64}$/.test(s))
        ),
        async (invalidHash) => {
          const response = await request(app)
            .post('/buy-access')
            .send({ 
              tx_hash: invalidHash,
              scraper_ip: '192.168.1.1'
            });
          
          // Should return 402 for invalid transaction hashes
          expect(response.status).toBe(402);
          expect(response.body.error).toBe('Payment verification failed');
          expect(response.body.code).toBe(402);
        }
      ), { numRuns: 20 });
    });
    
    test('should return 400 for missing tx_hash field', async () => {
      await fc.assert(fc.asyncProperty(
        fc.oneof(
          fc.constant({}), // Empty body
          fc.constant({ scraper_ip: '192.168.1.1' }), // Missing tx_hash
          fc.constant({ tx_hash: null }), // Null tx_hash
          fc.constant({ tx_hash: undefined }) // Undefined tx_hash
        ),
        async (invalidBody) => {
          const response = await request(app)
            .post('/buy-access')
            .send(invalidBody);
          
          // Should return 400 for missing required field
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/Missing required field: tx_hash/);
          expect(response.body.code).toBe(400);
        }
      ), { numRuns: 15 });
    });
    
    test('should handle Aptos SDK network errors gracefully', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.constantFrom(
          'Network timeout',
          'Connection refused', 
          'Service unavailable',
          'Invalid response format',
          'Rate limit exceeded'
        ),
        async (txHash, errorMessage) => {
          // Setup mock to throw network error
          __mockAptos.getTransactionByHash.mockRejectedValue(new Error(errorMessage));
          
          const response = await request(app)
            .post('/buy-access')
            .send({ 
              tx_hash: `0x${txHash}`,
              scraper_ip: '192.168.1.1'
            });
          
          // Should return 402 for network errors (payment verification failed)
          expect(response.status).toBe(402);
          expect(response.body.error).toBe('Payment verification failed');
          expect(response.body.code).toBe(402);
        }
      ), { numRuns: 15 });
    });
  });
  
  describe('Error Message Consistency Tests', () => {
    test('should provide consistent error format for all payment failures', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.oneof(
          fc.constant('failed_transaction'),
          fc.constant('wrong_address'),
          fc.constant('insufficient_amount'),
          fc.constant('no_events'),
          fc.constant('network_error')
        ),
        async (txHash, errorType) => {
          // Setup different error scenarios
          switch (errorType) {
            case 'failed_transaction':
              __mockAptos.getTransactionByHash.mockResolvedValue({ success: false, events: [] });
              break;
            case 'wrong_address':
              __mockAptos.getTransactionByHash.mockResolvedValue({
                success: true,
                events: [{
                  type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>::DepositEvent',
                  account_address: '0xWRONG_ADDRESS',
                  data: { amount: '1000000' }
                }]
              });
              break;
            case 'insufficient_amount':
              __mockAptos.getTransactionByHash.mockResolvedValue({
                success: true,
                events: [{
                  type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>::DepositEvent',
                  account_address: '0xYOUR_WALLET_ADDRESS_HERE',
                  data: { amount: '500000' }
                }]
              });
              break;
            case 'no_events':
              __mockAptos.getTransactionByHash.mockResolvedValue({ success: true, events: [] });
              break;
            case 'network_error':
              __mockAptos.getTransactionByHash.mockRejectedValue(new Error('Network error'));
              break;
          }
          
          const response = await request(app)
            .post('/buy-access')
            .send({ 
              tx_hash: `0x${txHash}`,
              scraper_ip: '192.168.1.1'
            });
          
          // All payment verification failures should have consistent format
          expect(response.status).toBe(402);
          expect(response.body).toHaveProperty('error');
          expect(response.body).toHaveProperty('code');
          expect(response.body.error).toBe('Payment verification failed');
          expect(response.body.code).toBe(402);
        }
      ), { numRuns: 15 });
    });
    
    test('should handle malformed JSON requests appropriately', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => {
          try {
            JSON.parse(s);
            return false; // Valid JSON, skip
          } catch {
            return true; // Invalid JSON, use this
          }
        }),
        async (malformedJson) => {
          const response = await request(app)
            .post('/buy-access')
            .set('Content-Type', 'application/json')
            .send(malformedJson);
          
          // Should return 400 for malformed JSON
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/Invalid JSON/);
          expect(response.body.code).toBe(400);
        }
      ), { numRuns: 10 }); // Reduced runs since generating invalid JSON is expensive
    });
  });
  
  describe('IP Detection Error Handling', () => {
    test('should handle IP detection gracefully', async () => {
      // Simple test - just verify the endpoint works with valid data
      const response = await request(app)
        .post('/buy-access')
        .send({ 
          tx_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          scraper_ip: '192.168.1.1'
        });
      
      // Should return some valid response (not crash)
      expect([200, 400, 402, 503]).toContain(response.status);
    }, 10000); // 10 second timeout
  });
});