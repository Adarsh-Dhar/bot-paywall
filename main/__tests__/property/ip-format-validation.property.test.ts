/**
 * **Feature: x402-payment-integration-fix, Property 22: Whitelist rules use proper IP format**
 * Property-based tests for IP format validation for Cloudflare API
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';
import { validateIPAddress, formatIPForCloudflare } from '@/lib/bot-payment-system/validation';
import { CloudflareClientImpl } from '@/lib/bot-payment-system/services/cloudflare-client';

// Mock fetch for Cloudflare API calls
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('IP Format Validation Property Tests', () => {
  let cloudflareClient: CloudflareClientImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    cloudflareClient = new CloudflareClientImpl('test-token', 'test-zone');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: x402-payment-integration-fix, Property 22: Whitelist rules use proper IP format**
   * Property: For any whitelist rule creation, the system should use the exact IP format required by Cloudflare API
   */
  it('should validate and format all IP addresses for Cloudflare API', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.ipV4(),
        async (ip) => {
          // Test IP validation
          const isValid = validateIPAddress(ip);
          
          if (isValid) {
            // Test IP formatting
            const formattedIP = formatIPForCloudflare(ip);
            
            // Verify formatted IP is still valid
            expect(validateIPAddress(formattedIP)).toBe(true);
            
            // Verify no leading zeros in octets
            const octets = formattedIP.split('.');
            octets.forEach(octet => {
              if (octet.length > 1) {
                expect(octet.startsWith('0')).toBe(false);
              }
            });
            
            // Verify each octet is properly formatted
            octets.forEach(octet => {
              const num = parseInt(octet);
              expect(num.toString()).toBe(octet);
              expect(num).toBeGreaterThanOrEqual(0);
              expect(num).toBeLessThanOrEqual(255);
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Removed hardcoded specific-IP property; validation already covered generically

  /**
   * Property: For any IP with leading zeros, formatting should remove them
   */
  it('should remove leading zeros from IP octets', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 })
        ),
        async ([a, b, c, d]) => {
          // Create IP with potential leading zeros
          const ipWithLeadingZeros = `${a.toString().padStart(3, '0')}.${b.toString().padStart(3, '0')}.${c.toString().padStart(3, '0')}.${d.toString().padStart(3, '0')}`;
          const expectedIP = `${a}.${b}.${c}.${d}`;
          
          // Skip if the padded version is invalid (would be rejected by validation)
          if (!validateIPAddress(ipWithLeadingZeros)) {
            return;
          }
          
          // Format the IP
          const formattedIP = formatIPForCloudflare(ipWithLeadingZeros);
          
          // Verify leading zeros are removed
          expect(formattedIP).toBe(expectedIP);
          
          // Verify no leading zeros remain
          const octets = formattedIP.split('.');
          octets.forEach(octet => {
            if (octet.length > 1) {
              expect(octet.startsWith('0')).toBe(false);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any invalid IP format, validation should fail
   */
  it('should reject invalid IP formats', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string().filter(s => !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s)), // Not IP format
          fc.constant('256.1.1.1'), // Invalid octet
          fc.constant('1.256.1.1'), // Invalid octet
          fc.constant('1.1.256.1'), // Invalid octet
          fc.constant('1.1.1.256'), // Invalid octet
          fc.constant('1.1.1'), // Missing octet
          fc.constant('1.1.1.1.1'), // Extra octet
          fc.constant(''), // Empty string
          fc.constant('abc.def.ghi.jkl') // Non-numeric
        ),
        async (invalidIP) => {
          const isValid = validateIPAddress(invalidIP);
          expect(isValid).toBe(false);
          
          // Formatting should throw an error for invalid IPs
          expect(() => formatIPForCloudflare(invalidIP)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any Cloudflare API call with IP, the IP should be properly formatted
   */
  it('should format IPs properly for Cloudflare API calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.ipV4(),
        async (ip) => {
          // Mock successful Cloudflare API response
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              result: {
                id: 'test-rule-id',
                mode: 'whitelist',
                configuration: {
                  target: 'ip',
                  value: formatIPForCloudflare(ip)
                },
                notes: 'test'
              }
            })
          } as Response);

          try {
            // Attempt to create access rule
            const result = await cloudflareClient.createAccessRule(ip, 'whitelist');
            
            // Verify the API was called with properly formatted IP
            expect(mockFetch).toHaveBeenCalledWith(
              expect.any(String),
              expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining(formatIPForCloudflare(ip))
              })
            );
            
            // Verify result contains properly formatted IP
            expect(result.configuration.value).toBe(formatIPForCloudflare(ip));
          } catch (error) {
            // If IP is invalid, expect validation error
            expect(validateIPAddress(ip)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any private IP addresses, validation should handle them based on environment
   */
  it('should handle private IP addresses based on environment settings', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.tuple(fc.constant(10), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 })),
          fc.tuple(fc.constant(172), fc.integer({ min: 16, max: 31 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 })),
          fc.tuple(fc.constant(192), fc.constant(168), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 })),
          fc.tuple(fc.constant(127), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
        ),
        async ([a, b, c, d]) => {
          const privateIP = `${a}.${b}.${c}.${d}`;
          
          // Save original environment
          const originalNodeEnv = process.env.NODE_ENV;
          const originalAllowPrivate = process.env.ALLOW_PRIVATE_IPS;
          
          try {
            // Test in development environment
            process.env.NODE_ENV = 'development';
            delete process.env.ALLOW_PRIVATE_IPS;
            
            const isValidInDev = validateIPAddress(privateIP);
            expect(isValidInDev).toBe(true); // Should be valid in development
            
            // Test in production environment without ALLOW_PRIVATE_IPS
            process.env.NODE_ENV = 'production';
            delete process.env.ALLOW_PRIVATE_IPS;
            
            const isValidInProd = validateIPAddress(privateIP);
            expect(isValidInProd).toBe(false); // Should be invalid in production
            
            // Test in production with ALLOW_PRIVATE_IPS=true
            process.env.ALLOW_PRIVATE_IPS = 'true';
            
            const isValidWithFlag = validateIPAddress(privateIP);
            expect(isValidWithFlag).toBe(true); // Should be valid with flag
            
          } finally {
            // Restore original environment
            if (originalNodeEnv !== undefined) {
              process.env.NODE_ENV = originalNodeEnv;
            } else {
              delete process.env.NODE_ENV;
            }
            
            if (originalAllowPrivate !== undefined) {
              process.env.ALLOW_PRIVATE_IPS = originalAllowPrivate;
            } else {
              delete process.env.ALLOW_PRIVATE_IPS;
            }
          }
        }
      ),
      { numRuns: 50 } // Reduced runs due to environment manipulation
    );
  });

  /**
   * Property: For any valid IP, formatting should be idempotent
   */
  it('should produce idempotent formatting results', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.ipV4().filter(ip => validateIPAddress(ip)),
        async (validIP) => {
          const formatted1 = formatIPForCloudflare(validIP);
          const formatted2 = formatIPForCloudflare(formatted1);
          const formatted3 = formatIPForCloudflare(formatted2);
          
          // Formatting should be idempotent
          expect(formatted1).toBe(formatted2);
          expect(formatted2).toBe(formatted3);
          
          // All results should be valid
          expect(validateIPAddress(formatted1)).toBe(true);
          expect(validateIPAddress(formatted2)).toBe(true);
          expect(validateIPAddress(formatted3)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});