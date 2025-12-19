/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import TokenVerificationStatus from '@/components/TokenVerificationStatus';
import { verifyCloudflareToken } from '@/app/actions/cloudflare-token-verification';
import { getUserCloudflareTokenInfo } from '@/app/actions/cloudflare-tokens';

// Mock the dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/app/actions/cloudflare-token-verification', () => ({
  verifyCloudflareToken: jest.fn(),
}));

jest.mock('@/app/actions/cloudflare-tokens', () => ({
  getUserCloudflareTokenInfo: jest.fn(),
}));

const mockPush = jest.fn();
const mockVerifyCloudflareToken = verifyCloudflareToken as jest.MockedFunction<typeof verifyCloudflareToken>;
const mockGetUserCloudflareTokenInfo = getUserCloudflareTokenInfo as jest.MockedFunction<typeof getUserCloudflareTokenInfo>;

describe('TokenVerificationStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  it('shows loading state initially', () => {
    mockGetUserCloudflareTokenInfo.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<TokenVerificationStatus />);
    
    expect(screen.getByText('Loading token status...')).toBeInTheDocument();
  });

  it('displays active token status', async () => {
    const mockTokenInfo = { tokenName: 'Test Token' };
    const mockVerificationResult = {
      success: true,
      status: 'active' as const,
      message: 'Token is active and valid',
      permissions: ['allow:zone:read', 'allow:zone:edit'],
    };

    mockGetUserCloudflareTokenInfo.mockResolvedValue(mockTokenInfo);
    mockVerifyCloudflareToken.mockResolvedValue(mockVerificationResult);

    render(<TokenVerificationStatus />);

    await waitFor(() => {
      expect(screen.getByText('Token Status')).toBeInTheDocument();
      expect(screen.getByText('Cloudflare API Verification')).toBeInTheDocument();
      expect(screen.getByText('Token is active and valid')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('allow:zone:read')).toBeInTheDocument();
      expect(screen.getByText('allow:zone:edit')).toBeInTheDocument();
    });
  });

  it('displays error when no token found', async () => {
    mockGetUserCloudflareTokenInfo.mockResolvedValue(null);

    render(<TokenVerificationStatus />);

    await waitFor(() => {
      expect(screen.getByText('No Cloudflare API token found')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  it('displays inactive token status', async () => {
    const mockTokenInfo = { tokenName: 'Inactive Token' };
    const mockVerificationResult = {
      success: true,
      status: 'inactive' as const,
      message: 'Token is inactive',
      permissions: [],
    };

    mockGetUserCloudflareTokenInfo.mockResolvedValue(mockTokenInfo);
    mockVerifyCloudflareToken.mockResolvedValue(mockVerificationResult);

    render(<TokenVerificationStatus />);

    await waitFor(() => {
      expect(screen.getByText('Token is inactive')).toBeInTheDocument();
      expect(screen.getByText('inactive')).toBeInTheDocument();
    });
  });

  it('handles verification errors', async () => {
    const mockTokenInfo = { tokenName: 'Error Token' };
    const mockVerificationResult = {
      success: false,
      message: 'Token verification failed',
      error: 'VERIFICATION_FAILED',
    };

    mockGetUserCloudflareTokenInfo.mockResolvedValue(mockTokenInfo);
    mockVerifyCloudflareToken.mockResolvedValue(mockVerificationResult);

    render(<TokenVerificationStatus />);

    await waitFor(() => {
      expect(screen.getByText('Token verification failed')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  it('refreshes token status when button clicked', async () => {
    const mockTokenInfo = { tokenName: 'Refresh Token' };
    const mockVerificationResult = {
      success: true,
      status: 'active' as const,
      message: 'Token refreshed successfully',
      permissions: [],
    };

    mockGetUserCloudflareTokenInfo.mockResolvedValue(mockTokenInfo);
    mockVerifyCloudflareToken.mockResolvedValue(mockVerificationResult);

    render(<TokenVerificationStatus />);

    await waitFor(() => {
      expect(screen.getByText('Refresh Status')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh Status');
    fireEvent.click(refreshButton);

    expect(screen.getByText('Verifying...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockVerifyCloudflareToken).toHaveBeenCalledTimes(2); // Once on mount, once on refresh
      expect(screen.getByText('Token refreshed successfully')).toBeInTheDocument();
    });
  });

  it('navigates to verification page when full verification button clicked', async () => {
    const mockTokenInfo = { tokenName: 'Nav Token' };
    const mockVerificationResult = {
      success: true,
      status: 'active' as const,
      message: 'Token is active',
      permissions: [],
    };

    mockGetUserCloudflareTokenInfo.mockResolvedValue(mockTokenInfo);
    mockVerifyCloudflareToken.mockResolvedValue(mockVerificationResult);

    render(<TokenVerificationStatus />);

    await waitFor(() => {
      expect(screen.getByText('Full Verification Page')).toBeInTheDocument();
    });

    const navButton = screen.getByText('Full Verification Page');
    fireEvent.click(navButton);

    expect(mockPush).toHaveBeenCalledWith('/verify-token');
  });

  it('shows limited permissions when there are many', async () => {
    const mockTokenInfo = { tokenName: 'Many Perms Token' };
    const mockVerificationResult = {
      success: true,
      status: 'active' as const,
      message: 'Token is active',
      permissions: [
        'allow:zone:read',
        'allow:zone:edit',
        'allow:dns:read',
        'allow:dns:edit',
        'allow:ssl:read',
      ],
    };

    mockGetUserCloudflareTokenInfo.mockResolvedValue(mockTokenInfo);
    mockVerifyCloudflareToken.mockResolvedValue(mockVerificationResult);

    render(<TokenVerificationStatus />);

    await waitFor(() => {
      expect(screen.getByText('allow:zone:read')).toBeInTheDocument();
      expect(screen.getByText('allow:zone:edit')).toBeInTheDocument();
      expect(screen.getByText('allow:dns:read')).toBeInTheDocument();
      expect(screen.getByText('+2 more permissions')).toBeInTheDocument();
    });
  });

  it('handles refresh errors gracefully', async () => {
    const mockTokenInfo = { tokenName: 'Error Token' };
    const mockVerificationResult = {
      success: true,
      status: 'active' as const,
      message: 'Initial success',
      permissions: [],
    };

    mockGetUserCloudflareTokenInfo.mockResolvedValue(mockTokenInfo);
    mockVerifyCloudflareToken
      .mockResolvedValueOnce(mockVerificationResult)
      .mockRejectedValueOnce(new Error('Network error'));

    render(<TokenVerificationStatus />);

    await waitFor(() => {
      expect(screen.getByText('Refresh Status')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh Status');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to verify token')).toBeInTheDocument();
    });
  });
});