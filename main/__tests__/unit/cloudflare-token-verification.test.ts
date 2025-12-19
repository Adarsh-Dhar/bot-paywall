/**
 * Unit Tests for Cloudflare Token Verification Actions
 */

import { verifyCloudflareToken, lookupZoneId } from '@/app/actions/cloudflare-token-verification';
import { auth } from '@/lib/mock-auth';
import { getUserCloudflareToken } from '@/app/actions/cloudflare-tokens';

// Mock dependencies
jest.mock('@/lib/mock-auth');
jest.mock('@/app/actions/cloudflare-tokens');

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockGetUserCloudflareToken = getUserCloudflareToken as jest.MockedFunction<typeof getUserCloudflareToken>;

// Mock fetch
global.fetch = jest.fn();

describe('verifyCloudflareToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: 'user-123' });
    mockGetUserCloudflareToken.mockResolvedValue('mock-token');
  });

  test('should successfully verify active token', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        result: {
          status: 'active',
          policies: [
            {
              effect: 'allow',
              resources: 'zone:*',
              permission_groups: ['Zone.WAF:Edit']
            }
          ]
        }
      })
    });

    const result = await verifyCloudflareToken();

    expect(result.success).toBe(true);
    expect(result.status).toBe('active');
    expect(result.message).toBe('Token is active and valid');
    expect(result.permissions).toContain('allow:zone:*:Zone.WAF:Edit');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/user/tokens/verify',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock-token'
        })
      })
    );
  });

  test('should handle inactive token', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        result: {
          status: 'inactive'
        }
      })
    });

    const result = await verifyCloudflareToken();

    expect(result.success).toBe(true);
    expect(result.status).toBe('inactive');
    expect(result.message).toBe('Token status: inactive');
  });

  test('should handle API error response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        success: false,
        errors: [{ message: 'Invalid token' }]
      })
    });

    const result = await verifyCloudflareToken();

    expect(result.success).toBe(false);
    expect(result.message).toBe('Token verification failed: Invalid token');
    expect(result.error).toBe('VERIFICATION_FAILED');
  });

  test('should handle missing token', async () => {
    mockGetUserCloudflareToken.mockResolvedValue(null);

    const result = await verifyCloudflareToken();

    expect(result.success).toBe(false);
    expect(result.message).toContain('Cloudflare API token not found');
    expect(result.error).toBe('NO_TOKEN');
  });

  test('should handle unauthenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const result = await verifyCloudflareToken();

    expect(result.success).toBe(false);
    expect(result.message).toBe('User not authenticated');
    expect(result.error).toBe('UNAUTHORIZED');
  });
});

describe('lookupZoneId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: 'user-123' });
    mockGetUserCloudflareToken.mockResolvedValue('mock-token');
  });

  test('should successfully lookup zone ID', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        result: [
          {
            id: 'zone-123',
            name: 'example.com',
            status: 'active',
            name_servers: ['ns1.cloudflare.com', 'ns2.cloudflare.com']
          }
        ]
      })
    });

    const result = await lookupZoneId('example.com');

    expect(result.success).toBe(true);
    expect(result.zoneId).toBe('zone-123');
    expect(result.zoneName).toBe('example.com');
    expect(result.status).toBe('active');
    expect(result.nameservers).toEqual(['ns1.cloudflare.com', 'ns2.cloudflare.com']);
    expect(result.message).toBe('Zone found: example.com (zone-123) - Status: active');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/zones?name=example.com',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock-token'
        })
      })
    );
  });

  test('should handle zone not found', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        result: []
      })
    });

    const result = await lookupZoneId('nonexistent.com');

    expect(result.success).toBe(false);
    expect(result.message).toContain('No zone found for domain "nonexistent.com"');
    expect(result.error).toBe('ZONE_NOT_FOUND');
  });

  test('should validate domain format', async () => {
    const result = await lookupZoneId('invalid..domain');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid domain format');
    expect(result.error).toBe('VALIDATION_ERROR');
  });

  test('should handle empty domain', async () => {
    const result = await lookupZoneId('');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Domain is required');
    expect(result.error).toBe('VALIDATION_ERROR');
  });

  test('should handle API error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        success: false,
        errors: [{ message: 'Unauthorized' }]
      })
    });

    const result = await lookupZoneId('example.com');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Zone lookup failed: Unauthorized');
    expect(result.error).toBe('LOOKUP_FAILED');
  });

  test('should handle network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const result = await lookupZoneId('example.com');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Network error');
    expect(result.error).toBe('UNKNOWN_ERROR');
  });
});