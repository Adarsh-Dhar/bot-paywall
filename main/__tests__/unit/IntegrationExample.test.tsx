/**
 * Unit Tests for IntegrationExample Component
 * Requirements: 5.4, 5.5
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IntegrationExample from '@/components/IntegrationExample';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

describe('IntegrationExample', () => {
  const mockProps = {
    domain: 'example.com',
    secretKey: 'gk_live_abcdef123456789',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render integration code with correct domain and secret key', () => {
    render(<IntegrationExample {...mockProps} />);

    expect(screen.getByText('Integration Code')).toBeInTheDocument();
    expect(screen.getByText(/Use the X-Partner-Key header/)).toBeInTheDocument();
    
    // Check that the code contains the domain and secret key
    const codeElement = screen.getByText(/curl -X GET/);
    expect(codeElement).toBeInTheDocument();
    expect(codeElement.textContent).toContain(mockProps.domain);
    expect(codeElement.textContent).toContain(mockProps.secretKey);
    expect(codeElement.textContent).toContain('X-Partner-Key');
  });

  test('should show copy button and handle copy functionality', async () => {
    (navigator.clipboard.writeText as jest.Mock).mockResolvedValue(undefined);
    
    render(<IntegrationExample {...mockProps} />);

    const copyButton = screen.getByText('Copy Code');
    expect(copyButton).toBeInTheDocument();

    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining(mockProps.domain)
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining(mockProps.secretKey)
    );

    // Check that button text changes to "Copied!"
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    // Check that it reverts back after timeout
    await waitFor(() => {
      expect(screen.getByText('Copy Code')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('should handle copy failure gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(new Error('Copy failed'));
    
    render(<IntegrationExample {...mockProps} />);

    const copyButton = screen.getByText('Copy Code');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to copy:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  test('should display explanation about how the skip rule works', () => {
    render(<IntegrationExample {...mockProps} />);

    expect(screen.getByText('How it works')).toBeInTheDocument();
    expect(screen.getByText(/WAF skip rule/)).toBeInTheDocument();
    expect(screen.getByText(/Super Bot Fight Mode and Rate Limiting/)).toBeInTheDocument();
  });

  test('should include multiple programming language examples', () => {
    render(<IntegrationExample {...mockProps} />);

    const codeElement = screen.getByText(/curl -X GET/);
    expect(codeElement.textContent).toContain('curl');
    expect(codeElement.textContent).toContain('JavaScript/Node.js');
    expect(codeElement.textContent).toContain('Python');
    expect(codeElement.textContent).toContain('fetch(');
    expect(codeElement.textContent).toContain('requests.get');
  });
});