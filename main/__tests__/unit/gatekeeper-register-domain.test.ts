/**
 * Unit Tests for registerDomain Server Action
 * Requirements: 1.2, 1.3, 1.4
 */

import { registerDomain } from '@/app/actions/gatekeeper';
import * as cloudflareApi from '@/lib/cloudflare-api';
import * as secretKeyGen from '@/lib/secret-key-generator';
import { supabaseAdmin } from '@/lib/supabase-client';
import { auth } from '@clerk/nextjs/server';

// Mock dependencies
jest.mock('@clerk/nextjs/server');
jest.mock('@/lib/cloudflare-api');
jest.mock('@/lib/secret-key-generator');
jest.mock('@/lib/supabase-client');

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockCreateCloudflareZone = cloudflareApi.createCloudflareZone as jest.MockedFunction<typeof cloudflareApi.createCloudflareZone>;
const mockGenerateSecretKey = secretKeyGen.generateSecretKey as jest.MockedFunction<typeof secretKeyGen.generateSecretKey>;

describe('registerDomain Server Action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should reject unauthenticated users', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any);

    const result = await registerDomain('example.com');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not authenticated');
  });

  test('should reject invalid domain format', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

    const invalidDomains = [
      'invalid',
      'domain..com',
      '.com',
      'domain.',
      'domain .com',
      '',
    ];

    for (const domain of invalidDomains) {
      const result = await registerDomain(domain);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid domain format');
    }
  });

  test('should accept valid domain formats', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any);
    mockGenerateSecretKey.mockReturnValue('gk_live_' + 'a'.repeat(32));
    mockCreateCloudflareZone.mockResolvedValue({
      success: true,
      result: {
        id: 'zone-123',
        name: 'example.com',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
        status: 'pending',
      },
    });

    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'project-123',
              user_id: 'user-123',
              name: 'example.com',
              zone_id: 'zone-123',
              nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
              status: 'pending_ns',
              secret_key: 'gk_live_' + 'a'.repeat(32),
            },
            error: null,
          }),
        }),
      }),
    });

    const validDomains = [
      'example.com',
      'sub.example.com',
      'my-domain.co.uk',
      'test123.org',
    ];

    for (const domain of validDomains) {
      const result = await registerDomain(domain);
      expect(result.success).toBe(true);
      expect(result.zone_id).toBe('zone-123');
      expect(result.nameservers).toEqual(['ns1.cloudflare.com', 'ns2.cloudflare.com']);
    }
  });

  test('should generate a secret key', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any);
    mockGenerateSecretKey.mockReturnValue('gk_live_' + 'b'.repeat(32));
    mockCreateCloudflareZone.mockResolvedValue({
      success: true,
      result: {
        id: 'zone-123',
        name: 'example.com',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
        status: 'pending',
      },
    });

    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'project-123',
              user_id: 'user-123',
              name: 'example.com',
              zone_id: 'zone-123',
              nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
              status: 'pending_ns',
              secret_key: 'gk_live_' + 'b'.repeat(32),
            },
            error: null,
          }),
        }),
      }),
    });

    const result = await registerDomain('example.com');

    expect(mockGenerateSecretKey).toHaveBeenCalled();
    expect(result.secret_key).toBe('gk_live_' + 'b'.repeat(32));
  });

  test('should call Cloudflare API with correct parameters', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any);
    mockGenerateSecretKey.mockReturnValue('gk_live_' + 'c'.repeat(32));
    mockCreateCloudflareZone.mockResolvedValue({
      success: true,
      result: {
        id: 'zone-123',
        name: 'example.com',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
        status: 'pending',
      },
    });

    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'project-123',
              user_id: 'user-123',
              name: 'example.com',
              zone_id: 'zone-123',
              nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
              status: 'pending_ns',
              secret_key: 'gk_live_' + 'c'.repeat(32),
            },
            error: null,
          }),
        }),
      }),
    });

    await registerDomain('example.com');

    expect(mockCreateCloudflareZone).toHaveBeenCalledWith('example.com');
  });

  test('should handle Cloudflare API errors', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any);
    mockGenerateSecretKey.mockReturnValue('gk_live_' + 'd'.repeat(32));
    mockCreateCloudflareZone.mockRejectedValue(new Error('Cloudflare API error'));

    const result = await registerDomain('example.com');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cloudflare API error');
  });

  test('should handle database insertion errors', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any);
    mockGenerateSecretKey.mockReturnValue('gk_live_' + 'e'.repeat(32));
    mockCreateCloudflareZone.mockResolvedValue({
      success: true,
      result: {
        id: 'zone-123',
        name: 'example.com',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
        status: 'pending',
      },
    });

    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Database error'),
          }),
        }),
      }),
    });

    const result = await registerDomain('example.com');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to save project');
  });

  test('should return nameservers from Cloudflare response', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any);
    mockGenerateSecretKey.mockReturnValue('gk_live_' + 'f'.repeat(32));
    const nameservers = ['ns1.cloudflare.com', 'ns2.cloudflare.com', 'ns3.cloudflare.com'];
    mockCreateCloudflareZone.mockResolvedValue({
      success: true,
      result: {
        id: 'zone-123',
        name: 'example.com',
        nameservers: nameservers,
        status: 'pending',
      },
    });

    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'project-123',
              user_id: 'user-123',
              name: 'example.com',
              zone_id: 'zone-123',
              nameservers: nameservers,
              status: 'pending_ns',
              secret_key: 'gk_live_' + 'f'.repeat(32),
            },
            error: null,
          }),
        }),
      }),
    });

    const result = await registerDomain('example.com');

    expect(result.nameservers).toEqual(nameservers);
  });
});
