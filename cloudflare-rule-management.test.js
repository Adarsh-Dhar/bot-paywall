const fc = require('fast-check');
const axios = require('axios');
const { CloudflareClient } = require('./access-server');

// Mock axios to avoid actual API calls
jest.mock('axios');
const mockedAxios = axios;

describe('Property Tests: Cloudflare Rule Management', () => {
  let cloudflareClient;
  
  beforeEach(() => {
    cloudflareClient = new CloudflareClient();
    jest.clearAllMocks();
  });
  
  /**
   * Property 2: Cloudflare Rule Management Consistency
   * For any IP address, the Cloudflare Client should check for existing rules, 
   * delete them if found, and create new whitelist rules with correct parameters
   * Validates: Requirements 3.1, 3.2, 3.3
   */
  
  describe('Property 2: Cloudflare Rule Management Consistency', () => {
    test('should check for existing rules before creating new ones', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        fc.boolean(), // Whether existing rule exists
        async (ip, hasExistingRule) => {
          // Setup mock responses
          if (hasExistingRule) {
            mockedAxios.get.mockResolvedValue({
              data: { 
                success: true, 
                result: [{ id: 'existing-rule-id' }] 
              }
            });
          } else {
            mockedAxios.get.mockResolvedValue({
              data: { 
                success: true, 
                result: [] 
              }
            });
          }
          
          const result = await cloudflareClient.findExistingRule(ip);
          
          // Should always check for existing rules first
          expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.stringContaining(`configuration.value=${ip}`),
            expect.any(Object)
          );
          
          // Should return rule ID if exists, null otherwise
          if (hasExistingRule) {
            expect(result).toBe('existing-rule-id');
          } else {
            expect(result).toBeNull();
          }
        }
      ), { numRuns: 20 });
    });
    
    test('should create whitelist rules with correct parameters', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        async (ip) => {
          // Setup mock response
          mockedAxios.post.mockResolvedValue({
            data: { 
              success: true, 
              result: { id: 'new-rule-id' } 
            }
          });
          
          const ruleId = await cloudflareClient.createWhitelistRule(ip);
          
          // Should create rule with correct parameters
          expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              mode: 'whitelist',
              configuration: {
                target: 'ip',
                value: ip
              },
              notes: 'Bypass'
            }),
            expect.any(Object)
          );
          
          expect(ruleId).toBe('new-rule-id');
        }
      ), { numRuns: 20 });
    });
    
    test('should delete rules by ID correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // Rule ID
        async (ruleId) => {
          // Setup mock response
          mockedAxios.delete.mockResolvedValue({
            data: { success: true }
          });
          
          await cloudflareClient.deleteRule(ruleId);
          
          // Should delete rule with correct ID
          expect(mockedAxios.delete).toHaveBeenCalledWith(
            expect.stringContaining(ruleId),
            expect.any(Object)
          );
        }
      ), { numRuns: 15 });
    });
    
    test('should handle rule creation and deletion workflow', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        async (ip) => {
          // Setup mock responses for complete workflow
          mockedAxios.get.mockResolvedValue({
            data: { success: true, result: [{ id: 'existing-rule' }] }
          });
          mockedAxios.delete.mockResolvedValue({
            data: { success: true }
          });
          mockedAxios.post.mockResolvedValue({
            data: { success: true, result: { id: 'new-rule' } }
          });
          
          // Simulate complete workflow: check -> delete existing -> create new
          const existingRuleId = await cloudflareClient.findExistingRule(ip);
          if (existingRuleId) {
            await cloudflareClient.deleteRule(existingRuleId);
          }
          const newRuleId = await cloudflareClient.createWhitelistRule(ip);
          
          // Verify workflow calls
          expect(mockedAxios.get).toHaveBeenCalled(); // Check for existing
          expect(mockedAxios.delete).toHaveBeenCalled(); // Delete existing
          expect(mockedAxios.post).toHaveBeenCalled(); // Create new
          expect(newRuleId).toBe('new-rule');
        }
      ), { numRuns: 15 });
    });
  });
  
  describe('Rule Parameter Validation', () => {
    test('should always create rules with whitelist mode', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        async (ip) => {
          mockedAxios.post.mockResolvedValue({
            data: { success: true, result: { id: 'test-id' } }
          });
          
          await cloudflareClient.createWhitelistRule(ip);
          
          const callArgs = mockedAxios.post.mock.calls[0][1];
          expect(callArgs.mode).toBe('whitelist');
        }
      ), { numRuns: 15 });
    });
    
    test('should always set target to ip and include notes', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        async (ip) => {
          mockedAxios.post.mockResolvedValue({
            data: { success: true, result: { id: 'test-id' } }
          });
          
          await cloudflareClient.createWhitelistRule(ip);
          
          const callArgs = mockedAxios.post.mock.calls[0][1];
          expect(callArgs.configuration.target).toBe('ip');
          expect(callArgs.configuration.value).toBe(ip);
          expect(callArgs.notes).toBe('Bypass');
        }
      ), { numRuns: 15 });
    });
  });
  
  describe('Error Handling', () => {
    test('should handle Cloudflare API errors appropriately', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        fc.constantFrom('findExistingRule', 'createWhitelistRule', 'deleteRule'),
        async (ip, method) => {
          // Setup mock to return API error
          const apiError = {
            data: { 
              success: false, 
              errors: [{ code: 1001, message: 'Invalid request' }] 
            }
          };
          
          mockedAxios.get.mockResolvedValue(apiError);
          mockedAxios.post.mockResolvedValue(apiError);
          mockedAxios.delete.mockResolvedValue(apiError);
          
          // Different methods should handle errors appropriately
          switch (method) {
            case 'findExistingRule':
              // findExistingRule should not throw for API errors, just return null
              const result = await cloudflareClient.findExistingRule(ip);
              expect(result).toBeNull();
              break;
            case 'createWhitelistRule':
              await expect(cloudflareClient.createWhitelistRule(ip)).rejects.toThrow(/Cloudflare API error/);
              break;
            case 'deleteRule':
              await expect(cloudflareClient.deleteRule('test-id')).rejects.toThrow(/Cloudflare API error/);
              break;
          }
        }
      ), { numRuns: 15 });
    });
    
    test('should handle network errors gracefully', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        async (ip) => {
          // Setup mock to throw network error
          const networkError = new Error('Network timeout');
          mockedAxios.get.mockRejectedValue(networkError);
          mockedAxios.post.mockRejectedValue(networkError);
          mockedAxios.delete.mockRejectedValue(networkError);
          
          // All methods should throw for network errors
          await expect(cloudflareClient.findExistingRule(ip)).rejects.toThrow();
          await expect(cloudflareClient.createWhitelistRule(ip)).rejects.toThrow();
          await expect(cloudflareClient.deleteRule('test-id')).rejects.toThrow();
        }
      ), { numRuns: 10 });
    });
  });
  
  describe('IP Address Handling', () => {
    test('should handle various IP address formats correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.oneof(
          fc.ipV4(),
          fc.ipV6(),
          fc.string().filter(s => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s))
        ),
        async (ip) => {
          mockedAxios.get.mockResolvedValue({
            data: { success: true, result: [] }
          });
          mockedAxios.post.mockResolvedValue({
            data: { success: true, result: { id: 'test-id' } }
          });
          
          // Should handle various IP formats without throwing
          await expect(cloudflareClient.findExistingRule(ip)).resolves.toBeDefined();
          await expect(cloudflareClient.createWhitelistRule(ip)).resolves.toBeDefined();
          
          // Should pass the IP exactly as provided
          expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.stringContaining(ip),
            expect.any(Object)
          );
          expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              configuration: expect.objectContaining({
                value: ip
              })
            }),
            expect.any(Object)
          );
        }
      ), { numRuns: 15 });
    });
  });
});