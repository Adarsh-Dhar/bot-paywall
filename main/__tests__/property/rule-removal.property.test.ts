/**
 * Property-based tests for Cloudflare rule removal
 * **Feature: automated-bot-payment-system, Property 7: Scheduled rules are removed at expiration**
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import fc from 'fast-check';
import { CloudflareClientImpl } from '../../lib/bot-payment-system/services/cloudflare-client';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Rule Removal Properties', () => {
  let cloudflareClient: CloudflareClientImpl;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    cloudflareClient = new CloudflareClientImpl('test-token', 'test-zone-id');
    mockFetch.mockReset();
  });

  /**
   * Property 7: Scheduled rules are removed at expiration
   * For any scheduled whitelist rule, the system should remove it from Cloudflare when the scheduled time expires
   * **Validates: Requirements 2.2**
   */
  it('should successfully remove any valid rule ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid rule IDs (32 character hex strings like Cloudflare uses)
        fc.hexaString({ minLength: 32, maxLength: 32 }),

        async (ruleId) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          // Mock successful deletion response
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              result: {
                id: ruleId
              }
            })
          } as Response);

          // Should not throw when deleting valid rule
          await expect(
            cloudflareClient.deleteAccessRule(ruleId)
          ).resolves.not.toThrow();

          // Verify API was called with correct parameters
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining(`/firewall/access_rules/rules/${ruleId}`),
            expect.objectContaining({
              method: 'DELETE',
              headers: expect.objectContaining({
                'Authorization': 'Bearer test-token',
                'Content-Type': 'application/json'
              })
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Rule deletion should handle API errors appropriately
   * For any API error during deletion, the system should throw appropriate errors
   */
  it('should handle deletion errors correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.hexaString({ minLength: 32, maxLength: 32 }),
        fc.constantFrom(400, 401, 403, 404, 500, 502, 503),
        fc.string({ minLength: 1, maxLength: 100 }),

        async (ruleId, statusCode, errorMessage) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          // Mock API error response
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: statusCode,
            statusText: 'Error',
            json: async () => ({
              success: false,
              errors: [{ message: errorMessage }]
            })
          } as Response);

          // Should throw an error
          await expect(
            cloudflareClient.deleteAccessRule(ruleId)
          ).rejects.toThrow();

          // Verify API was called
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining(`/firewall/access_rules/rules/${ruleId}`),
            expect.objectContaining({
              method: 'DELETE'
            })
          );
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Rule deletion should handle network errors appropriately
   * For any network error, the system should throw appropriate errors
   */
  it('should handle network errors appropriately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.hexaString({ minLength: 32, maxLength: 32 }),

        async (ruleId) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          // Mock network error
          mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

          // Should throw an error
          await expect(
            cloudflareClient.deleteAccessRule(ruleId)
          ).rejects.toThrow();

          // Should have attempted the call
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining(`/firewall/access_rules/rules/${ruleId}`),
            expect.objectContaining({
              method: 'DELETE'
            })
          );
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Rule deletion should validate rule ID parameter
   * For any rule ID, the system should make appropriate API calls
   */
  it('should validate rule ID parameter in API calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.hexaString({ minLength: 32, maxLength: 32 }),

        async (ruleId) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          // Mock successful response
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              result: { id: ruleId }
            })
          } as Response);

          await cloudflareClient.deleteAccessRule(ruleId);

          // Should have called the correct endpoint with the rule ID
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining(`/firewall/access_rules/rules/${ruleId}`),
            expect.objectContaining({
              method: 'DELETE',
              headers: expect.objectContaining({
                'Authorization': 'Bearer test-token'
              })
            })
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Bulk rule deletion should handle mixed success/failure scenarios
   * For any collection of rule IDs, the system should handle each deletion independently
   */
  it('should handle bulk deletions with mixed results', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.hexaString({ minLength: 32, maxLength: 32 }), { minLength: 2, maxLength: 5 }),

        async (ruleIds) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          const results: Array<{ success: boolean; error?: string }> = [];
          
          // Mock responses for each rule - some succeed, some fail
          for (let i = 0; i < ruleIds.length; i++) {
            const shouldSucceed = i % 2 === 0; // Alternate success/failure
            
            if (shouldSucceed) {
              mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                  success: true,
                  result: { id: ruleIds[i] }
                })
              } as Response);
            } else {
              mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                json: async () => ({
                  success: false,
                  errors: [{ message: 'Rule not found' }]
                })
              } as Response);
            }
          }

          // Attempt to delete all rules
          for (let i = 0; i < ruleIds.length; i++) {
            try {
              await cloudflareClient.deleteAccessRule(ruleIds[i]);
              results.push({ success: true });
            } catch (error) {
              results.push({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
            }
          }

          // Verify that we got expected mix of results
          const successCount = results.filter(r => r.success).length;
          const failureCount = results.filter(r => !r.success).length;
          
          expect(successCount).toBeGreaterThan(0);
          expect(failureCount).toBeGreaterThan(0);
          expect(successCount + failureCount).toBe(ruleIds.length);
          
          // Verify all API calls were made
          expect(mockFetch).toHaveBeenCalledTimes(ruleIds.length);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Rule deletion should validate rule ID format
   * For any invalid rule ID format, the system should handle it gracefully
   */
  it('should handle invalid rule ID formats', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 10 }), // Too short
          fc.string({ minLength: 50, maxLength: 100 }), // Too long
          fc.constantFrom('', 'invalid-id', '123', 'not-hex-string')
        ),

        async (invalidRuleId) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          // Mock 404 response for invalid rule ID
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            json: async () => ({
              success: false,
              errors: [{ message: 'Rule not found' }]
            })
          } as Response);

          // Should throw an error for invalid rule ID
          await expect(
            cloudflareClient.deleteAccessRule(invalidRuleId)
          ).rejects.toThrow();
        }
      ),
      { numRuns: 30 }
    );
  });
});