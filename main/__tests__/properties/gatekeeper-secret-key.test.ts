/**
 * Property-Based Tests for Gatekeeper Secret Key Generation
 * Feature: gatekeeper-bot-firewall, Property 1: Secret Key Uniqueness
 * Validates: Requirements 1.3
 */

import fc from 'fast-check';
import { generateSecretKey, isValidSecretKey, obscureSecretKey } from '@/lib/secret-key-generator';

describe('Secret Key Generation Properties', () => {
  /**
   * Property 1: Secret Key Uniqueness
   * For any collection of projects created, all generated secret keys SHALL be unique and distinct from one another.
   */
  test('Property 1: Generated secret keys are always unique', () => {
    fc.assert(
      fc.property(fc.integer({ min: 10, max: 1000 }), (count) => {
        const keys = new Set<string>();

        for (let i = 0; i < count; i++) {
          const key = generateSecretKey();
          keys.add(key);
        }

        // All keys should be unique
        expect(keys.size).toBe(count);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Generated secret keys always have valid format
   */
  test('Property: Generated secret keys always have valid format', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (count) => {
        for (let i = 0; i < count; i++) {
          const key = generateSecretKey();
          expect(isValidSecretKey(key)).toBe(true);
          expect(key).toMatch(/^gk_live_[a-f0-9]{32}$/);
          expect(key.length).toBe(40);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Secret key obscuration preserves prefix
   */
  test('Property: Secret key obscuration preserves prefix', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (count) => {
        for (let i = 0; i < count; i++) {
          const key = generateSecretKey();
          const obscured = obscureSecretKey(key);

          // Should start with gk_live_
          expect(obscured).toMatch(/^gk_live_/);
          // Should contain bullet points
          expect(obscured).toContain('•');
          // Should be 40 characters (8 for prefix + 32 for bullets)
          expect(obscured.length).toBe(40);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid secret keys are rejected
   */
  test('Property: Invalid secret keys are rejected', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => !s.match(/^gk_live_[a-f0-9]{32}$/)),
        (invalidKey) => {
          expect(isValidSecretKey(invalidKey)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
