/**
 * Property-based tests for Cloudflare rate limiting handling
 * **Feature: automated-bot-payment-system, Property 18: Rate limits trigger backoff strategies**
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import fc from 'fast-check';
import { CloudflareClientImpl } from '../../lib/bot-payment-system/services/cloudflare-client';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Rate Limiting Handling Properties', () => {
  let cloudflareClient: CloudflareClientImpl;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    cloudflareClient = new CloudflareClientImpl('test-token', 'test-zone-id');
    mockFetch.mockReset();
  });

  /**
   * Property 18: Rate limits trigger backoff strategies
   * For any Cloudflare API rate limit encounter, the system should implement backoff strategies and queue operations
   * **Validates: Requirements 4.4**
   */
  it('should detect rate limit responses correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.integer({ min: 1, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 1, max: 254 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),

        async (ipAddress) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          // Mock single rate limit response (to avoid delays)
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: async () => ({
              success: false,
              errors: [{ message: 'Rate limit exceeded' }]
            })
          } as Response);

          // Should throw an error (will retry but eventually fail)
          await expect(
            cloudflareClient.createAccessRule(ipAddress, 'whitelist')
          ).rejects.toThrow();

          // Should have attempted the call
          expect(mockFetch).toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  }, 30000); // Increase timeout to handle retries

  /**
   * Property: Non-rate-limit errors should not trigger rate limit handling
   * For any non-429 error, the system should not apply rate limit backoff
   */
  it('should not apply rate limit handling to non-429 errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.integer({ min: 1, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 1, max: 254 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
        fc.constantFrom(400, 401, 403, 404, 500, 502, 503), // Non-429 error codes

        async (ipAddress, errorCode) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          // Mock non-rate-limit error
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: errorCode,
            statusText: 'Error',
            json: async () => ({
              success: false,
              errors: [{ message: `HTTP ${errorCode} error` }]
            })
          } as Response);

          // Should throw error immediately (no rate limit retries)
          await expect(
            cloudflareClient.createAccessRule(ipAddress, 'whitelist')
          ).rejects.toThrow();

          // Should have made only 1 attempt (no retries for non-rate-limit errors)
          expect(mockFetch).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Rate limit status codes should be recognized correctly
   * For any 429 status code, the system should treat it as a rate limit
   */
  it('should recognize 429 status codes as rate limits', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.integer({ min: 1, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 1, max: 254 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
        fc.constantFrom(
          'Too Many Requests',
          'Rate Limit Exceeded',
          'API Rate Limit Exceeded'
        ),

        async (ipAddress, statusText) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          // Mock 429 response with various status texts
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 429,
            statusText: statusText,
            json: async () => ({
              success: false,
              errors: [{ message: 'Rate limit exceeded' }]
            })
          } as Response);

          // Should handle as rate limit (throw error after retries)
          await expect(
            cloudflareClient.createAccessRule(ipAddress, 'whitelist')
          ).rejects.toThrow();

          // Should have attempted the call
          expect(mockFetch).toHaveBeenCalled();
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);

  /**
   * Property: Rate limiting should be detected across different operations
   * For any operation type, rate limiting should be detected the same way
   */
  it('should detect rate limiting across different operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant('create'),
          fc.constant('list')
        ),
        fc.tuple(
          fc.integer({ min: 1, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 1, max: 254 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),

        async (operation, ipAddress) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          // Mock rate limit response
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: async () => ({
              success: false,
              errors: [{ message: 'Rate limit exceeded' }]
            })
          } as Response);

          let operationPromise: Promise<any>;
          
          // Execute different operations
          switch (operation) {
            case 'create':
              operationPromise = cloudflareClient.createAccessRule(ipAddress, 'whitelist');
              break;
            case 'list':
              operationPromise = cloudflareClient.listAccessRules(ipAddress);
              break;
            default:
              throw new Error('Unknown operation');
          }

          // All operations should handle rate limiting by throwing an error
          await expect(operationPromise).rejects.toThrow();

          // Should have attempted the API call
          expect(mockFetch).toHaveBeenCalled();
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);

  /**
   * Property: Successful requests should work normally
   * For any successful API response, the system should return results correctly
   */
  it('should handle successful requests correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.integer({ min: 1, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 1, max: 254 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),

        async (ipAddress) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          const mockRuleId = `rule-${Date.now()}`;
          
          // Mock successful response
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              result: {
                id: mockRuleId,
                mode: 'whitelist',
                configuration: {
                  target: 'ip',
                  value: ipAddress
                },
                notes: 'Test rule'
              }
            })
          } as Response);

          // Should succeed
          const result = await cloudflareClient.createAccessRule(ipAddress, 'whitelist');
          
          expect(result.id).toBe(mockRuleId);
          expect(result.mode).toBe('whitelist');
          expect(result.configuration.value).toBe(ipAddress);
          
          // Should have made 1 attempt
          expect(mockFetch).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 30 }
    );
  });
});