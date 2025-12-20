/**
 * Property-based tests for Cloudflare whitelist rule creation
 * **Feature: automated-bot-payment-system, Property 5: Database entries trigger whitelist rule creation**
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import fc from 'fast-check';
import { CloudflareClientImpl } from '../../lib/bot-payment-system/services/cloudflare-client';
import { AccessRule } from '../../lib/bot-payment-system/types';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Whitelist Rule Creation Properties', () => {
  let cloudflareClient: CloudflareClientImpl;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    cloudflareClient = new CloudflareClientImpl('test-token', 'test-zone-id');
    mockFetch.mockReset();
  });

  /**
   * Property 5: Database entries trigger whitelist rule creation
   * For any IP address added to the database, the system should create a corresponding Cloudflare whitelist rule
   * **Validates: Requirements 1.5**
   */
  it('should create whitelist rule for any valid IP address', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid IP addresses
        fc.tuple(
          fc.integer({ min: 1, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 1, max: 254 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),

        async (ipAddress) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          // Mock successful API response
          const mockRuleId = `rule-${Date.now()}`;
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
                notes: 'Automated bot payment system - temporary access'
              }
            })
          } as Response);

          // Create whitelist rule
          const accessRule = await cloudflareClient.createAccessRule(ipAddress, 'whitelist');

          // Verify the rule was created correctly
          expect(accessRule.id).toBe(mockRuleId);
          expect(accessRule.mode).toBe('whitelist');
          expect(accessRule.configuration.target).toBe('ip');
          expect(accessRule.configuration.value).toBe(ipAddress);

          // Verify API was called with correct parameters
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/firewall/access_rules/rules'),
            expect.objectContaining({
              method: 'POST',
              headers: expect.objectContaining({
                'Authorization': 'Bearer test-token',
                'Content-Type': 'application/json'
              }),
              body: JSON.stringify({
                mode: 'whitelist',
                configuration: {
                  target: 'ip',
                  value: ipAddress
                },
                notes: 'Automated bot payment system - temporary access'
              })
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Duplicate IP addresses should reuse existing rules
   * For any IP address that already has a whitelist rule, creating another should return the existing rule
   */
  it('should reuse existing whitelist rules for duplicate IP addresses', async () => {
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
          
          const existingRuleId = `existing-rule-${Date.now()}`;
          
          // Mock first call to list rules (returns existing rule)
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              result: [{
                id: existingRuleId,
                mode: 'whitelist',
                configuration: {
                  target: 'ip',
                  value: ipAddress
                },
                notes: 'Existing rule'
              }]
            })
          } as Response);

          // Call ensureWhitelistRule which should find and return existing rule
          const rule = await cloudflareClient.ensureWhitelistRule(ipAddress);

          // Should return the existing rule
          expect(rule.id).toBe(existingRuleId);
          expect(rule.mode).toBe('whitelist');
          expect(rule.configuration.value).toBe(ipAddress);

          // Should have called list API but not create API
          expect(mockFetch).toHaveBeenCalledTimes(1);
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining(`configuration.value=${encodeURIComponent(ipAddress)}`),
            expect.objectContaining({
              method: 'GET'
            })
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Rule creation should handle various IP formats correctly
   * For any valid IP address format, the system should create appropriate rules
   */
  it('should handle various valid IP address formats', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Standard IPv4
          fc.tuple(
            fc.integer({ min: 1, max: 255 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 1, max: 254 })
          ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
          
          // Edge case IPs
          fc.constantFrom(
            '127.0.0.1',    // localhost
            '192.168.1.1',  // private network
            '10.0.0.1',     // private network
            '172.16.0.1'    // private network
          )
        ),

        async (ipAddress) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          const mockRuleId = `rule-${Date.now()}`;
          
          // Mock successful rule creation
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
                notes: 'Automated bot payment system - temporary access'
              }
            })
          } as Response);

          const rule = await cloudflareClient.createAccessRule(ipAddress, 'whitelist');

          expect(rule.configuration.value).toBe(ipAddress);
          expect(rule.mode).toBe('whitelist');
          expect(rule.id).toBe(mockRuleId);
          
          // Verify API was called with the correct IP
          expect(mockFetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              body: expect.stringContaining(`"value":"${ipAddress}"`)
            })
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: API errors should be properly handled and propagated
   * For any API error response, the system should throw appropriate errors
   */
  it('should handle API errors correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.integer({ min: 1, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 1, max: 254 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
        fc.constantFrom(400, 401, 403, 404, 500, 502, 503),
        fc.string({ minLength: 1, maxLength: 100 }),

        async (ipAddress, statusCode, errorMessage) => {
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
            cloudflareClient.createAccessRule(ipAddress, 'whitelist')
          ).rejects.toThrow();
        }
      ),
      { numRuns: 30 }
    );
  });
});