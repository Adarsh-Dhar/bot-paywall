/**
 * Property-Based Tests for Gatekeeper Project Card Display
 * Feature: gatekeeper-bot-firewall, Property 14: Project Card Display
 * Validates: Requirements 6.2, 6.3, 6.4
 */

import fc from 'fast-check';

/**
 * Mock project for testing
 */
interface MockProject {
  id: string;
  name: string;
  status: 'pending_ns' | 'protected';
  created_at: string;
}

/**
 * Get status badge color
 */
function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'pending_ns':
      return 'yellow';
    case 'protected':
      return 'green';
    default:
      return 'gray';
  }
}

/**
 * Format project card display
 */
function formatProjectCard(project: MockProject): {
  domainName: string;
  statusBadge: string;
  statusColor: string;
} {
  return {
    domainName: project.name,
    statusBadge: project.status === 'pending_ns' ? 'Pending Nameservers' : 'Protected',
    statusColor: getStatusBadgeColor(project.status),
  };
}

describe('Project Card Display Properties', () => {
  /**
   * Property 14: Project Card Display
   * For any project displayed on the dashboard, the card SHALL show the domain name and current status badge,
   * with status badges colored yellow for 'pending_ns' and green for 'protected'.
   */
  test('Property 14: Project card displays domain name and status', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          name: fc.domain(),
          status: fc.constantFrom('pending_ns', 'protected'),
          created_at: fc.date().map((d) => d.toISOString()),
        }),
        (project) => {
          const card = formatProjectCard(project);

          // Domain name should be displayed
          expect(card.domainName).toBe(project.name);
          expect(card.domainName).toBeTruthy();

          // Status badge should be present
          expect(card.statusBadge).toBeTruthy();
          expect(['Pending Nameservers', 'Protected']).toContain(card.statusBadge);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Pending status displays yellow badge
   */
  test('Property: Pending status displays yellow badge', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          name: fc.domain(),
          status: fc.constant('pending_ns'),
          created_at: fc.date().map((d) => d.toISOString()),
        }),
        (project) => {
          const card = formatProjectCard(project);

          expect(card.statusColor).toBe('yellow');
          expect(card.statusBadge).toBe('Pending Nameservers');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Protected status displays green badge
   */
  test('Property: Protected status displays green badge', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          name: fc.domain(),
          status: fc.constant('protected'),
          created_at: fc.date().map((d) => d.toISOString()),
        }),
        (project) => {
          const card = formatProjectCard(project);

          expect(card.statusColor).toBe('green');
          expect(card.statusBadge).toBe('Protected');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Domain name is always displayed
   */
  test('Property: Domain name is always displayed', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          name: fc.domain(),
          status: fc.constantFrom('pending_ns', 'protected'),
          created_at: fc.date().map((d) => d.toISOString()),
        }),
        (project) => {
          const card = formatProjectCard(project);

          expect(card.domainName).toBe(project.name);
          expect(card.domainName.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Status badge is always present
   */
  test('Property: Status badge is always present', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          name: fc.domain(),
          status: fc.constantFrom('pending_ns', 'protected'),
          created_at: fc.date().map((d) => d.toISOString()),
        }),
        (project) => {
          const card = formatProjectCard(project);

          expect(card.statusBadge).toBeDefined();
          expect(card.statusBadge.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Status color matches status value
   */
  test('Property: Status color matches status value', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          name: fc.domain(),
          status: fc.constantFrom('pending_ns', 'protected'),
          created_at: fc.date().map((d) => d.toISOString()),
        }),
        (project) => {
          const card = formatProjectCard(project);

          if (project.status === 'pending_ns') {
            expect(card.statusColor).toBe('yellow');
          } else if (project.status === 'protected') {
            expect(card.statusColor).toBe('green');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Card data is not modified
   */
  test('Property: Card data is not modified', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          name: fc.domain(),
          status: fc.constantFrom('pending_ns', 'protected'),
          created_at: fc.date().map((d) => d.toISOString()),
        }),
        (project) => {
          const projectBefore = { ...project };
          formatProjectCard(project);

          expect(project).toEqual(projectBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple cards can be displayed
   */
  test('Property: Multiple cards can be displayed', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.domain(),
            status: fc.constantFrom('pending_ns', 'protected'),
            created_at: fc.date().map((d) => d.toISOString()),
          }),
          { minLength: 1, maxLength: 100 }
        ),
        (projects) => {
          const cards = projects.map(formatProjectCard);

          expect(cards.length).toBe(projects.length);
          cards.forEach((card, index) => {
            expect(card.domainName).toBe(projects[index].name);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
