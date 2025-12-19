/**
 * Unit Tests for Cloudflare Verification Module
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { verifyProjectStatus } from '@/app/actions/cloudflare-verification';
import { auth } from '@/lib/mock-auth';
import { prisma } from '@/lib/prisma';
import { getUserCloudflareToken } from '@/app/actions/cloudflare-tokens';
import { getCloudflareZoneStatus, getOrCreateRuleset, deployWAFRule } from '@/lib/cloudflare-api';

// Mock dependencies
jest.mock('@/lib/mock-auth');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock('@/app/actions/cloudflare-tokens');
jest.mock('@/lib/cloudflare-api');

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockGetUserCloudflareToken = getUserCloudflareToken as jest.MockedFunction<typeof getUserCloudflareToken>;
const mockGetCloudflareZoneStatus = getCloudflareZoneStatus as jest.MockedFunction<typeof getCloudflareZoneStatus>;
const mockGetOrCreateRuleset = getOrCreateRuleset as jest.MockedFunction<typeof getOrCreateRuleset>;
const mockDeployWAFRule = deployWAFRule as jest.MockedFunction<typeof deployWAFRule>;

describe('verifyProjectStatus', () => {
  const mockProject = {
    id: 'project-123',
    userId: 'user-123',
    name: 'example.com',
    zoneId: 'zone-123',
    secretKey: 'gk_live_' + 'a'.repeat(32),
    status: 'PENDING_NS',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: 'user-123' });
    mockGetUserCloudflareToken.mockResolvedValue('mock-token');
  });

  test('should return error when user not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const result = await verifyProjectStatus('project-123');

    expect(result).toEqual({
      status: 'error',
      message: 'User not authenticated',
    });
  });

  test('should return error when project not found', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await verifyProjectStatus('project-123');

    expect(result).toEqual({
      status: 'error',
      message: 'Project not found or unauthorized',
    });
  });

  test('should return error when zone ID not found', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue({
      ...mockProject,
      zoneId: null,
    });

    const result = await verifyProjectStatus('project-123');

    expect(result).toEqual({
      status: 'error',
      message: 'Zone ID not found for this project',
    });
  });

  test('should return error when Cloudflare token not found', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
    mockGetUserCloudflareToken.mockResolvedValue(null);

    const result = await verifyProjectStatus('project-123');

    expect(result).toEqual({
      status: 'error',
      message: 'Cloudflare API token not found. Please connect your Cloudflare account first.',
    });
  });

  test('should return pending_ns when zone status is pending', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
    mockGetCloudflareZoneStatus.mockResolvedValue({
      success: true,
      result: {
        id: 'zone-123',
        name: 'example.com',
        status: 'pending',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      },
    });

    const result = await verifyProjectStatus('project-123');

    expect(result).toEqual({
      status: 'PENDING_NS',
      message: 'Waiting for Nameserver update.',
    });
  });

  test('should deploy WAF rules and return protected when zone is active', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
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
    mockDeployWAFRule.mockResolvedValue(undefined);
    (prisma.project.update as jest.Mock).mockResolvedValue(mockProject);

    const result = await verifyProjectStatus('project-123');

    expect(mockGetOrCreateRuleset).toHaveBeenCalledWith('zone-123', 'mock-token');
    expect(mockDeployWAFRule).toHaveBeenCalledWith('zone-123', 'ruleset-123', mockProject.secretKey, 'mock-token');
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'project-123' },
      data: { status: 'PROTECTED' },
    });
    expect(result).toEqual({
      status: 'PROTECTED',
      message: 'Domain active & Firewall injected.',
      protected: true,
    });
  });

  test('should handle WAF deployment errors', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
    mockGetCloudflareZoneStatus.mockResolvedValue({
      success: true,
      result: {
        id: 'zone-123',
        name: 'example.com',
        status: 'active',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      },
    });
    mockGetOrCreateRuleset.mockRejectedValue(new Error('WAF deployment failed'));

    const result = await verifyProjectStatus('project-123');

    expect(result).toEqual({
      status: 'error',
      message: 'Failed to deploy protection rules. Please try again.',
    });
  });

  test('should handle unknown zone status', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
    mockGetCloudflareZoneStatus.mockResolvedValue({
      success: true,
      result: {
        id: 'zone-123',
        name: 'example.com',
        status: 'unknown',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      },
    });

    const result = await verifyProjectStatus('project-123');

    expect(result).toEqual({
      status: 'error',
      message: 'Unknown zone status: unknown',
    });
  });

  test('should handle 401/403 auth errors specifically', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
    mockGetCloudflareZoneStatus.mockRejectedValue(new Error('401 Unauthorized'));

    const result = await verifyProjectStatus('project-123');

    expect(result).toEqual({
      status: 'error',
      message: 'Auth Error',
    });
  });

  test('should handle general errors', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
    mockGetCloudflareZoneStatus.mockRejectedValue(new Error('Network error'));

    const result = await verifyProjectStatus('project-123');

    expect(result).toEqual({
      status: 'error',
      message: 'Network error',
    });
  });

  test('should handle zone status check failure', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
    mockGetCloudflareZoneStatus.mockResolvedValue({
      success: false,
      result: null,
    });

    const result = await verifyProjectStatus('project-123');

    expect(result).toEqual({
      status: 'error',
      message: 'Failed to check zone status with Cloudflare',
    });
  });
});