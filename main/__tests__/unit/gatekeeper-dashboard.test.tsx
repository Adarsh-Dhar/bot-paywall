/**
 * Unit Tests for Dashboard Components
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { render, screen } from '@testing-library/react';
import { ProjectCard } from '@/app/dashboard/components/ProjectCard';
import { Project } from '@/types/gatekeeper';

describe('ProjectCard Component', () => {
  const mockProject: Project = {
    id: 'project-123',
    user_id: 'user-123',
    name: 'example.com',
    zone_id: 'zone-123',
    nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
    status: 'pending_ns',
    secret_key: 'gk_live_' + 'a'.repeat(32),
    created_at: '2024-01-01T00:00:00Z',
  };

  test('should render domain name', () => {
    const mockOnClick = jest.fn();
    render(<ProjectCard project={mockProject} onClick={mockOnClick} />);

    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  test('should render pending status badge for pending_ns status', () => {
    const mockOnClick = jest.fn();
    render(<ProjectCard project={mockProject} onClick={mockOnClick} />);

    expect(screen.getByText('⚠ Pending Setup')).toBeInTheDocument();
  });

  test('should render protected status badge for protected status', () => {
    const mockOnClick = jest.fn();
    const protectedProject = { ...mockProject, status: 'protected' as const };
    render(<ProjectCard project={protectedProject} onClick={mockOnClick} />);

    expect(screen.getByText('✅ Secure & Active')).toBeInTheDocument();
  });

  test('should have yellow badge styling for pending_ns', () => {
    const mockOnClick = jest.fn();
    const { container } = render(<ProjectCard project={mockProject} onClick={mockOnClick} />);

    const badge = container.querySelector('.bg-yellow-100');
    expect(badge).toBeInTheDocument();
  });

  test('should have green badge styling for protected', () => {
    const mockOnClick = jest.fn();
    const protectedProject = { ...mockProject, status: 'protected' as const };
    const { container } = render(<ProjectCard project={protectedProject} onClick={mockOnClick} />);

    const badge = container.querySelector('.bg-green-100');
    expect(badge).toBeInTheDocument();
  });

  test('should call onClick when card is clicked', () => {
    const mockOnClick = jest.fn();
    const { container } = render(<ProjectCard project={mockProject} onClick={mockOnClick} />);

    const card = container.firstChild;
    if (card instanceof HTMLElement) {
      card.click();
    }

    expect(mockOnClick).toHaveBeenCalled();
  });

  test('should display creation date', () => {
    const mockOnClick = jest.fn();
    render(<ProjectCard project={mockProject} onClick={mockOnClick} />);

    // Date should be formatted
    expect(screen.getByText(/Created/)).toBeInTheDocument();
  });

  test('should render multiple projects correctly', () => {
    const mockOnClick = jest.fn();
    const projects = [
      mockProject,
      { ...mockProject, id: 'project-2', name: 'test.com', status: 'protected' as const },
      { ...mockProject, id: 'project-3', name: 'demo.com', status: 'pending_ns' as const },
    ];

    const { rerender } = render(
      <ProjectCard project={projects[0]} onClick={mockOnClick} />
    );

    expect(screen.getByText('example.com')).toBeInTheDocument();

    rerender(<ProjectCard project={projects[1]} onClick={mockOnClick} />);
    expect(screen.getByText('test.com')).toBeInTheDocument();

    rerender(<ProjectCard project={projects[2]} onClick={mockOnClick} />);
    expect(screen.getByText('demo.com')).toBeInTheDocument();
  });

  test('should handle special characters in domain names', () => {
    const mockOnClick = jest.fn();
    const specialProject = { ...mockProject, name: 'my-domain-123.co.uk' };
    render(<ProjectCard project={specialProject} onClick={mockOnClick} />);

    expect(screen.getByText('my-domain-123.co.uk')).toBeInTheDocument();
  });

  test('should be clickable', () => {
    const mockOnClick = jest.fn();
    const { container } = render(<ProjectCard project={mockProject} onClick={mockOnClick} />);

    const card = container.querySelector('[class*="cursor-pointer"]');
    expect(card).toBeInTheDocument();
  });

  test('should have hover effects', () => {
    const mockOnClick = jest.fn();
    const { container } = render(<ProjectCard project={mockProject} onClick={mockOnClick} />);

    const card = container.firstChild;
    expect(card).toHaveClass('hover:shadow-md');
    expect(card).toHaveClass('hover:border-blue-300');
  });
});
