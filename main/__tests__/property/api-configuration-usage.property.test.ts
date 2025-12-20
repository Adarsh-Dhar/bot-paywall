/**
 * Property-based tests for Cloudflare API configuration usage
 * **Feature: automated-bot-payment-system, Property 22: Cloudflare API calls use existing tokens**
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import fc from 'fast-check';
import { CloudflareClientImpl } from '../../lib/bot-payment-system/services/cloudflare-client';

// Mock fetch for testing
global.fetch = jest.fn();

describe('API Configuration Usage Properties', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockFetch.mockReset();
  });

  /**
   * Property 22: Cloudflare API calls use existing tokens
   * For any Cloudflare API call, the system should use existing API tokens and zone configurations
   * **Validates: Requirements 5.3**
   */
  it('should use provided API tokens and zone IDs in all requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid API tokens (simulate Cloudflare token format)
        fc.string({ minLength: 40, maxLength: 40 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'A')),
        // Generate valid zone IDs (32 character hex strings)
        fc.hexaString({ minLength: 32, maxLength: 32 }),
        // Generate valid IP addresses
        fc.tuple(
          fc.integer({ min: 1, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 1, max: 254 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),

        async (apiToken, zoneId, ipAddress) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          // Create client with specific configuration
          const client = new CloudflareClientImpl(apiToken, zoneId);
          
          // Mock successful API response
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              result: {
                id: 'test-rule-id',
                mode: 'whitelist',
                configuration: {
                  target: 'ip',
                  value: ipAddress
                },
                notes: 'Test rule'
              }
            })
          } as Response);

          // Make API call
          await client.createAccessRule(ipAddress, 'whitelist');

          // Verify the API call used the correct configuration
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining(`/zones/${zoneId}/firewall/access_rules/rules`),
            expect.objectContaining({
              method: 'POST',
              headers: expect.objectContaining({
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
              })
            })
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: API configuration should be consistent across different operations
   * For any client instance, all operations should use the same configuration
   */
  it('should use consistent configuration across different operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 40, maxLength: 40 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'A')),
        fc.hexaString({ minLength: 32, maxLength: 32 }),
        fc.tuple(
          fc.integer({ min: 1, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 1, max: 254 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
        fc.hexaString({ minLength: 32, maxLength: 32 }),

        async (apiToken, zoneId, ipAddress, ruleId) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          const client = new CloudflareClientImpl(apiToken, zoneId);
          
          // Mock responses for different operations
          mockFetch
            .mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                success: true,
                result: []
              })
            } as Response)
            .mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                success: true,
                result: { id: ruleId }
              })
            } as Response);

          // Perform different operations
          await client.listAccessRules();
          await client.deleteAccessRule(ruleId);

          // Verify both calls used the same configuration
          expect(mockFetch).toHaveBeenNthCalledWith(1,
            expect.stringContaining(`/zones/${zoneId}/firewall/access_rules/rules`),
            expect.objectContaining({
              headers: expect.objectContaining({
                'Authorization': `Bearer ${apiToken}`
              })
            })
          );

          expect(mockFetch).toHaveBeenNthCalledWith(2,
            expect.stringContaining(`/zones/${zoneId}/firewall/access_rules/rules/${ruleId}`),
            expect.objectContaining({
              headers: expect.objectContaining({
                'Authorization': `Bearer ${apiToken}`
              })
            })
          );
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Environment variable configuration should be used when no explicit config provided
   * For any client created without explicit configuration, it should use environment variables
   */
  it('should use environment variables when no explicit configuration provided', async () => {
    // Save original env vars
    const originalToken = process.env.CLOUDFLARE_API_TOKEN;
    const originalZone = process.env.CLOUDFLARE_ZONE_ID;

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 40, maxLength: 40 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'A')),
        fc.hexaString({ minLength: 32, maxLength: 32 }),
        fc.tuple(
          fc.integer({ min: 1, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 1, max: 254 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),

        async (envToken, envZoneId, ipAddress) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          // Set environment variables
          process.env.CLOUDFLARE_API_TOKEN = envToken;
          process.env.CLOUDFLARE_ZONE_ID = envZoneId;
          
          // Create client without explicit configuration
          const client = new CloudflareClientImpl();
          
          // Mock successful API response
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              result: {
                id: 'test-rule-id',
                mode: 'whitelist',
                configuration: {
                  target: 'ip',
                  value: ipAddress
                },
                notes: 'Test rule'
              }
            })
          } as Response);

          // Make API call
          await client.createAccessRule(ipAddress, 'whitelist');

          // Verify the API call used the environment configuration
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining(`/zones/${envZoneId}/firewall/access_rules/rules`),
            expect.objectContaining({
              headers: expect.objectContaining({
                'Authorization': `Bearer ${envToken}`
              })
            })
          );
        }
      ),
      { numRuns: 20 }
    );

    // Restore original env vars
    if (originalToken) {
      process.env.CLOUDFLARE_API_TOKEN = originalToken;
    } else {
      delete process.env.CLOUDFLARE_API_TOKEN;
    }
    
    if (originalZone) {
      process.env.CLOUDFLARE_ZONE_ID = originalZone;
    } else {
      delete process.env.CLOUDFLARE_ZONE_ID;
    }
  });

  /**
   * Property: Configuration validation should detect invalid configurations
   * For any invalid configuration, the validation should return appropriate errors
   */
  it('should validate configuration and detect invalid settings', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 10 }), // Too short zone ID
          fc.string({ minLength: 50, maxLength: 100 }), // Too long zone ID
          fc.string({ minLength: 32, maxLength: 32 }).filter(s => !/^[a-f0-9]+$/i.test(s)), // Non-hex zone ID
        ),

        async (invalidZoneId) => {
          // Use a valid token but invalid zone ID
          const client = new CloudflareClientImpl('validtoken123456789012345678901234567890', invalidZoneId);
          
          const validation = client.validateConfiguration();
          
          // Should detect invalid configuration
          expect(validation.valid).toBe(false);
          expect(validation.errors.length).toBeGreaterThan(0);
          
          // Should contain zone-related error message
          const errorText = validation.errors.join(' ').toLowerCase();
          expect(errorText).toContain('zone');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Valid configuration should pass validation
   * For any valid configuration, the validation should succeed
   */
  it('should pass validation for valid configurations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 40, maxLength: 40 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'A')),
        fc.hexaString({ minLength: 32, maxLength: 32 }),

        async (validToken, validZoneId) => {
          const client = new CloudflareClientImpl(validToken, validZoneId);
          
          const validation = client.validateConfiguration();
          
          // Should pass validation
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Connection testing should use configuration correctly
   * For any configuration, connection testing should make appropriate API calls
   */
  it('should use configuration correctly in connection testing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 40, maxLength: 40 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'A')),
        fc.hexaString({ minLength: 32, maxLength: 32 }),

        async (apiToken, zoneId) => {
          // Reset mock for this iteration
          mockFetch.mockReset();
          
          const client = new CloudflareClientImpl(apiToken, zoneId);
          
          // Mock successful connection test
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              result: []
            })
          } as Response);

          const result = await client.testConnection();
          
          expect(result.success).toBe(true);
          
          // Verify the connection test used the correct configuration
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining(`/zones/${zoneId}/firewall/access_rules/rules`),
            expect.objectContaining({
              headers: expect.objectContaining({
                'Authorization': `Bearer ${apiToken}`
              })
            })
          );
        }
      ),
      { numRuns: 30 }
    );
  });
});