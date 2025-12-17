/**
 * Unit Tests for Gatekeeper Database Query Functions
 * Requirements: 6.1, 7.3, 7.5
 */

import { getProjectsByUser, getProjectById } from '@/app/actions/gatekeeper';
import { supabaseAdmin } from '@/lib/supabase-client';
import { auth } from '@clerk/nextjs/server';

// Mock dependencies
jest.mock('@clerk/nextjs/server');
jest.mock('@/lib/supabase-client');

const mockAuth = auth as jest.MockedFunction<typeof auth>;

describe('Database Query Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProjectsByUser', () => {
    test('should return empty array for unauthenticated users', async () => {
      mockAuth.mockResolvedValue({ userId: null } as any);

      const result = await getProjectsByUser();

      expect(result).toEqual([]);
    });

    test('should return all projects for authenticated user', async () => {
      mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

      const mockProjects = [
        {
          id: 'project-1',
          user_id: 'user-123',
          name: 'example.com',
          zone_id: 'zone-1',
          status: 'pending_ns',
          secret_key: 'gk_live_' + 'a'.repeat(32),
        },
        {
          id: 'project-2',
          user_id: 'user-123',
          name: 'test.com',
          zone_id: 'zone-2',
          status: 'protected',
          secret_key: 'gk_live_' + 'b'.repeat(32),
        },
      ];

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockProjects,
              error: null,
            }),
          }),
        }),
      });

      const result = await getProjectsByUser();

      expect(result).toEqual(mockProjects);
      expect(result.length).toBe(2);
    });

    test('should filter projects by user_id', async () => {
      mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

      const mockProjects = [
        {
          id: 'project-1',
          user_id: 'user-123',
          name: 'example.com',
          zone_id: 'zone-1',
          status: 'pending_ns',
          secret_key: 'gk_live_' + 'a'.repeat(32),
        },
      ];

      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockProjects,
            error: null,
          }),
        }),
      });

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: selectMock,
      });

      await getProjectsByUser();

      expect(selectMock).toHaveBeenCalledWith('*');
    });

    test('should order projects by created_at descending', async () => {
      mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

      const orderMock = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: orderMock,
          }),
        }),
      });

      await getProjectsByUser();

      expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    test('should return empty array on database error', async () => {
      mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error'),
            }),
          }),
        }),
      });

      const result = await getProjectsByUser();

      expect(result).toEqual([]);
    });

    test('should return empty array when no projects exist', async () => {
      mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const result = await getProjectsByUser();

      expect(result).toEqual([]);
    });
  });

  describe('getProjectById', () => {
    test('should return null for unauthenticated users', async () => {
      mockAuth.mockResolvedValue({ userId: null } as any);

      const result = await getProjectById('project-123');

      expect(result).toBeNull();
    });

    test('should return project if user owns it', async () => {
      mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

      const mockProject = {
        id: 'project-123',
        user_id: 'user-123',
        name: 'example.com',
        zone_id: 'zone-123',
        status: 'pending_ns',
        secret_key: 'gk_live_' + 'a'.repeat(32),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProject,
              error: null,
            }),
          }),
        }),
      });

      const result = await getProjectById('project-123');

      expect(result).toEqual(mockProject);
    });

    test('should return null if project not found', async () => {
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

      const result = await getProjectById('project-123');

      expect(result).toBeNull();
    });

    test('should return null if user does not own project', async () => {
      mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

      const mockProject = {
        id: 'project-123',
        user_id: 'different-user',
        name: 'example.com',
        zone_id: 'zone-123',
        status: 'pending_ns',
        secret_key: 'gk_live_' + 'a'.repeat(32),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn()
            .mockReturnValueOnce({
              single: jest.fn().mockResolvedValue({
                data: mockProject,
                error: null,
              }),
            })
            .mockReturnValueOnce({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
        }),
      });

      const result = await getProjectById('project-123');

      expect(result).toBeNull();
    });

    test('should filter by both project id and user_id', async () => {
      mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

      const eqMock = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: eqMock,
        }),
      });

      await getProjectById('project-123');

      // Should be called twice: once for id, once for user_id
      expect(eqMock).toHaveBeenCalledWith('id', 'project-123');
      expect(eqMock).toHaveBeenCalledWith('user_id', 'user-123');
    });

    test('should return null on database error', async () => {
      mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error'),
            }),
          }),
        }),
      });

      const result = await getProjectById('project-123');

      expect(result).toBeNull();
    });

    test('should handle missing project gracefully', async () => {
      mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const result = await getProjectById('non-existent-project');

      expect(result).toBeNull();
    });

    test('should preserve all project fields', async () => {
      mockAuth.mockResolvedValue({ userId: 'user-123' } as any);

      const mockProject = {
        id: 'project-123',
        user_id: 'user-123',
        name: 'example.com',
        zone_id: 'zone-123',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
        status: 'protected',
        secret_key: 'gk_live_' + 'a'.repeat(32),
        created_at: '2024-01-01T00:00:00Z',
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProject,
              error: null,
            }),
          }),
        }),
      });

      const result = await getProjectById('project-123');

      expect(result).toEqual(mockProject);
      expect(result?.nameservers).toEqual(['ns1.cloudflare.com', 'ns2.cloudflare.com']);
      expect(result?.created_at).toBe('2024-01-01T00:00:00Z');
    });
  });
});
