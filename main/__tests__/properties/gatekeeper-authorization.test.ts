/**
 * Property-Based Tests for Gatekeeper User Authorization
 * Feature: gatekeeper-bot-firewall, Property 15: User Authorization on Access
 * Validates: Requirements 7.5
 */

import fc from 'fast-check';

/**
 * Mock project for testing
 */
interface MockProject {
  id: string;
  user_id: string;
  name: string;
  zone_id: string;
  status: string;
  secret_key: string;
}

/**
 * Authorization check function
 */
function authorizeProjectAccess(
  project: MockProject | null,
  requestingUserId: string
): boolean {
  if (!project) return false;
  return project.user_id === requestingUserId;
}

/**
 * Get project with authorization
 */
function getProjectWithAuth(
  allProjects: MockProject[],
  projectId: string,
  requestingUserId: string
): MockProject | null {
  const project = allProjects.find((p) => p.id === projectId);
  if (!project) return null;

  if (!authorizeProjectAccess(project, requestingUserId)) {
    return null;
  }

  return project;
}

describe('User Authorization Properties', () => {
  /**
   * Property 15: User Authorization on Access
   * For any project access attempt, the system SHALL verify that the requesting user's ID matches
   * the project's user_id, rejecting access if they do not match.
   */
  test('Property 15: Authorization check validates user ownership', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.record({
            id: fc.uuid(),
            user_id: fc.uuid(),
            name: fc.domain(),
            zone_id: fc.uuid(),
            status: fc.constantFrom('pending_ns', 'protected'),
            secret_key: fc.string({ minLength: 40, maxLength: 40 }),
          }),
          fc.uuid()
        ),
        ([project, requestingUserId]) => {
          const isAuthorized = authorizeProjectAccess(project, requestingUserId);

          if (project.user_id === requestingUserId) {
            expect(isAuthorized).toBe(true);
          } else {
            expect(isAuthorized).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Owner can always access their project
   */
  test('Property: Owner can always access their project', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          user_id: fc.uuid(),
          name: fc.domain(),
          zone_id: fc.uuid(),
          status: fc.constantFrom('pending_ns', 'protected'),
          secret_key: fc.string({ minLength: 40, maxLength: 40 }),
        }),
        (project) => {
          const isAuthorized = authorizeProjectAccess(project, project.user_id);

          expect(isAuthorized).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-owner cannot access project
   */
  test('Property: Non-owner cannot access project', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.record({
            id: fc.uuid(),
            user_id: fc.uuid(),
            name: fc.domain(),
            zone_id: fc.uuid(),
            status: fc.constantFrom('pending_ns', 'protected'),
            secret_key: fc.string({ minLength: 40, maxLength: 40 }),
          }),
          fc.uuid()
        ),
        ([project, differentUserId]) => {
          fc.pre(project.user_id !== differentUserId);

          const isAuthorized = authorizeProjectAccess(project, differentUserId);

          expect(isAuthorized).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Null project always denies access
   */
  test('Property: Null project always denies access', () => {
    fc.assert(
      fc.property(fc.uuid(), (userId) => {
        const isAuthorized = authorizeProjectAccess(null, userId);

        expect(isAuthorized).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Authorization is consistent across multiple checks
   */
  test('Property: Authorization is consistent across multiple checks', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.record({
            id: fc.uuid(),
            user_id: fc.uuid(),
            name: fc.domain(),
            zone_id: fc.uuid(),
            status: fc.constantFrom('pending_ns', 'protected'),
            secret_key: fc.string({ minLength: 40, maxLength: 40 }),
          }),
          fc.uuid()
        ),
        ([project, requestingUserId]) => {
          const check1 = authorizeProjectAccess(project, requestingUserId);
          const check2 = authorizeProjectAccess(project, requestingUserId);
          const check3 = authorizeProjectAccess(project, requestingUserId);

          expect(check1).toBe(check2);
          expect(check2).toBe(check3);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Authorization check doesn't modify project data
   */
  test('Property: Authorization check does not modify project data', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.record({
            id: fc.uuid(),
            user_id: fc.uuid(),
            name: fc.domain(),
            zone_id: fc.uuid(),
            status: fc.constantFrom('pending_ns', 'protected'),
            secret_key: fc.string({ minLength: 40, maxLength: 40 }),
          }),
          fc.uuid()
        ),
        ([project, requestingUserId]) => {
          const projectBefore = { ...project };

          authorizeProjectAccess(project, requestingUserId);

          expect(project).toEqual(projectBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: getProjectWithAuth enforces authorization
   */
  test('Property: getProjectWithAuth enforces authorization', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(
            fc.record({
              id: fc.uuid(),
              user_id: fc.uuid(),
              name: fc.domain(),
              zone_id: fc.uuid(),
              status: fc.constantFrom('pending_ns', 'protected'),
              secret_key: fc.string({ minLength: 40, maxLength: 40 }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          fc.uuid()
        ),
        ([projects, requestingUserId]) => {
          projects.forEach((project) => {
            const result = getProjectWithAuth(projects, project.id, requestingUserId);

            if (project.user_id === requestingUserId) {
              expect(result).not.toBeNull();
              expect(result?.id).toBe(project.id);
            } else {
              expect(result).toBeNull();
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-existent project returns null
   */
  test('Property: Non-existent project returns null', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(
            fc.record({
              id: fc.uuid(),
              user_id: fc.uuid(),
              name: fc.domain(),
              zone_id: fc.uuid(),
              status: fc.constantFrom('pending_ns', 'protected'),
              secret_key: fc.string({ minLength: 40, maxLength: 40 }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          fc.uuid(),
          fc.uuid()
        ),
        ([projects, nonExistentProjectId, userId]) => {
          // Ensure project doesn't exist
          fc.pre(!projects.some((p) => p.id === nonExistentProjectId));

          const result = getProjectWithAuth(projects, nonExistentProjectId, userId);

          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Case sensitivity in user ID matching
   */
  test('Property: User ID matching is case sensitive', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          user_id: fc.uuid(),
          name: fc.domain(),
          zone_id: fc.uuid(),
          status: fc.constantFrom('pending_ns', 'protected'),
          secret_key: fc.string({ minLength: 40, maxLength: 40 }),
        }),
        (project) => {
          const differentCase = project.user_id.toUpperCase();

          // If user IDs are different (case-sensitive), authorization should fail
          if (project.user_id !== differentCase) {
            const isAuthorized = authorizeProjectAccess(project, differentCase);
            expect(isAuthorized).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
