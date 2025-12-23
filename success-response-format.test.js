const fc = require('fast-check');
const request = require('supertest');
const { app, PaymentVerifier, CloudflareClient, TimerManager, clearAllTimers } = require('./access-server');

// Mock external dependencies
jest.mock('axios');
const axios = require('axios');
const mockedAxios = axios;

describe('Property Tests: Success Response Format', () => {
  let originalPaymentVerifier;
  let originalCloudflareClient;
  let originalTimerManager;

  beforeEach(() => {
    // Clear all timers before each test
    clearAllTimers();
    jest.clearAllMocks();
    
    // Mock PaymentVerifier to always return true for successful verification
    originalPaymentVerifier = PaymentVerifier.prototype.verifyPayment;
    PaymentVerifier.prototype.verifyPayment = jest.fn().mockResolvedValue(true);
    
    // Mock CloudflareClient methods
    originalCloudflareClient = {
      findExistingRule: CloudflareClient.prototype.findExistingRule,
      createWhitelistRule: CloudflareClient.prototype.createWhitelistRule,
      deleteRule: CloudflareClient.prototype.deleteRule
    };
    
    CloudflareClient.prototype.findExistingRule = jest.fn().mockResolvedValue(null);
    CloudflareClient.prototype.createWhitelistRule = jest.fn().mockResolvedValue('mock-rule-id');
    CloudflareClient.prototype.deleteRule = jest.fn().mockResolvedValue();
    
    // Mock TimerManager
    originalTimerManager = TimerManager.prototype.startTimer;
    TimerManager.prototype.startTimer = jest.fn();
  });

  afterEach(() => {
    // Restore original methods
    PaymentVerifier.prototype.verifyPayment = originalPaymentVerifier;
    CloudflareClient.prototype.findExistingRule = originalCloudflareClient.findExistingRule;
    CloudflareClient.prototype.createWhitelistRule = originalCloudflareClient.createWhitelistRule;
    CloudflareClient.prototype.deleteRule = originalCloudflareClient.deleteRule;
    TimerManager.prototype.startTimer = originalTimerManager;
    
    clearAllTimers();
  });

  /**
   * Property 6: Success Response Format
   * For any successful access grant, the system should return 200 OK with exactly the format { status: "granted", expires_in: "60s" }
   * Validates: Requirements 5.5
   * Feature: node-access-control-middleware, Property 6: Success Response Format
   */
  describe('Property 6: Success Response Format', () => {
    test('should return exact success response format for any valid transaction hash', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }), // Valid 64-character hex string for tx_hash
        fc.option(fc.ipV4(), { nil: undefined }), // Optional scraper_ip
        async (txHash, scraperIp) => {
          // Prepare request body
          const requestBody = { tx_hash: `0x${txHash}` };
          if (scraperIp) {
            requestBody.scraper_ip = scraperIp;
          }

          // Make request to /buy-access endpoint
          const response = await request(app)
            .post('/buy-access')
            .send(requestBody);

          // Verify response status is 200
          expect(response.status).toBe(200);
          
          // Verify response body has exact format
          expect(response.body).toEqual({
            status: 'granted',
            expires_in: '60s'
          });
          
          // Verify response body structure
          expect(typeof response.body.status).toBe('string');
          expect(typeof response.body.expires_in).toBe('string');
          expect(response.body.status).toBe('granted');
          expect(response.body.expires_in).toBe('60s');
          
          // Verify no extra properties in response
          const responseKeys = Object.keys(response.body);
          expect(responseKeys).toHaveLength(2);
          expect(responseKeys).toContain('status');
          expect(responseKeys).toContain('expires_in');
        }
      ), { numRuns: 100 });
    });

    test('should return consistent response format regardless of IP source', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }), // Valid tx_hash
        fc.oneof(
          fc.constant(undefined), // No scraper_ip (use auto-detection)
          fc.ipV4(), // Explicit IPv4
          fc.ipV6() // Explicit IPv6
        ),
        async (txHash, scraperIp) => {
          const requestBody = { tx_hash: `0x${txHash}` };
          if (scraperIp) {
            requestBody.scraper_ip = scraperIp;
          }

          const response = await request(app)
            .post('/buy-access')
            .send(requestBody);

          // Should always return the same success format regardless of IP source
          expect(response.status).toBe(200);
          expect(response.body).toEqual({
            status: 'granted',
            expires_in: '60s'
          });
        }
      ), { numRuns: 100 });
    });

    test('should return success format with correct content-type header', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        async (txHash) => {
          const response = await request(app)
            .post('/buy-access')
            .send({ tx_hash: `0x${txHash}` });

          expect(response.status).toBe(200);
          expect(response.headers['content-type']).toMatch(/application\/json/);
          expect(response.body).toEqual({
            status: 'granted',
            expires_in: '60s'
          });
        }
      ), { numRuns: 100 });
    });

    test('should return success format with exact string values (not numbers or booleans)', async () => {
      await fc.assert(fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        async (txHash) => {
          const response = await request(app)
            .post('/buy-access')
            .send({ tx_hash: `0x${txHash}` });

          expect(response.status).toBe(200);
          
          // Verify exact string values, not other types
          expect(response.body.status).toBe('granted');
          expect(response.body.status).not.toBe(true); // Not boolean
          expect(response.body.status).not.toBe(1); // Not number
          
          expect(response.body.expires_in).toBe('60s');
          expect(response.body.expires_in).not.toBe(60); // Not number
          expect(response.body.expires_in).not.toBe('60'); // Not just number string
        }
      ), { numRuns: 100 });
    });
  });
});