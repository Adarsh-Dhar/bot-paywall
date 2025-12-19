/**
 * Property-Based Tests for Cloudflare Verification Module
 * Requirements: 9.2, 9.3, 9.5
 */

import * as fc from 'fast-check';
import { verifyProjectStatus } from '@/app/actions/cloudflare-verification';
import { auth } from '@/lib/mock-auth';
import { prisma } from '@/lib/prisma';
import { getUserCloudflareToken } from '@/app/actions/cloudflare-tokens';
import { getCloudflareZoneStatus, deployWAFRule } from '@/lib/cloudflare-api';

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

const mockDeployWAFRule = deployWAFRule as jest.MockedFunction<typeof deployWAFRule>;

describe('Cloudflare Verification Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: 'user-123' });
    mockGetUserCloudflareToken.mockResolvedValue('mock-token');
  });

  /**
   * **Feature: gatekeeper-bot-firewall, Property 16: Verification Status Response Correctness**
   * **Validates: Requirements 9.3, 9.5**
   */
  test('Property 16: Verification status response correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          projectId: fc.string({ minLength: 1 }),
          zoneId: fc.string({ minLength: 1 }),
          secretKey: fc.string({ minLength: 32 }),
          zoneStatus: fc.constantFrom('pending', 'active'),
        }),
        async ({ projectId, zoneId, secretKey, zoneStatus }) => {
          // Setup mock project
          const mockProject = {
            id: projectId,
            userId: 'user-123',
            name: 'example.com',
            zoneId: zoneId,
            secretKey: secretKey,
            status: 'PENDING_NS',
          };

          (prisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
          mockGetCloudflareZoneStatus.mockResolvedValue({
            success: true,
            result: {
              id: zoneId,
              name: 'example.com',
              status: zoneStatus,
              nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
            },
          });

          if (zoneStatus === 'active') {

            mockDeployWAFRule.mockResolvedValue(undefined);
            (prisma.project.update as jest.Mock).mockResolvedValue(mockProject);
          }

          const result = await verifyProjectStatus(projectId);

          if (zoneStatus === 'pending') {
            // For pending zones, should return PENDING_NS status
            expect(result.status).toBe('PENDING_NS');
            expect(result.message).toBe('Waiting for Nameserver update.');
          } else if (zoneStatus === 'active') {
            // For active zones, should return PROTECTED status
            expect(result.status).toBe('PROTECTED');
            expect(result.message).toBe('Domain active & Firewall injected.');
            expect(result.protected).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: gatekeeper-bot-firewall, Property 18: Verification Module Data Retrieval**
   * **Validates: Requirements 9.2**
   */
  test('Property 18: Verification module data retrieval', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          projectId: fc.string({ minLength: 1 }),
          userId: fc.string({ minLength: 1 }),
          zoneId: fc.string({ minLength: 1 }),
          secretKey: fc.string({ minLength: 32 }),
        }),
        async ({ projectId, userId, zoneId, secretKey }) => {
          // Setup mock project with all required data
          const mockProject = {
            id: projectId,
            userId: userId,
            name: 'example.com',
            zoneId: zoneId,
            secretKey: secretKey,
            status: 'PENDING_NS',
          };

          mockAuth.mockResolvedValue({ userId: userId });
          (prisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
          mockGetCloudflareZoneStatus.mockResolvedValue({
            success: true,
            result: {
              id: zoneId,
              name: 'example.com',
              status: 'active',
              nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
            },
          });

          mockDeployWAFRule.mockResolvedValue(undefined);
          (prisma.project.update as jest.Mock).mockResolvedValue(mockProject);

          const result = await verifyProjectStatus(projectId);

          // Verify that the function successfully retrieved all required data
          expect(prisma.project.findFirst).toHaveBeenCalledWith({
            where: {
              id: projectId,
              userId: userId,
            },
          });

          // Verify that Cloudflare API was called with the retrieved data
          expect(mockGetCloudflareZoneStatus).toHaveBeenCalledWith(zoneId, 'mock-token');
          expect(mockDeployWAFRule).toHaveBeenCalledWith(zoneId, secretKey, 'mock-token');

          // Should return success when all data is available
          expect(result.status).toBe('PROTECTED');
        }
      ),
      { numRuns: 100 }
    );
  });
});