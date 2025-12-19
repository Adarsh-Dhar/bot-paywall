/**
 * Unit Tests for Cloudflare Skip Rule Server Action
 * Requirements: 4.1, 4.2, 4.3
 */

import { deploySkipRule, testSkipRule } from '@/app/actions/cloudflare-skip-rule';
import { auth } from '@/lib/mock-auth';
import { getUserCloudflareToken } from '@/app/actions/cloudflare-tokens';
import { deployWAFRule } from '@/lib/cloudflare-api';

// Mock dependencies
jest.mock('@/lib/mock-auth');
jest.mock('@/app/actions/cloudflare-tokens');
jest.mock('@/lib/cloudflare-api');

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockGetUserCloudflareToken = getUserCloudflareToken as jest.MockedFunction<typeof getUserCloudflareToken>;
const mockDeployWAFRule = deployWAFRule as jest.MockedFunction<typeof deployWAFRule>;

// Mock fetch for testSkipRule
global.fetch = jest.fn();

describe('deploySkipRule', () => {
  const validInput = {
    domain: 'example.com',
    zoneId: 'zone-123',
    secretKey: 'gk_live_' + 'a'.repeat(32),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: 'user-123' });
    mockGetUserCloudflareToken.mockResolvedValue('mock-token');
    mockDeployWAFRule.mockResolvedValue({
      success: true,
      result: { id: 'rule-123' },
    });
  });

  test('should successfully deploy skip rule with valid input', async () => {
    const result = await deploySkipRule(
      validInput.domain,
      validInput.zoneId,
      validInput.secretKey
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('Skip rule deployed successfully');
    expect(result.message).toContain('X-Bot-Auth header');
    expect(result.ruleId).toBe('rule-123');
    expect(mockDeployWAFRule).toHaveBeenCalledWith(
      validInput.zoneId,
      validInput.secretKey,
      'mock-token'
    );
  });

  test('should return error when user not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const result = await deploySkipRule(
      validInput.domain,
      validInput.zoneId,
      validInput.secretKey
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('User not authenticated');
    expect(result.error).toBe('UNAUTHORIZED');
  });

  test('should return error when Cloudflare token not found', async () => {
    mockGetUserCloudflareToken.mockResolvedValue(null);

    const result = await deploySkipRule(
      validInput.domain,
      validInput.zoneId,
      validInput.secretKey
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Cloudflare API token not found');
    expect(result.error).toBe('NO_TOKEN');
  });

  test('should validate input and return validation errors', async () => {
    const result = await deploySkipRule('', '', 'short');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid input');
    expect(result.error).toBe('VALIDATION_ERROR');
  });

  test('should handle Cloudflare API authentication errors', async () => {
    mockDeployWAFRule.mockRejectedValue(new Error('401 Unauthorized'));

    const result = await deploySkipRule(
      validInput.domain,
      validInput.zoneId,
      validInput.secretKey
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Cloudflare API authentication failed');
    expect(result.error).toBe('AUTH_ERROR');
  });

  test('should handle general errors', async () => {
    mockDeployWAFRule.mockRejectedValue(new Error('Network error'));

    const result = await deploySkipRule(
      validInput.domain,
      validInput.zoneId,
      validInput.secretKey
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('Network error');
    expect(result.error).toBe('UNKNOWN_ERROR');
  });
});

describe('testSkipRule', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return success when test request passes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const result = await testSkipRule('example.com', 'gk_live_test123');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Skip rule is working');
    expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
      method: 'HEAD',
      headers: {
        'X-Bot-Auth': 'gk_live_test123',
        'User-Agent': 'Gatekeeper-Test-Bot/1.0',
      },
    });
  });

  test('should return failure when test request fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    const result = await testSkipRule('example.com', 'gk_live_test123');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Test failed with status 403');
  });

  test('should handle network errors during test', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await testSkipRule('example.com', 'gk_live_test123');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Test failed: Network error');
  });
});