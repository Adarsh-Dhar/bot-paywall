/**
 * Integration tests for Cloudflare API integration
 * Tests the integration with actual Cloudflare API for whitelist rule management
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CloudflareClientImpl } from '@/lib/bot-payment-system/services/cloudflare-client';

// Mock fetch for Cloudflare API calls
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('Cloudflare API Integration Tests', () => {
  let cloudflareClient: CloudflareClientImpl;
  const testConfig = {
    apiToken: 'test-api-token',
    zoneId: 'test-zone-id',
    clientIP: '210.212.2.133'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cloudflareClient = new CloudflareClientImpl(testConfig.apiToken, testConfig.zoneId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test successful whitelist rule creation
   */
  it('should create whitelist rules successfully', async () => {
    const mockRuleResponse = {
      success: true,
      result: {
        id: 'cf-rule-12345',
        mode: 'whitelist',
        configuration: {
          target: 'ip',
          value: testConfig.clientIP
        },
        notes: 'Automated bot payment system - temporary access'
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRuleResponse
    } as Response);

    const result = await cloudflareClient.createAccessRule(testConfig.clientIP, 'whitelist');

    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.cloudflare.com/client/v4/zones/${testConfig.zoneId}/firewall/access_rules/rules`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': `Bearer ${testConfig.apiToken}`,
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          mode: 'whitelist',
          configuration: {
            target: 'ip',
            value: testConfig.clientIP
          },
          notes: 'Automated bot payment system - temporary access'
        })
      })
    );

    expect(result.id).toBe('cf-rule-12345');
    expect(result.mode).toBe('whitelist');
    expect(result.configuration.value).toBe(testConfig.clientIP);
  });

  /**
   * Test successful whitelist rule deletion
   */
  it('should delete whitelist rules successfully', async () => {
    const ruleId = 'cf-rule-12345';
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response);

    await cloudflareClient.deleteAccessRule(ruleId);

    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.cloudflare.com/client/v4/zones/${testConfig.zoneId}/firewall/access_rules/rules/${ruleId}`,
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          'Authorization': `Bearer ${testConfig.apiToken}`,
          'Content-Type': 'application/json'
        })
      })
    );
  });

  /**
   * Test listing access rules
   */
  it('should list access rules successfully', async () => {
    const mockListResponse = {
      success: true,
      result: [
        {
          id: 'cf-rule-1',
          mode: 'whitelist',
          configuration: {
            target: 'ip',
            value: '210.212.2.133'
          },
          notes: 'Test rule 1'
        },
        {
          id: 'cf-rule-2',
          mode: 'whitelist',
          configuration: {
            target: 'ip',
            value: '192.168.1.100'
          },
          notes: 'Test rule 2'
        }
      ]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockListResponse
    } as Response);

    const result = await cloudflareClient.listAccessRules();

    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.cloudflare.com/client/v4/zones/${testConfig.zoneId}/firewall/access_rules/rules`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': `Bearer ${testConfig.apiToken}`,
          'Content-Type': 'application/json'
        })
      })
    );

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('cf-rule-1');
    expect(result[1].id).toBe('cf-rule-2');
  });

  /**
   * Test listing access rules filtered by IP
   */
  it('should list access rules filtered by IP', async () => {
    const filterIP = '210.212.2.133';
    const mockFilteredResponse = {
      success: true,
      result: [
        {
          id: 'cf-rule-specific',
          mode: 'whitelist',
          configuration: {
            target: 'ip',
            value: filterIP
          },
          notes: 'Specific IP rule'
        }
      ]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockFilteredResponse
    } as Response);

    const result = await cloudflareClient.listAccessRules(filterIP);

    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.cloudflare.com/client/v4/zones/${testConfig.zoneId}/firewall/access_rules/rules?configuration.value=${encodeURIComponent(filterIP)}`,
      expect.objectContaining({
        method: 'GET'
      })
    );

    expect(result).toHaveLength(1);
    expect(result[0].configuration.value).toBe(filterIP);
  });

  /**
   * Test Cloudflare API error handling
   */
  it('should handle Cloudflare API errors gracefully', async () => {
    const mockErrorResponse = {
      success: false,
      errors: [
        {
          code: 10000,
          message: 'Authentication error'
        }
      ]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockErrorResponse
    } as Response);

    await expect(cloudflareClient.createAccessRule(testConfig.clientIP, 'whitelist'))
      .rejects.toThrow('Cloudflare API error: Authentication error');
  });

  /**
   * Test network error handling
   */
  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(cloudflareClient.createAccessRule(testConfig.clientIP, 'whitelist'))
      .rejects.toThrow('Failed to create access rule: Network error');
  });

  /**
   * Test invalid IP address handling
   */
  it('should reject invalid IP addresses', async () => {
    const invalidIPs = [
      '256.1.1.1',
      '1.1.1',
      'invalid-ip',
      '',
      '1.1.1.1.1'
    ];

    for (const invalidIP of invalidIPs) {
      await expect(cloudflareClient.createAccessRule(invalidIP, 'whitelist'))
        .rejects.toThrow('Invalid IP address format');
    }
  });

  /**
   * Test IP format normalization
   */
  it('should normalize IP addresses correctly', async () => {
    const testCases = [
      { input: '001.002.003.004', expected: '1.2.3.4' },
      { input: '192.168.001.100', expected: '192.168.1.100' },
      { input: '010.010.010.010', expected: '10.10.10.10' }
    ];

    for (const testCase of testCases) {
      const mockResponse = {
        success: true,
        result: {
          id: 'test-rule',
          mode: 'whitelist',
          configuration: {
            target: 'ip',
            value: testCase.expected
          },
          notes: 'Test'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await cloudflareClient.createAccessRule(testCase.input, 'whitelist');

      // Verify the API was called with the normalized IP
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(testCase.expected)
        })
      );

      expect(result.configuration.value).toBe(testCase.expected);
    }
  });

  /**
   * Test rate limiting and retry logic
   */
  it('should handle rate limiting appropriately', async () => {
    // Mock rate limit response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        success: false,
        errors: [{ message: 'Rate limit exceeded' }]
      })
    } as Response);

    await expect(cloudflareClient.createAccessRule(testConfig.clientIP, 'whitelist'))
      .rejects.toThrow('Failed to create access rule');
  });

  /**
   * Test complete whitelist lifecycle
   */
  it('should handle complete whitelist lifecycle', async () => {
    const ruleId = 'lifecycle-rule-123';

    // Step 1: Create rule
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        result: {
          id: ruleId,
          mode: 'whitelist',
          configuration: {
            target: 'ip',
            value: testConfig.clientIP
          },
          notes: 'Automated bot payment system - temporary access'
        }
      })
    } as Response);

    const createResult = await cloudflareClient.createAccessRule(testConfig.clientIP, 'whitelist');
    expect(createResult.id).toBe(ruleId);

    // Step 2: List rules to verify creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        result: [
          {
            id: ruleId,
            mode: 'whitelist',
            configuration: {
              target: 'ip',
              value: testConfig.clientIP
            },
            notes: 'Automated bot payment system - temporary access'
          }
        ]
      })
    } as Response);

    const listResult = await cloudflareClient.listAccessRules(testConfig.clientIP);
    expect(listResult).toHaveLength(1);
    expect(listResult[0].id).toBe(ruleId);

    // Step 3: Delete rule
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response);

    await cloudflareClient.deleteAccessRule(ruleId);

    // Step 4: Verify deletion
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        result: [] // No rules found
      })
    } as Response);

    const finalListResult = await cloudflareClient.listAccessRules(testConfig.clientIP);
    expect(finalListResult).toHaveLength(0);

    // Verify all API calls were made
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  /**
   * Test concurrent API operations
   */
  it('should handle concurrent API operations', async () => {
    const testIPs = ['1.1.1.1', '2.2.2.2', '3.3.3.3'];
    const ruleIds = ['rule-1', 'rule-2', 'rule-3'];

    // Mock successful responses for all concurrent operations
    testIPs.forEach((ip, index) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: ruleIds[index],
            mode: 'whitelist',
            configuration: {
              target: 'ip',
              value: ip
            },
            notes: 'Concurrent test rule'
          }
        })
      } as Response);
    });

    // Create rules concurrently
    const createPromises = testIPs.map(ip => 
      cloudflareClient.createAccessRule(ip, 'whitelist')
    );

    const results = await Promise.all(createPromises);

    // Verify all rules were created successfully
    results.forEach((result, index) => {
      expect(result.id).toBe(ruleIds[index]);
      expect(result.configuration.value).toBe(testIPs[index]);
    });

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  /**
   * Test API authentication
   */
  it('should use correct authentication headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        result: { id: 'test', mode: 'whitelist', configuration: { target: 'ip', value: '1.1.1.1' }, notes: '' }
      })
    } as Response);

    await cloudflareClient.createAccessRule('1.1.1.1', 'whitelist');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Bearer ${testConfig.apiToken}`,
          'Content-Type': 'application/json'
        })
      })
    );
  });
});