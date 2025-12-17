/**
 * Unit Tests for ProtectedView Component
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ProtectedView } from '@/app/dashboard/components/ProtectedView';
import { Project } from '@/types/gatekeeper';

describe('ProtectedView Component', () => {
  const mockProject: Project = {
    id: 'project-123',
    user_id: 'user-123',
    name: 'example.com',
    zone_id: 'zone-123',
    nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
    status: 'protected',
    secret_key: 'gk_live_' + 'a'.repeat(32),
    created_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should display success banner', () => {
    render(<ProtectedView project={mockProject} />);

    expect(screen.getByText('Site is Live & Secure')).toBeInTheDocument();
  });

  test('should display domain name', () => {
    render(<ProtectedView project={mockProject} />);

    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  test('should display secret key section', () => {
    render(<ProtectedView project={mockProject} />);

    expect(screen.getByText('Backdoor Password')).toBeInTheDocument();
  });

  test('should display obscured secret key by default', () => {
    render(<ProtectedView project={mockProject} />);

    const obscuredKey = `gk_live_${'•'.repeat(32)}`;
    expect(screen.getByText(obscuredKey)).toBeInTheDocument();
  });

  test('should have show/hide button for secret key', () => {
    render(<ProtectedView project={mockProject} />);

    expect(screen.getByText('Show')).toBeInTheDocument();
  });

  test('should show full secret key when show button is clicked', () => {
    render(<ProtectedView project={mockProject} />);

    fireEvent.click(screen.getByText('Show'));

    expect(screen.getByText(mockProject.secret_key)).toBeInTheDocument();
    expect(screen.getByText('Hide')).toBeInTheDocument();
  });

  test('should hide secret key when hide button is clicked', () => {
    render(<ProtectedView project={mockProject} />);

    fireEvent.click(screen.getByText('Show'));
    fireEvent.click(screen.getByText('Hide'));

    const obscuredKey = `gk_live_${'•'.repeat(32)}`;
    expect(screen.getByText(obscuredKey)).toBeInTheDocument();
  });

  test('should have copy password button', () => {
    render(<ProtectedView project={mockProject} />);

    expect(screen.getByText('Copy Password')).toBeInTheDocument();
  });

  test('should copy secret key to clipboard', () => {
    const mockClipboard = {
      writeText: jest.fn(),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(<ProtectedView project={mockProject} />);

    fireEvent.click(screen.getByText('Copy Password'));

    expect(mockClipboard.writeText).toHaveBeenCalledWith(mockProject.secret_key);
  });

  test('should show copied confirmation', () => {
    const mockClipboard = {
      writeText: jest.fn(),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(<ProtectedView project={mockProject} />);

    fireEvent.click(screen.getByText('Copy Password'));

    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  test('should display integration section', () => {
    render(<ProtectedView project={mockProject} />);

    expect(screen.getByText('Integration Example')).toBeInTheDocument();
  });

  test('should display curl command with correct domain and secret key', () => {
    render(<ProtectedView project={mockProject} />);

    const expectedCommand = `curl -H "x-bot-password: ${mockProject.secret_key}" https://${mockProject.name}/api/data`;
    expect(screen.getByText(expectedCommand)).toBeInTheDocument();
  });

  test('should have copy snippet button', () => {
    render(<ProtectedView project={mockProject} />);

    expect(screen.getByText('Copy Snippet')).toBeInTheDocument();
  });

  test('should copy snippet to clipboard', () => {
    const mockClipboard = {
      writeText: jest.fn(),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(<ProtectedView project={mockProject} />);

    const copyButtons = screen.getAllByText('Copy Snippet');
    fireEvent.click(copyButtons[0]);

    const expectedCommand = `curl -H "x-bot-password: ${mockProject.secret_key}" https://${mockProject.name}/api/data`;
    expect(mockClipboard.writeText).toHaveBeenCalledWith(expectedCommand);
  });

  test('should display how it works section', () => {
    render(<ProtectedView project={mockProject} />);

    expect(screen.getByText('How It Works')).toBeInTheDocument();
  });

  test('should display security note', () => {
    render(<ProtectedView project={mockProject} />);

    expect(screen.getByText(/Keep your backdoor password secure/)).toBeInTheDocument();
  });

  test('should display all integration steps', () => {
    render(<ProtectedView project={mockProject} />);

    expect(screen.getByText(/Bots are detected using Cloudflare/)).toBeInTheDocument();
    expect(screen.getByText(/Requests without the correct password/)).toBeInTheDocument();
    expect(screen.getByText(/Requests with the correct password/)).toBeInTheDocument();
    expect(screen.getByText(/Real users can always solve the CAPTCHA/)).toBeInTheDocument();
  });

  test('should display x-bot-password header name', () => {
    render(<ProtectedView project={mockProject} />);

    expect(screen.getAllByText(/x-bot-password/).length).toBeGreaterThan(0);
  });

  test('should handle different domain names', () => {
    const projectWithDifferentDomain = {
      ...mockProject,
      name: 'test.co.uk',
    };

    render(<ProtectedView project={projectWithDifferentDomain} />);

    expect(screen.getByText('test.co.uk')).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/test\.co\.uk\/api\/data/)).toBeInTheDocument();
  });

  test('should display protected status', () => {
    render(<ProtectedView project={mockProject} />);

    expect(screen.getByText('Protected with Gatekeeper')).toBeInTheDocument();
  });

  test('should have proper header structure', () => {
    const { container } = render(<ProtectedView project={mockProject} />);

    const h1 = container.querySelector('h1');
    expect(h1?.textContent).toContain('example.com');
  });

  test('should display all required information', () => {
    render(<ProtectedView project={mockProject} />);

    // Success banner
    expect(screen.getByText('Site is Live & Secure')).toBeInTheDocument();

    // Domain
    expect(screen.getByText('example.com')).toBeInTheDocument();

    // Secret key section
    expect(screen.getByText('Backdoor Password')).toBeInTheDocument();

    // Integration section
    expect(screen.getByText('Integration Example')).toBeInTheDocument();

    // How it works
    expect(screen.getByText('How It Works')).toBeInTheDocument();
  });
});
