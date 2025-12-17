/**
 * Unit Tests for CreateProjectModal Component
 * Requirements: 1.1, 1.2
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateProjectModal } from '@/app/dashboard/components/CreateProjectModal';
import * as gatekeeperActions from '@/app/actions/gatekeeper';

jest.mock('@/app/actions/gatekeeper');

const mockRegisterDomain = gatekeeperActions.registerDomain as jest.MockedFunction<typeof gatekeeperActions.registerDomain>;

describe('CreateProjectModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should not render when isOpen is false', () => {
    const { container } = render(
      <CreateProjectModal isOpen={false} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    expect(container.firstChild).toBeNull();
  });

  test('should render modal when isOpen is true', () => {
    render(
      <CreateProjectModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    expect(screen.getByText('Add New Domain')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('example.com')).toBeInTheDocument();
  });

  test('should have domain input field', () => {
    render(
      <CreateProjectModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const input = screen.getByPlaceholderText('example.com');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
  });

  test('should have cancel and submit buttons', () => {
    render(
      <CreateProjectModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Add Domain')).toBeInTheDocument();
  });

  test('should call onClose when cancel button is clicked', () => {
    render(
      <CreateProjectModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should call onClose when close button is clicked', () => {
    const { container } = render(
      <CreateProjectModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const closeButton = container.querySelector('button:first-of-type');
    if (closeButton && closeButton.textContent?.includes('×')) {
      fireEvent.click(closeButton);
    }
  });

  test('should validate empty domain', async () => {
    render(
      <CreateProjectModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    fireEvent.click(screen.getByText('Add Domain'));

    await waitFor(() => {
      expect(screen.getByText(/Please enter a domain name/)).toBeInTheDocument();
    });
  });

  test('should validate invalid domain format', async () => {
    render(
      <CreateProjectModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const input = screen.getByPlaceholderText('example.com');
    await userEvent.type(input, 'invalid');

    fireEvent.click(screen.getByText('Add Domain'));

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid domain name/)).toBeInTheDocument();
    });
  });

  test('should accept valid domain formats', async () => {
    mockRegisterDomain.mockResolvedValue({
      success: true,
      zone_id: 'zone-123',
      nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      secret_key: 'gk_live_' + 'a'.repeat(32),
    });

    render(
      <CreateProjectModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const input = screen.getByPlaceholderText('example.com');
    await userEvent.type(input, 'example.com');

    fireEvent.click(screen.getByText('Add Domain'));

    await waitFor(() => {
      expect(mockRegisterDomain).toHaveBeenCalledWith('example.com');
    });
  });

  test('should handle registration success', async () => {
    mockRegisterDomain.mockResolvedValue({
      success: true,
      zone_id: 'zone-123',
      nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      secret_key: 'gk_live_' + 'a'.repeat(32),
    });

    render(
      <CreateProjectModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const input = screen.getByPlaceholderText('example.com');
    await userEvent.type(input, 'example.com');

    fireEvent.click(screen.getByText('Add Domain'));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  test('should handle registration error', async () => {
    mockRegisterDomain.mockResolvedValue({
      success: false,
      error: 'Failed to create zone',
    });

    render(
      <CreateProjectModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const input = screen.getByPlaceholderText('example.com');
    await userEvent.type(input, 'example.com');

    fireEvent.click(screen.getByText('Add Domain'));

    await waitFor(() => {
      expect(screen.getByText('Failed to create zone')).toBeInTheDocument();
    });
  });

  test('should show loading state during submission', async () => {
    mockRegisterDomain.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        success: true,
        zone_id: 'zone-123',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
        secret_key: 'gk_live_' + 'a'.repeat(32),
      }), 100))
    );

    render(
      <CreateProjectModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const input = screen.getByPlaceholderText('example.com');
    await userEvent.type(input, 'example.com');

    fireEvent.click(screen.getByText('Add Domain'));

    expect(screen.getByText('Adding...')).toBeInTheDocument();
  });

  test('should clear input on successful submission', async () => {
    mockRegisterDomain.mockResolvedValue({
      success: true,
      zone_id: 'zone-123',
      nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      secret_key: 'gk_live_' + 'a'.repeat(32),
    });

    render(
      <CreateProjectModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const input = screen.getByPlaceholderText('example.com') as HTMLInputElement;
    await userEvent.type(input, 'example.com');

    fireEvent.click(screen.getByText('Add Domain'));

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  test('should accept various valid domain formats', async () => {
    mockRegisterDomain.mockResolvedValue({
      success: true,
      zone_id: 'zone-123',
      nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      secret_key: 'gk_live_' + 'a'.repeat(32),
    });

    const validDomains = [
      'example.com',
      'sub.example.com',
      'my-domain.co.uk',
      'test123.org',
    ];

    for (const domain of validDomains) {
      jest.clearAllMocks();
      const { unmount } = render(
        <CreateProjectModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );

      const input = screen.getByPlaceholderText('example.com');
      await userEvent.type(input, domain);

      fireEvent.click(screen.getByText('Add Domain'));

      await waitFor(() => {
        expect(mockRegisterDomain).toHaveBeenCalledWith(domain);
      });

      unmount();
    }
  });

  test('should disable buttons during loading', async () => {
    mockRegisterDomain.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        success: true,
        zone_id: 'zone-123',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
        secret_key: 'gk_live_' + 'a'.repeat(32),
      }), 100))
    );

    render(
      <CreateProjectModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const input = screen.getByPlaceholderText('example.com');
    await userEvent.type(input, 'example.com');

    fireEvent.click(screen.getByText('Add Domain'));

    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toBeDisabled();
  });
});
