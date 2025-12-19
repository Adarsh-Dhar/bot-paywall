/**
 * Unit Tests for CloudflareTokenVerification Component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CloudflareTokenVerification from '@/components/CloudflareTokenVerification';
import * as tokenActions from '@/app/actions/cloudflare-token-verification';

// Mock the server actions
jest.mock('@/app/actions/cloudflare-token-verification');

const mockVerifyCloudflareToken = tokenActions.verifyCloudflareToken as jest.MockedFunction<typeof tokenActions.verifyCloudflareToken>;
const mockLookupZoneId = tokenActions.lookupZoneId as jest.MockedFunction<typeof tokenActions.lookupZoneId>;

describe('CloudflareTokenVerification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render both phases', () => {
    render(<CloudflareTokenVerification />);

    expect(screen.getByText('Phase 1: Token Verification')).toBeInTheDocument();
    expect(screen.getByText('Phase 2: Zone ID Lookup')).toBeInTheDocument();
    expect(screen.getByText('Verify Token')).toBeInTheDocument();
    expect(screen.getByText('Lookup Zone')).toBeInTheDocument();
  });

  test('should verify token successfully', async () => {
    mockVerifyCloudflareToken.mockResolvedValue({
      success: true,
      status: 'active',
      message: 'Token is active and valid',
      permissions: ['allow:zone:*:Zone.WAF:Edit']
    });

    render(<CloudflareTokenVerification />);

    const verifyButton = screen.getByText('Verify Token');
    fireEvent.click(verifyButton);

    expect(screen.getByText('Verifying...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Token is active and valid')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('allow:zone:*:Zone.WAF:Edit')).toBeInTheDocument();
    });
  });

  test('should handle token verification failure', async () => {
    mockVerifyCloudflareToken.mockResolvedValue({
      success: false,
      message: 'Token verification failed',
      error: 'VERIFICATION_FAILED'
    });

    render(<CloudflareTokenVerification />);

    const verifyButton = screen.getByText('Verify Token');
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText('Token verification failed')).toBeInTheDocument();
    });
  });

  test('should lookup zone ID successfully', async () => {
    mockLookupZoneId.mockResolvedValue({
      success: true,
      zoneId: 'zone-123',
      zoneName: 'example.com',
      status: 'active',
      nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      message: 'Zone found: example.com (zone-123) - Status: active'
    });

    render(<CloudflareTokenVerification />);

    const domainInput = screen.getByPlaceholderText('Enter domain (e.g., example.com)');
    const lookupButton = screen.getByText('Lookup Zone');

    fireEvent.change(domainInput, { target: { value: 'example.com' } });
    fireEvent.click(lookupButton);

    expect(screen.getByText('Looking up...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Zone found: example.com (zone-123) - Status: active')).toBeInTheDocument();
      expect(screen.getByText('zone-123')).toBeInTheDocument();
      expect(screen.getByText('ns1.cloudflare.com')).toBeInTheDocument();
      expect(screen.getByText('ns2.cloudflare.com')).toBeInTheDocument();
    });
  });

  test('should handle zone lookup failure', async () => {
    mockLookupZoneId.mockResolvedValue({
      success: false,
      message: 'No zone found for domain',
      error: 'ZONE_NOT_FOUND'
    });

    render(<CloudflareTokenVerification />);

    const domainInput = screen.getByPlaceholderText('Enter domain (e.g., example.com)');
    const lookupButton = screen.getByText('Lookup Zone');

    fireEvent.change(domainInput, { target: { value: 'nonexistent.com' } });
    fireEvent.click(lookupButton);

    await waitFor(() => {
      expect(screen.getByText('No zone found for domain')).toBeInTheDocument();
    });
  });

  test('should show validation error for empty domain', async () => {
    render(<CloudflareTokenVerification />);

    const lookupButton = screen.getByText('Lookup Zone');
    
    // Button should be disabled when domain is empty
    expect(lookupButton).toBeDisabled();
  });

  test('should show next steps when both phases succeed', async () => {
    mockVerifyCloudflareToken.mockResolvedValue({
      success: true,
      status: 'active',
      message: 'Token is active and valid'
    });

    mockLookupZoneId.mockResolvedValue({
      success: true,
      zoneId: 'zone-123',
      zoneName: 'example.com',
      status: 'active',
      message: 'Zone found'
    });

    render(<CloudflareTokenVerification />);

    // Verify token first
    const verifyButton = screen.getByText('Verify Token');
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText('Token is active and valid')).toBeInTheDocument();
    });

    // Then lookup zone
    const domainInput = screen.getByPlaceholderText('Enter domain (e.g., example.com)');
    const lookupButton = screen.getByText('Lookup Zone');

    fireEvent.change(domainInput, { target: { value: 'example.com' } });
    fireEvent.click(lookupButton);

    await waitFor(() => {
      expect(screen.getByText('Ready for WAF Rule Deployment')).toBeInTheDocument();
      expect(screen.getByText(/example\.com/)).toBeInTheDocument();
      expect(screen.getByText('zone-123')).toBeInTheDocument();
    });
  });

  test('should handle Enter key press in domain input', async () => {
    mockLookupZoneId.mockResolvedValue({
      success: true,
      zoneId: 'zone-123',
      zoneName: 'example.com',
      status: 'active',
      message: 'Zone found'
    });

    render(<CloudflareTokenVerification />);

    const domainInput = screen.getByPlaceholderText('Enter domain (e.g., example.com)');
    
    fireEvent.change(domainInput, { target: { value: 'example.com' } });
    fireEvent.keyPress(domainInput, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(screen.getByText('Looking up...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockLookupZoneId).toHaveBeenCalledWith('example.com');
    });
  });
});