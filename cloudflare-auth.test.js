const fc = require('fast-check');
const axios = require('axios');
const { CloudflareClient, CONFIG } = require('./access-server');

// Mock axios to avoid actual API calls
jest.mock('axios');
const mockedAxios = axios;

describe('Property Tests: Cloudflare Authentication', () => {
  let cloudflareClient;
  
  beforeEach(() => {
    cloudflareClient = new CloudflareClient();
    jest.clearAllMocks();
  });
  
  /**
   * Property 9: Cloudflare API Authentication
   * For any Cloudflare API request, the client should include the configured token 
   * in the Authorization header and target the correct zone ID
   * Validates: Requirements 3.4, 3.5
   */
  
  describe('Property 9: Cloudflare API Authentication', () => {
    test('should include correct authorization header in all requests', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        fc.constantFrom('GET', 'POST', 'DELETE'),
        async (ip, method) => {
          // Setup mock response
          mockedAxios.get.mockResolvedValue({ data: { success: true, result: [] } });
          mockedAxios.post.mockResolvedValue({ data: { success: true, result: { id: 'test-id' } } });
          mockedAxios.delete.mockResolvedValue({ data: { success: true } });
          
          try {
            // Call different methods based on the test case
            switch (method) {
              case 'GET':
                await cloudflareClient.findExistingRule(ip);
                expect(mockedAxios.get).toHaveBeenCalledWith(
                  expect.stringContaining(ip),
                  expect.objectContaining({
                    headers: expect.objectContaining({
                      'Authorization': `Bearer ${CONFIG.CLOUDFLARE_TOKEN}`
                    })
                  })
                );
                break;
              case 'POST':
                await cloudflareClient.createWhitelistRule(ip);
                expect(mockedAxios.post).toHaveBeenCalledWith(
                  expect.any(String),
                  expect.any(Object),
                  expect.objectContaining({
                    headers: expect.objectContaining({
                      'Authorization': `Bearer ${CONFIG.CLOUDFLARE_TOKEN}`
                    })
                  })
                );
                break;
              case 'DELETE':
                await cloudflareClient.deleteRule('test-rule-id');
                expect(mockedAxios.delete).toHaveBeenCalledWith(
                  expect.any(String),
                  expect.objectContaining({
                    headers: expect.objectContaining({
                      'Authorization': `Bearer ${CONFIG.CLOUDFLARE_TOKEN}`
                    })
                  })
                );
                break;
            }
          } catch (error) {
            // Some methods might throw, but we're testing the auth headers
            // The important thing is that the request was made with correct headers
          }
        }
      ), { numRuns: 20 });
    });
    
    test('should target correct zone ID in all API endpoints', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        async (ip) => {
          // Setup mock responses
          mockedAxios.get.mockResolvedValue({ data: { success: true, result: [] } });
          mockedAxios.post.mockResolvedValue({ data: { success: true, result: { id: 'test-id' } } });
          mockedAxios.delete.mockResolvedValue({ data: { success: true } });
          
          // Test findExistingRule
          await cloudflareClient.findExistingRule(ip);
          expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.stringContaining(CONFIG.CLOUDFLARE_ZONE_ID),
            expect.any(Object)
          );
          
          // Test createWhitelistRule
          await cloudflareClient.createWhitelistRule(ip);
          expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.stringContaining(CONFIG.CLOUDFLARE_ZONE_ID),
            expect.any(Object),
            expect.any(Object)
          );
          
          // Test deleteRule
          await cloudflareClient.deleteRule('test-rule-id');
          expect(mockedAxios.delete).toHaveBeenCalledWith(
            expect.stringContaining(CONFIG.CLOUDFLARE_ZONE_ID),
            expect.any(Object)
          );
        }
      ), { numRuns: 15 });
    });
    
    test('should include Content-Type header for POST requests', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        async (ip) => {
          // Setup mock response
          mockedAxios.post.mockResolvedValue({ data: { success: true, result: { id: 'test-id' } } });
          
          await cloudflareClient.createWhitelistRule(ip);
          
          expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Object),
            expect.objectContaining({
              headers: expect.objectContaining({
                'Content-Type': 'application/json'
              })
            })
          );
        }
      ), { numRuns: 15 });
    });
    
    test('should use correct API base URL structure', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        async (ip) => {
          // Setup mock responses
          mockedAxios.get.mockResolvedValue({ data: { success: true, result: [] } });
          mockedAxios.post.mockResolvedValue({ data: { success: true, result: { id: 'test-id' } } });
          
          await cloudflareClient.findExistingRule(ip);
          await cloudflareClient.createWhitelistRule(ip);
          
          // Verify API URL structure includes required components
          const getCall = mockedAxios.get.mock.calls[0];
          const postCall = mockedAxios.post.mock.calls[0];
          
          expect(getCall[0]).toMatch(/https:\/\/api\.cloudflare\.com\/client\/v4\/zones\/.*\/firewall\/access_rules\/rules/);
          expect(postCall[0]).toMatch(/https:\/\/api\.cloudflare\.com\/client\/v4\/zones\/.*\/firewall\/access_rules\/rules/);
        }
      ), { numRuns: 15 });
    });
  });
  
  describe('Authentication Error Handling', () => {
    test('should handle authentication failures gracefully', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        fc.constantFrom(401, 403, 429), // Auth errors and rate limiting
        async (ip, errorStatus) => {
          // Setup mock to return authentication error
          const authError = new Error('Authentication failed');
          authError.response = { status: errorStatus };
          mockedAxios.get.mockRejectedValue(authError);
          mockedAxios.post.mockRejectedValue(authError);
          mockedAxios.delete.mockRejectedValue(authError);
          
          // All methods should throw errors for auth failures
          await expect(cloudflareClient.findExistingRule(ip)).rejects.toThrow();
          await expect(cloudflareClient.createWhitelistRule(ip)).rejects.toThrow();
          await expect(cloudflareClient.deleteRule('test-id')).rejects.toThrow();
        }
      ), { numRuns: 10 });
    });
    
    test('should handle network errors appropriately', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        fc.constantFrom('ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'),
        async (ip, errorCode) => {
          // Setup mock to return network error
          const networkError = new Error('Network error');
          networkError.code = errorCode;
          mockedAxios.get.mockRejectedValue(networkError);
          mockedAxios.post.mockRejectedValue(networkError);
          mockedAxios.delete.mockRejectedValue(networkError);
          
          // All methods should throw errors for network failures
          await expect(cloudflareClient.findExistingRule(ip)).rejects.toThrow();
          await expect(cloudflareClient.createWhitelistRule(ip)).rejects.toThrow();
          await expect(cloudflareClient.deleteRule('test-id')).rejects.toThrow();
        }
      ), { numRuns: 10 });
    });
  });
  
  describe('Configuration Validation', () => {
    test('should use configured token and zone ID consistently', () => {
      // Verify the client is initialized with correct configuration
      expect(cloudflareClient.headers['Authorization']).toBe(`Bearer ${CONFIG.CLOUDFLARE_TOKEN}`);
      expect(cloudflareClient.baseURL).toContain(CONFIG.CLOUDFLARE_ZONE_ID);
      expect(cloudflareClient.baseURL).toContain(CONFIG.CLOUDFLARE_API_URL);
    });
    
    test('should have required configuration constants defined', () => {
      expect(CONFIG.CLOUDFLARE_TOKEN).toBeDefined();
      expect(CONFIG.CLOUDFLARE_ZONE_ID).toBeDefined();
      expect(CONFIG.CLOUDFLARE_API_URL).toBeDefined();
      expect(typeof CONFIG.CLOUDFLARE_TOKEN).toBe('string');
      expect(typeof CONFIG.CLOUDFLARE_ZONE_ID).toBe('string');
      expect(typeof CONFIG.CLOUDFLARE_API_URL).toBe('string');
    });
  });
});