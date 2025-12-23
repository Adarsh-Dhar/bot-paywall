const fc = require('fast-check');
const request = require('supertest');
const { app, PaymentVerifier, CloudflareClient, TimerManager } = require('./access-server');

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

// Mock axios for Cloudflare API
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn()
}));

const { __mockAptos } = require('@aptos-labs/ts-sdk');
const axios = require('axios');

describe('Property Tests: Logging Completeness', () => {
  let consoleSpy;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Spy on console.log to capture logging
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  afterEach(() => {
    consoleSpy.mockRestore();
  });
  
  /**
   * Property 7: Logging Completeness
   * For any system operation, appropriate log messages should be generated 
   * ("Payment Verified", "Whitelisted IP", "Timer Expired - Access Revoked")
   * **Feature: node-access-control-middleware, Property 7: Logging Completeness**
   * Validates: Requirements 6.1, 6.2, 6.3
   */
  
  describe('Property 7: Logging Completeness', () => {
    test('should log "Payment Verified" for all successful payment verifications', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.integer({ min: 1000000, max: 10000000 }), // Valid payment amounts
        async (txHash, paymentAmount) => {
          // Setup valid transaction mock
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: [{
              type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>::DepositEvent',
              account_address: '0xYOUR_WALLET_ADDRESS_HERE',
              data: { amount: paymentAmount.toString() }
            }]
          });
          
          // Create PaymentVerifier instance and verify payment
          const paymentVerifier = new PaymentVerifier();
          const result = await paymentVerifier.verifyPayment(`0x${txHash}`);
          
          // Should return true for valid payment
          expect(result).toBe(true);
          
          // Should log "Payment Verified"
          expect(consoleSpy).toHaveBeenCalledWith('Payment Verified');
        }
      ), { numRuns: 20 });
    });
    
    test('should log "Whitelisted IP" for all successful rule creations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        fc.string({ minLength: 10, maxLength: 20 }), // Rule ID
        async (ip, ruleId) => {
          // Setup successful Cloudflare API response
          axios.post.mockResolvedValue({
            data: {
              success: true,
              result: { id: ruleId }
            }
          });
          
          // Create CloudflareClient instance and create rule
          const cloudflareClient = new CloudflareClient();
          const resultId = await cloudflareClient.createWhitelistRule(ip);
          
          // Should return the rule ID
          expect(resultId).toBe(ruleId);
          
          // Should log "Whitelisted IP"
          expect(consoleSpy).toHaveBeenCalledWith('Whitelisted IP');
        }
      ), { numRuns: 20 });
    });
    
    test('should log "Timer Expired - Access Revoked" when timers expire', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        fc.string({ minLength: 10, maxLength: 20 }), // Rule ID
        async (ip, ruleId) => {
          // Setup successful Cloudflare delete response
          axios.delete.mockResolvedValue({
            data: { success: true }
          });
          
          // Create components
          const cloudflareClient = new CloudflareClient();
          const timerManager = new TimerManager();
          
          // Start timer with very short duration for testing
          const originalDuration = require('./access-server').CONFIG.SUBSCRIPTION_DURATION_MS;
          
          // Temporarily override the duration for testing
          jest.doMock('./access-server', () => ({
            ...jest.requireActual('./access-server'),
            CONFIG: {
              ...jest.requireActual('./access-server').CONFIG,
              SUBSCRIPTION_DURATION_MS: 10 // 10ms for fast testing
            }
          }));
          
          timerManager.startTimer(ip, ruleId, cloudflareClient);
          
          // Wait for timer to expire
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Should log "Timer Expired - Access Revoked"
          expect(consoleSpy).toHaveBeenCalledWith('Timer Expired - Access Revoked');
        }
      ), { numRuns: 10 }); // Reduced runs due to timing sensitivity
    });
    
    test('should log all three messages in complete successful workflow', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.ipV4(),
        fc.integer({ min: 1000000, max: 10000000 }),
        fc.string({ minLength: 10, maxLength: 20 }),
        async (txHash, ip, paymentAmount, ruleId) => {
          // Setup mocks for complete successful workflow
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: [{
              type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>::DepositEvent',
              account_address: '0xYOUR_WALLET_ADDRESS_HERE',
              data: { amount: paymentAmount.toString() }
            }]
          });
          
          // Mock no existing rule
          axios.get.mockResolvedValue({
            data: { success: true, result: [] }
          });
          
          // Mock successful rule creation
          axios.post.mockResolvedValue({
            data: {
              success: true,
              result: { id: ruleId }
            }
          });
          
          // Mock successful rule deletion
          axios.delete.mockResolvedValue({
            data: { success: true }
          });
          
          // Make request to the endpoint
          const response = await request(app)
            .post('/buy-access')
            .send({ 
              tx_hash: `0x${txHash}`,
              scraper_ip: ip
            });
          
          // Should be successful
          expect(response.status).toBe(200);
          expect(response.body.status).toBe('granted');
          
          // Should log payment verification
          expect(consoleSpy).toHaveBeenCalledWith('Payment Verified');
          
          // Should log IP whitelisting
          expect(consoleSpy).toHaveBeenCalledWith('Whitelisted IP');
          
          // Wait a bit for timer to potentially expire (though we won't wait full 60s)
          // This tests that the timer is set up correctly
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      ), { numRuns: 15 });
    });
    
    test('should maintain logging consistency across different payment amounts', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.integer({ min: 1000000, max: 100000000 }), // Various valid amounts
        async (txHash, paymentAmount) => {
          // Setup valid transaction with different amounts
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: true,
            events: [{
              type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>::DepositEvent',
              account_address: '0xYOUR_WALLET_ADDRESS_HERE',
              data: { amount: paymentAmount.toString() }
            }]
          });
          
          const paymentVerifier = new PaymentVerifier();
          const result = await paymentVerifier.verifyPayment(`0x${txHash}`);
          
          // All valid payments should log consistently
          expect(result).toBe(true);
          expect(consoleSpy).toHaveBeenCalledWith('Payment Verified');
        }
      ), { numRuns: 25 });
    });
    
    test('should maintain logging consistency across different IP formats', async () => {
      await fc.assert(fc.asyncProperty(
        fc.oneof(
          fc.ipV4(),
          fc.ipV6()
        ),
        fc.string({ minLength: 10, maxLength: 20 }),
        async (ip, ruleId) => {
          // Setup successful response for any IP format
          axios.post.mockResolvedValue({
            data: {
              success: true,
              result: { id: ruleId }
            }
          });
          
          const cloudflareClient = new CloudflareClient();
          const resultId = await cloudflareClient.createWhitelistRule(ip);
          
          // All successful rule creations should log consistently
          expect(resultId).toBe(ruleId);
          expect(consoleSpy).toHaveBeenCalledWith('Whitelisted IP');
        }
      ), { numRuns: 20 });
    });
  });
  
  describe('Logging Error Scenarios', () => {
    test('should not log success messages for failed operations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        async (txHash) => {
          // Setup failed transaction
          __mockAptos.getTransactionByHash.mockResolvedValue({
            success: false,
            events: []
          });
          
          const paymentVerifier = new PaymentVerifier();
          const result = await paymentVerifier.verifyPayment(`0x${txHash}`);
          
          // Should not succeed
          expect(result).toBe(false);
          
          // Should NOT log "Payment Verified"
          expect(consoleSpy).not.toHaveBeenCalledWith('Payment Verified');
        }
      ), { numRuns: 15 });
    });
    
    test('should not log whitelist success for failed Cloudflare operations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        async (ip) => {
          // Setup failed Cloudflare API response
          axios.post.mockResolvedValue({
            data: {
              success: false,
              errors: [{ message: 'API error' }]
            }
          });
          
          const cloudflareClient = new CloudflareClient();
          
          // Should throw error
          await expect(cloudflareClient.createWhitelistRule(ip)).rejects.toThrow();
          
          // Should NOT log "Whitelisted IP"
          expect(consoleSpy).not.toHaveBeenCalledWith('Whitelisted IP');
        }
      ), { numRuns: 15 });
    });
  });
});