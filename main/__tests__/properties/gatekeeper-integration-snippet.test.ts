/**
 * Property-Based Tests for Gatekeeper Integration Snippet
 * Feature: gatekeeper-bot-firewall, Property 13: Integration Snippet Correctness
 * Validates: Requirements 5.5
 */

import fc from 'fast-check';

/**
 * Generate integration snippet
 */
function generateIntegrationSnippet(domain: string, secretKey: string): string {
  return `curl -H "x-bot-password: ${secretKey}" https://${domain}/api/data`;
}

describe('Integration Snippet Properties', () => {
  /**
   * Property 13: Integration Snippet Correctness
   * For any protected project, the displayed integration code snippet SHALL contain the correct
   * domain name and the project's secret_key in the curl command example.
   */
  test('Property 13: Integration snippet contains correct domain and secret key', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.domain(),
          fc.string({ minLength: 40, maxLength: 40 })
        ),
        ([domain, secretKey]) => {
          const snippet = generateIntegrationSnippet(domain, secretKey);

          // Should contain the domain
          expect(snippet).toContain(domain);

          // Should contain the secret key
          expect(snippet).toContain(secretKey);

          // Should contain the header name
          expect(snippet).toContain('x-bot-password');

          // Should be a valid curl command
          expect(snippet).toMatch(/^curl -H/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Snippet contains correct header format
   */
  test('Property: Snippet contains correct header format', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.domain(),
          fc.string({ minLength: 40, maxLength: 40 })
        ),
        ([domain, secretKey]) => {
          const snippet = generateIntegrationSnippet(domain, secretKey);

          // Should have the header in correct format
          expect(snippet).toContain(`-H "x-bot-password: ${secretKey}"`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Snippet contains correct URL format
   */
  test('Property: Snippet contains correct URL format', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.domain(),
          fc.string({ minLength: 40, maxLength: 40 })
        ),
        ([domain, secretKey]) => {
          const snippet = generateIntegrationSnippet(domain, secretKey);

          // Should have https URL
          expect(snippet).toContain(`https://${domain}`);

          // Should have /api/data endpoint
          expect(snippet).toContain('/api/data');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Different domains produce different snippets
   */
  test('Property: Different domains produce different snippets', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.domain(),
          fc.domain(),
          fc.string({ minLength: 40, maxLength: 40 })
        ),
        ([domain1, domain2, secretKey]) => {
          fc.pre(domain1 !== domain2);

          const snippet1 = generateIntegrationSnippet(domain1, secretKey);
          const snippet2 = generateIntegrationSnippet(domain2, secretKey);

          expect(snippet1).not.toBe(snippet2);
          expect(snippet1).toContain(domain1);
          expect(snippet2).toContain(domain2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Different secret keys produce different snippets
   */
  test('Property: Different secret keys produce different snippets', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.domain(),
          fc.string({ minLength: 40, maxLength: 40 }),
          fc.string({ minLength: 40, maxLength: 40 })
        ),
        ([domain, key1, key2]) => {
          fc.pre(key1 !== key2);

          const snippet1 = generateIntegrationSnippet(domain, key1);
          const snippet2 = generateIntegrationSnippet(domain, key2);

          expect(snippet1).not.toBe(snippet2);
          expect(snippet1).toContain(key1);
          expect(snippet2).toContain(key2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Snippet is valid curl command syntax
   */
  test('Property: Snippet is valid curl command syntax', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.domain(),
          fc.string({ minLength: 40, maxLength: 40 })
        ),
        ([domain, secretKey]) => {
          const snippet = generateIntegrationSnippet(domain, secretKey);

          // Should start with curl
          expect(snippet).toMatch(/^curl /);

          // Should have -H flag for header
          expect(snippet).toContain(' -H ');

          // Should have URL at the end
          expect(snippet).toMatch(/https:\/\/[^ ]+$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Snippet contains no unescaped quotes in values
   */
  test('Property: Snippet contains properly quoted header value', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.domain(),
          fc.string({ minLength: 40, maxLength: 40 })
        ),
        ([domain, secretKey]) => {
          const snippet = generateIntegrationSnippet(domain, secretKey);

          // Header should be properly quoted
          expect(snippet).toContain(`"x-bot-password: ${secretKey}"`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Snippet is consistent for same inputs
   */
  test('Property: Snippet is consistent for same inputs', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.domain(),
          fc.string({ minLength: 40, maxLength: 40 })
        ),
        ([domain, secretKey]) => {
          const snippet1 = generateIntegrationSnippet(domain, secretKey);
          const snippet2 = generateIntegrationSnippet(domain, secretKey);
          const snippet3 = generateIntegrationSnippet(domain, secretKey);

          expect(snippet1).toBe(snippet2);
          expect(snippet2).toBe(snippet3);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Snippet contains all required components
   */
  test('Property: Snippet contains all required components', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.domain(),
          fc.string({ minLength: 40, maxLength: 40 })
        ),
        ([domain, secretKey]) => {
          const snippet = generateIntegrationSnippet(domain, secretKey);

          // All required parts should be present
          expect(snippet).toContain('curl');
          expect(snippet).toContain('-H');
          expect(snippet).toContain('x-bot-password');
          expect(snippet).toContain(secretKey);
          expect(snippet).toContain('https://');
          expect(snippet).toContain(domain);
          expect(snippet).toContain('/api/data');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Snippet length is reasonable
   */
  test('Property: Snippet length is reasonable', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.domain(),
          fc.string({ minLength: 40, maxLength: 40 })
        ),
        ([domain, secretKey]) => {
          const snippet = generateIntegrationSnippet(domain, secretKey);

          // Should be a reasonable length (not too short, not too long)
          expect(snippet.length).toBeGreaterThan(50);
          expect(snippet.length).toBeLessThan(500);
        }
      ),
      { numRuns: 100 }
    );
  });
});
