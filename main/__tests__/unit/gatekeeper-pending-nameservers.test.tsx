/**
 * Unit Tests for PendingNameserversView Component
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { PendingNameserversView } from '@/app/dashboard/components/PendingNameserversView';
import { Project } from '@prisma/client';

describe('PendingNameserversView Component', () => {
  const mockProject: Project = {
    id: 'project-123',
    userId: 'user-123',
    name: 'example.com',
    websiteUrl: null,
    zoneId: 'zone-123',
    nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
    status: 'PENDING_NS',
    secretKey: 'gk_live_' + 'a'.repeat(32),
    requestsCount: 0,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockOnVerify = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should display warning banner', () => {
    render(
      <PendingNameserversView
        project={mockProject}
        onVerify={mockOnVerify}
        isVerifying={false}
      />
    );

    expect(screen.getByText('Action Required')).toBeInTheDocument();
  });

  test('should display domain name', () => {
    render(
      <PendingNameserversView
        project={mockProject}
        onVerify={mockOnVerify}
        isVerifying={false}
      />
    );

    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  test('should display nameservers', () => {
    render(
      <PendingNameserversView
        project={mockProject}
        onVerify={mockOnVerify}
        isVerifying={false}
      />
    );

    expect(screen.getByText('ns1.cloudflare.com')).toBeInTheDocument();
    expect(screen.getByText('ns2.cloudflare.com')).toBeInTheDocument();
  });

  test('should display copy button', () => {
    render(
      <PendingNameserversView
        project={mockProject}
        onVerify={mockOnVerify}
        isVerifying={false}
      />
    );

    expect(screen.getByText('Copy All Nameservers')).toBeInTheDocument();
  });

  test('should display instructions', () => {
    render(
      <PendingNameserversView
        project={mockProject}
        onVerify={mockOnVerify}
        isVerifying={false}
      />
    );

    expect(screen.getByText(/Log in to your domain registrar account/)).toBeInTheDocument();
    expect(screen.getByText(/Find the DNS or Nameserver settings/)).toBeInTheDocument();
    expect(screen.getByText(/Replace the existing nameservers/)).toBeInTheDocument();
    expect(screen.getByText(/Save your changes/)).toBeInTheDocument();
  });

  test('should display verify button', () => {
    render(
      <PendingNameserversView
        project={mockProject}
        onVerify={mockOnVerify}
        isVerifying={false}
      />
    );

    expect(screen.getByText('Verify Setup')).toBeInTheDocument();
  });

  test('should call onVerify when verify button is clicked', () => {
    render(
      <PendingNameserversView
        project={mockProject}
        onVerify={mockOnVerify}
        isVerifying={false}
      />
    );

    fireEvent.click(screen.getByText('Verify Setup'));
    expect(mockOnVerify).toHaveBeenCalled();
  });

  test('should show loading state during verification', () => {
    render(
      <PendingNameserversView
        project={mockProject}
        onVerify={mockOnVerify}
        isVerifying={true}
      />
    );

    expect(screen.getByText('Verifying...')).toBeInTheDocument();
  });

  test('should disable verify button during verification', () => {
    render(
      <PendingNameserversView
        project={mockProject}
        onVerify={mockOnVerify}
        isVerifying={true}
      />
    );

    const button = screen.getByText('Verifying...');
    expect(button).toBeDisabled();
  });

  test('should handle copy to clipboard', () => {
    const mockClipboard = {
      writeText: jest.fn(),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(
      <PendingNameserversView
        project={mockProject}
        onVerify={mockOnVerify}
        isVerifying={false}
      />
    );

    fireEvent.click(screen.getByText('Copy All Nameservers'));

    expect(mockClipboard.writeText).toHaveBeenCalledWith(
      'ns1.cloudflare.com\nns2.cloudflare.com'
    );
  });

  test('should show copied confirmation', async () => {
    const mockClipboard = {
      writeText: jest.fn(),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(
      <PendingNameserversView
        project={mockProject}
        onVerify={mockOnVerify}
        isVerifying={false}
      />
    );

    fireEvent.click(screen.getByText('Copy All Nameservers'));

    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  test('should handle empty nameservers', () => {
    const projectWithoutNameservers = { ...mockProject, nameservers: null };

    render(
      <PendingNameserversView
        project={projectWithoutNameservers}
        onVerify={mockOnVerify}
        isVerifying={false}
      />
    );

    expect(screen.getByText('No nameservers available')).toBeInTheDocument();
  });

  test('should display all nameservers', () => {
    const projectWithMultipleNameservers = {
      ...mockProject,
      nameservers: [
        'ns1.cloudflare.com',
        'ns2.cloudflare.com',
        'ns3.cloudflare.com',
      ],
    };

    render(
      <PendingNameserversView
        project={projectWithMultipleNameservers}
        onVerify={mockOnVerify}
        isVerifying={false}
      />
    );

    expect(screen.getByText('ns1.cloudflare.com')).toBeInTheDocument();
    expect(screen.getByText('ns2.cloudflare.com')).toBeInTheDocument();
    expect(screen.getByText('ns3.cloudflare.com')).toBeInTheDocument();
  });

  test('should display help text', () => {
    render(
      <PendingNameserversView
        project={mockProject}
        onVerify={mockOnVerify}
        isVerifying={false}
      />
    );

    expect(screen.getByText(/Nameserver changes can take up to 48 hours/)).toBeInTheDocument();
  });

  test('should have proper step numbering', () => {
    render(
      <PendingNameserversView
        project={mockProject}
        onVerify={mockOnVerify}
        isVerifying={false}
      />
    );

    expect(screen.getByText('Step 1: Update Nameservers')).toBeInTheDocument();
    expect(screen.getByText('Step 2: Update Your Registrar')).toBeInTheDocument();
    expect(screen.getByText('Step 3: Verify & Activate')).toBeInTheDocument();
  });
});
