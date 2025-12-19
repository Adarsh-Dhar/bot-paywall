/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ZoneStatusDisplay from '@/components/ZoneStatusDisplay';
import { lookupZoneId } from '@/app/actions/cloudflare-token-verification';

// Mock the server action
jest.mock('@/app/actions/cloudflare-token-verification', () => ({
  lookupZoneId: jest.fn(),
}));

const mockLookupZoneId = lookupZoneId as jest.MockedFunction<typeof lookupZoneId>;

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

describe('ZoneStatusDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders zone lookup interface', () => {
    render(<ZoneStatusDisplay />);
    
    expect(screen.getByText('Zone Lookup')).toBeInTheDocument();
    expect(screen.getByText('Domain Zone Information')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter domain (e.g., example.com)')).toBeInTheDocument();
    expect(screen.getByText('Lookup Zone')).toBeInTheDocument();
  });

  it('shows empty state when no domain entered', () => {
    render(<ZoneStatusDisplay />);
    
    expect(screen.getByText('Enter a domain to lookup its Zone ID')).toBeInTheDocument();
  });

  it('performs zone lookup when button clicked', async () => {
    const mockResult = {
      success: true,
      zoneId: 'test-zone-id-123',
      zoneName: 'example.com',
      status: 'active',
      nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      message: 'Zone found: example.com (test-zone-id-123) - Status: active',
    };

    mockLookupZoneId.mockResolvedValue(mockResult);

    render(<ZoneStatusDisplay />);
    
    const input = screen.getByPlaceholderText('Enter domain (e.g., example.com)');
    const button = screen.getByText('Lookup Zone');

    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.click(button);

    expect(screen.getByText('Looking up...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockLookupZoneId).toHaveBeenCalledWith('example.com');
      expect(screen.getByText('Zone found: example.com (test-zone-id-123) - Status: active')).toBeInTheDocument();
      expect(screen.getByText('test-zone-id-123')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('ns1.cloudflare.com')).toBeInTheDocument();
      expect(screen.getByText('ns2.cloudflare.com')).toBeInTheDocument();
    });
  });

  it('handles lookup errors', async () => {
    const mockResult = {
      success: false,
      message: 'Zone not found',
      error: 'ZONE_NOT_FOUND',
    };

    mockLookupZoneId.mockResolvedValue(mockResult);

    render(<ZoneStatusDisplay />);
    
    const input = screen.getByPlaceholderText('Enter domain (e.g., example.com)');
    const button = screen.getByText('Lookup Zone');

    fireEvent.change(input, { target: { value: 'nonexistent.com' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Zone not found')).toBeInTheDocument();
    });
  });

  it('validates empty domain input', async () => {
    render(<ZoneStatusDisplay />);
    
    const input = screen.getByPlaceholderText('Enter domain (e.g., example.com)');
    const button = screen.getByText('Lookup Zone');

    // Button should be disabled when input is empty
    expect(button).toBeDisabled();

    // Enter some text then clear it to trigger validation
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.change(input, { target: { value: '' } });
    
    // Now the button should be disabled again
    expect(button).toBeDisabled();
  });

  it('disables button for whitespace-only input', () => {
    render(<ZoneStatusDisplay />);
    
    const input = screen.getByPlaceholderText('Enter domain (e.g., example.com)');
    const button = screen.getByText('Lookup Zone');

    // Enter whitespace only
    fireEvent.change(input, { target: { value: '   ' } });
    
    // Button should still be disabled
    expect(button).toBeDisabled();
  });

  it('supports auto lookup with domain prop', async () => {
    const mockResult = {
      success: true,
      zoneId: 'auto-zone-id',
      zoneName: 'auto.com',
      status: 'active',
      nameservers: ['ns1.cloudflare.com'],
      message: 'Zone found automatically',
    };

    mockLookupZoneId.mockResolvedValue(mockResult);

    render(<ZoneStatusDisplay domain="auto.com" autoLookup={true} />);

    await waitFor(() => {
      expect(mockLookupZoneId).toHaveBeenCalledWith('auto.com');
      expect(screen.getByText('Zone found automatically')).toBeInTheDocument();
    });
  });

  it('copies zone ID to clipboard', async () => {
    const mockResult = {
      success: true,
      zoneId: 'copy-test-zone-id',
      zoneName: 'copy.com',
      status: 'active',
      nameservers: [],
      message: 'Zone found',
    };

    mockLookupZoneId.mockResolvedValue(mockResult);

    render(<ZoneStatusDisplay />);
    
    const input = screen.getByPlaceholderText('Enter domain (e.g., example.com)');
    const button = screen.getByText('Lookup Zone');

    fireEvent.change(input, { target: { value: 'copy.com' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('copy-test-zone-id')).toBeInTheDocument();
    });

    const copyButton = screen.getByTitle('Copy Zone ID');
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('copy-test-zone-id');
  });

  it('copies nameservers to clipboard', async () => {
    const mockResult = {
      success: true,
      zoneId: 'ns-test-zone-id',
      zoneName: 'ns.com',
      status: 'active',
      nameservers: ['ns1.test.com', 'ns2.test.com'],
      message: 'Zone found',
    };

    mockLookupZoneId.mockResolvedValue(mockResult);

    render(<ZoneStatusDisplay />);
    
    const input = screen.getByPlaceholderText('Enter domain (e.g., example.com)');
    const button = screen.getByText('Lookup Zone');

    fireEvent.change(input, { target: { value: 'ns.com' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('ns1.test.com')).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByTitle('Copy Nameserver');
    fireEvent.click(copyButtons[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ns1.test.com');
  });

  it('handles Enter key press in input', async () => {
    const mockResult = {
      success: true,
      zoneId: 'enter-test-zone-id',
      zoneName: 'enter.com',
      status: 'active',
      nameservers: [],
      message: 'Zone found via Enter',
    };

    mockLookupZoneId.mockResolvedValue(mockResult);

    render(<ZoneStatusDisplay />);
    
    const input = screen.getByPlaceholderText('Enter domain (e.g., example.com)');

    fireEvent.change(input, { target: { value: 'enter.com' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    await waitFor(() => {
      expect(mockLookupZoneId).toHaveBeenCalledWith('enter.com');
      expect(screen.getByText('Zone found via Enter')).toBeInTheDocument();
    });
  });
});