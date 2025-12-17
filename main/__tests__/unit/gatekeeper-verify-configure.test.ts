/**
 * Unit Tests for verifyAndConfigure Server Action
 * Requirements: 3.1, 3.3, 3.4, 4.1
 */

import { verifyAndConfigure } from '@/app/actions/gatekeeper';
import * as cloudflareApi from '@/lib/cloudflare-api';
import { supabaseAdmin } from '@/lib/supabase-client';
import { auth } from '@clerk/nextjs/server';

// Mock dependencies
jest.mock('@clerk/nextjs/server');
jest.mock('@/lib/cloudflare-api');
jest.mock('@/lib/supabase-client');

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockGetCloudflareZoneStatus = cloudflareApi.getCloudflareZoneStatus as jest.MockedFunction<typeof cloudflareApi.getCloudflareZoneStatus>;
const mockGetOrCreateRuleset = cloudflareApi.getOrCreateRuleset as jest.MockedFunction<typeof cloudflareApi.getOrCreateRuleset>;
const mockDeployWAFRule = cloudflareApi.deployWAFRule as jest.MockedFunction<typeof cloudflareApi.deployWAFRule>;

describe('verifyAndConfigure Server Action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should reject unauthenticated users', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any);

    const result = await verifyAndConfigure('project-123');

    expect(result.status).toBe('error');
    expect(result.message).toContain('not authenticated');
  });

  test('should return error if project not found', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Not found'),
          }),
        }),
      }),
    });

    const result = await verifyAndConfigure('project-123');

    expect(result.status).toBe('error');
    expect(result.message).toContain('Project not found');
  });

  test('should reject unauthorized user access', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'project-123',
              user_id: 'different-user',
              name: 'example.com',
              zone_id: 'zone-123',
              status: 'pending_ns',
              secret_key: 'gk_live_' + 'a'.repeat(32),
            },
            error: null,
          }),
        }),
      }),
    });

    const result = await verifyAndConfigure('project-123');

    expect(result.status).toBe('error');
    expect(result.message).toContain('Unauthorized');
  });

  test('should return pending if zone is not active', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'project-123',
              user_id: 'user-123',
              name: 'example.com',
              zone_id: 'zone-123',
              status: 'pending_ns',
              secret_key: 'gk_live_' + 'b'.repeat(32),
            },
            error: null,
          }),
        }),
      }),
    });

    mockGetCloudflareZoneStatus.mockResolvedValue({
      success: true,
      result: {
        id: 'zone-123',
        name: 'example.com',
        status: 'pending',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      },
    });

    const result = await verifyAndConfigure('project-123');

    expect(result.status).toBe('pending');
    expect(result.message).toContain('Nameservers not yet updated');
  });

  test('should deploy WAF rule when zone is active', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'project-123',
              user_id: 'user-123',
              name: 'example.com',
              zone_id: 'zone-123',
              status: 'pending_ns',
              secret_key: 'gk_live_' + 'c'.repeat(32),
            },
            error: null,
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    mockGetCloudflareZoneStatus.mockResolvedValue({
      success: true,
      result: {
        id: 'zone-123',
        name: 'example.com',
        status: 'active',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      },
    });

    mockGetOrCreateRuleset.mockResolvedValue('ruleset-123');

    mockDeployWAFRule.mockResolvedValue({
      success: true,
      result: {
        id: 'ruleset-123',
        rules: [],
      },
    });

    const result = await verifyAndConfigure('project-123');

    expect(mockGetOrCreateRuleset).toHaveBeenCalledWith('zone-123');
    expect(mockDeployWAFRule).toHaveBeenCalledWith(
      'zone-123',
      'ruleset-123',
      'gk_live_' + 'c'.repeat(32)
    );
  });

  test('should update project status to protected on success', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

    const updateMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        error: null,
      }),
    });

    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'project-123',
              user_id: 'user-123',
              name: 'example.com',
              zone_id: 'zone-123',
              status: 'pending_ns',
              secret_key: 'gk_live_' + 'd'.repeat(32),
            },
            error: null,
          }),
        }),
      }),
      update: updateMock,
    });

    mockGetCloudflareZoneStatus.mockResolvedValue({
      success: true,
      result: {
        id: 'zone-123',
        name: 'example.com',
        status: 'active',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      },
    });

    mockGetOrCreateRuleset.mockResolvedValue('ruleset-123');

    mockDeployWAFRule.mockResolvedValue({
      success: true,
      result: {
        id: 'ruleset-123',
        rules: [],
      },
    });

    const result = await verifyAndConfigure('project-123');

    expect(updateMock).toHaveBeenCalledWith({ status: 'protected' });
    expect(result.status).toBe('success');
    expect(result.protected).toBe(true);
  });

  test('should handle WAF deployment errors', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'project-123',
              user_id: 'user-123',
              name: 'example.com',
              zone_id: 'zone-123',
              status: 'pending_ns',
              secret_key: 'gk_live_' + 'e'.repeat(32),
            },
            error: null,
          }),
        }),
      }),
    });

    mockGetCloudflareZoneStatus.mockResolvedValue({
      success: true,
      result: {
        id: 'zone-123',
        name: 'example.com',
        status: 'active',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      },
    });

    mockGetOrCreateRuleset.mockRejectedValue(new Error('Ruleset error'));

    const result = await verifyAndConfigure('project-123');

    expect(result.status).toBe('error');
    expect(result.message).toContain('Failed to deploy protection rules');
  });

  test('should handle zone status check errors', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'project-123',
              user_id: 'user-123',
              name: 'example.com',
              zone_id: 'zone-123',
              status: 'pending_ns',
              secret_key: 'gk_live_' + 'f'.repeat(32),
            },
            error: null,
          }),
        }),
      }),
    });

    mockGetCloudflareZoneStatus.mockRejectedValue(new Error('API error'));

    const result = await verifyAndConfigure('project-123');

    expect(result.status).toBe('error');
    expect(result.message).toContain('API error');
  });

  test('should handle database update errors', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'project-123',
              user_id: 'user-123',
              name: 'example.com',
              zone_id: 'zone-123',
              status: 'pending_ns',
              secret_key: 'gk_live_' + 'g'.repeat(32),
            },
            error: null,
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          error: new Error('Update failed'),
        }),
      }),
    });

    mockGetCloudflareZoneStatus.mockResolvedValue({
      success: true,
      result: {
        id: 'zone-123',
        name: 'example.com',
        status: 'active',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      },
    });

    mockGetOrCreateRuleset.mockResolvedValue('ruleset-123');

    mockDeployWAFRule.mockResolvedValue({
      success: true,
      result: {
        id: 'ruleset-123',
        rules: [],
      },
    });

    const result = await verifyAndConfigure('project-123');

    expect(result.status).toBe('error');
    expect(result.message).toContain('Failed to update project status');
  });
});
