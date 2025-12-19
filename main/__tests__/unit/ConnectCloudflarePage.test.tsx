/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import ConnectCloudflarePage from '@/app/connect-cloudflare/page';
import { saveCloudflareToken, getUserCloudflareTokenInfo, removeCloudflareToken } from '@/app/actions/cloudflare-tokens';
import { lookupZoneId } from '@/app/actions/cloudflare-token-verification';

// Mock the dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/app/actions/cloudflare-tokens', () => ({
  saveCloudflareToken: jest.fn(),
  getUserCloudflareTokenInfo: jest.fn(),
  removeCloudflareToken: jest.fn(),
}));

jest.mock('@/app/actions/cloudflare-token-verification', () => ({
  lookupZoneId: jest.fn(),
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

const mockPush = jest.fn();
const mockSaveCloudflareToken = saveCloudflareToken as jest.MockedFunction<typeof saveCloudflareToken>;
const mockGetUserCloudflareTokenInfo = getUserCloudflareTokenInfo as jest.MockedFunction<typeof getUserCloudflareTokenInfo>;
const mockRemoveCloudflareToken = removeCloudflareToken as jest.MockedFunction<typeof removeCloudflareToken>;
const mockLookupZoneId = lookupZoneId as jest.MockedFunction<typeof lookupZoneId>;

describe('ConnectCloudflarePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  it('shows loading state initially', () => {
    mockGetUserCloudflareTokenInfo.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<ConnectCloudflarePage />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows token step when no existing token', async () => {
    mockGetUserCloudflareTokenInfo.mockResolvedValue(null);

    render(<ConnectCloudflarePage />);

    await waitFor(() => {
      expect(screen.getByText('Connect Your Cloudflare Account')).toBeInTheDocument();
      expect(screen.getByText('To protect your domains, we need access to your Cloudflare account via an API token')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Create a Cloudflare API Token')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('PP_Dqm0PpxVpPzxUpEmXGswskREXy4fTeA48pcPPso')).toBeInTheDocument();
    });
  });

  it('shows domain step when existing token found', async () => {
    const mockTokenInfo = {
      tokenName: 'Test Token',
      accountId: 'test-account-id',
      lastVerified: new Date().toISOString(),
    };
    mockGetUserCloudflareTokenInfo.mockResolvedValue(mockTokenInfo);

    render(<ConnectCloudflarePage />);

    await waitFor(() => {
      expect(screen.getByText('Now let\'s verify your domain and get its Zone ID')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Verify Your Domain')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('example.com')).toBeInTheDocument();
    });
  });

  it('handles token submission successfully', async () => {
    mockGetUserCloudflareTokenInfo.mockResolvedValue(null);
    mockSaveCloudflareToken.mockResolvedValue({ success: true });

    render(<ConnectCloudflarePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('PP_Dqm0PpxVpPzxUpEmXGswskREXy4fTeA48pcPPso')).toBeInTheDocument();
    });

    const tokenInput = screen.getByPlaceholderText('PP_Dqm0PpxVpPzxUpEmXGswskREXy4fTeA48pcPPso');
    const submitButton = screen.getByText('Connect Cloudflare');

    fireEvent.change(tokenInput, { target: { value: 'test-token-12345678901234567890' } });
    fireEvent.click(submitButton);

    expect(screen.getByText('Verifying...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockSaveCloudflareToken).toHaveBeenCalledWith('test-token-12345678901234567890');
      expect(screen.getByText('✓ Token saved successfully! Moving to domain verification...')).toBeInTheDocument();
    });
  });

  it('handles token submission errors', async () => {
    mockGetUserCloudflareTokenInfo.mockResolvedValue(null);
    mockSaveCloudflareToken.mockResolvedValue({ success: false, error: 'Invalid token' });

    render(<ConnectCloudflarePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('PP_Dqm0PpxVpPzxUpEmXGswskREXy4fTeA48pcPPso')).toBeInTheDocument();
    });

    const tokenInput = screen.getByPlaceholderText('PP_Dqm0PpxVpPzxUpEmXGswskREXy4fTeA48pcPPso');
    const submitButton = screen.getByText('Connect Cloudflare');

    fireEvent.change(tokenInput, { target: { value: 'invalid-token' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid token')).toBeInTheDocument();
    });
  });

  it('validates token length', async () => {
    mockGetUserCloudflareTokenInfo.mockResolvedValue(null);

    render(<ConnectCloudflarePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('PP_Dqm0PpxVpPzxUpEmXGswskREXy4fTeA48pcPPso')).toBeInTheDocument();
    });

    const tokenInput = screen.getByPlaceholderText('PP_Dqm0PpxVpPzxUpEmXGswskREXy4fTeA48pcPPso');
    const submitButton = screen.getByText('Connect Cloudflare');

    fireEvent.change(tokenInput, { target: { value: 'short' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Token appears too short. Please enter a valid Cloudflare API token.')).toBeInTheDocument();
    });
  });

  it('handles domain lookup successfully', async () => {
    const mockTokenInfo = { tokenName: 'Test Token' };
    const mockZoneResult = {
      success: true,
      zoneId: 'test-zone-id-123',
      zoneName: 'example.com',
      status: 'active',
      nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      message: 'Zone found successfully',
    };

    mockGetUserCloudflareTokenInfo.mockResolvedValue(mockTokenInfo);
    mockLookupZoneId.mockResolvedValue(mockZoneResult);

    render(<ConnectCloudflarePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('example.com')).toBeInTheDocument();
    });

    const domainInput = screen.getByPlaceholderText('example.com');
    const verifyButton = screen.getByText('Verify Domain');

    fireEvent.change(domainInput, { target: { value: 'example.com' } });
    fireEvent.click(verifyButton);

    expect(screen.getByText('Looking up Zone...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockLookupZoneId).toHaveBeenCalledWith('example.com');
      expect(screen.getByText('🎉 Setup Complete!')).toBeInTheDocument();
      expect(screen.getByText('✓ Domain Verified Successfully')).toBeInTheDocument();
      expect(screen.getByText('test-zone-id-123')).toBeInTheDocument();
      expect(screen.getByText('ns1.cloudflare.com')).toBeInTheDocument();
    });
  });

  it('handles domain lookup errors', async () => {
    const mockTokenInfo = { tokenName: 'Test Token' };
    const mockZoneResult = {
      success: false,
      message: 'Zone not found',
      error: 'ZONE_NOT_FOUND',
    };

    mockGetUserCloudflareTokenInfo.mockResolvedValue(mockTokenInfo);
    mockLookupZoneId.mockResolvedValue(mockZoneResult);

    render(<ConnectCloudflarePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('example.com')).toBeInTheDocument();
    });

    const domainInput = screen.getByPlaceholderText('example.com');
    const verifyButton = screen.getByText('Verify Domain');

    fireEvent.change(domainInput, { target: { value: 'nonexistent.com' } });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText('Zone not found')).toBeInTheDocument();
    });
  });

  it('validates empty domain input', async () => {
    const mockTokenInfo = { tokenName: 'Test Token' };
    mockGetUserCloudflareTokenInfo.mockResolvedValue(mockTokenInfo);

    render(<ConnectCloudflarePage />);

    await waitFor(() => {
      expect(screen.getByText('Verify Domain')).toBeInTheDocument();
    });

    const verifyButton = screen.getByText('Verify Domain');
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a domain name')).toBeInTheDocument();
    });
  });

  it('copies zone ID to clipboard', async () => {
    const mockTokenInfo = { tokenName: 'Test Token' };
    const mockZoneResult = {
      success: true,
      zoneId: 'copy-test-zone-id',
      zoneName: 'copy.com',
      status: 'active',
      nameservers: [],
      message: 'Zone found',
    };

    mockGetUserCloudflareTokenInfo.mockResolvedValue(mockTokenInfo);
    mockLookupZoneId.mockResolvedValue(mockZoneResult);

    render(<ConnectCloudflarePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('example.com')).toBeInTheDocument();
    });

    const domainInput = screen.getByPlaceholderText('example.com');
    const verifyButton = screen.getByText('Verify Domain');

    fireEvent.change(domainInput, { target: { value: 'copy.com' } });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText('copy-test-zone-id')).toBeInTheDocument();
    });

    const copyButton = screen.getByTitle('Copy Zone ID');
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('copy-test-zone-id');
  });

  it('navigates to dashboard on completion', async () => {
    const mockTokenInfo = { tokenName: 'Test Token' };
    const mockZoneResult = {
      success: true,
      zoneId: 'test-zone-id',
      zoneName: 'test.com',
      status: 'active',
      nameservers: [],
      message: 'Zone found',
    };

    mockGetUserCloudflareTokenInfo.mockResolvedValue(mockTokenInfo);
    mockLookupZoneId.mockResolvedValue(mockZoneResult);

    render(<ConnectCloudflarePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('example.com')).toBeInTheDocument();
    });

    const domainInput = screen.getByPlaceholderText('example.com');
    const verifyButton = screen.getByText('Verify Domain');

    fireEvent.change(domainInput, { target: { value: 'test.com' } });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    });

    const dashboardButton = screen.getByText('Go to Dashboard');
    fireEvent.click(dashboardButton);

    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('handles token removal', async () => {
    const mockTokenInfo = { tokenName: 'Test Token' };
    mockGetUserCloudflareTokenInfo.mockResolvedValue(mockTokenInfo);
    mockRemoveCloudflareToken.mockResolvedValue({ success: true });

    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    render(<ConnectCloudflarePage />);

    await waitFor(() => {
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    const disconnectButton = screen.getByText('Disconnect');
    fireEvent.click(disconnectButton);

    await waitFor(() => {
      expect(mockRemoveCloudflareToken).toHaveBeenCalled();
    });

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('shows progress indicator correctly', async () => {
    mockGetUserCloudflareTokenInfo.mockResolvedValue(null);

    render(<ConnectCloudflarePage />);

    await waitFor(() => {
      // Should show step 1 as active
      const progressSteps = screen.getAllByText('1');
      expect(progressSteps.length).toBeGreaterThan(0);
    });
  });
});